const { getFirestore, getAuth } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/environment');
const logger = require('../utils/logger');
const { AuthenticationError, ConflictError, NotFoundError, ValidationError } = require('../utils/errors');
const { serializeDoc, serializeDocs } = require('../utils/serializer');
const vehicleService = require('./vehicle.service');

class AuthService {
    constructor() {
        this.db = getFirestore();
        this.auth = getAuth();
    }

    /**
     * Register a new user
     * @param {Object} userData - User registration data
     * @returns {Promise<Object>}
     */
    async register(userData) {
        try {
            const { email, password, username, role = 'sales_rep', phone } = userData;

            // Check if user already exists
            const existingUser = await this.db.collection('users')
                .where('email', '==', email)
                .limit(1)
                .get();

            if (!existingUser.empty) {
                throw new ConflictError('User with this email already exists');
            }

            // Create Firebase Auth user
            const userRecord = await this.auth.createUser({
                email,
                password,
                displayName: username
            });

            // Hash password for Firestore storage (backup)
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user document in Firestore
            const userDoc = {
                email,
                username,
                fullName: username, // For frontend compatibility
                role,
                phone: phone || null,
                phoneNumber: phone || null, // For frontend compatibility
                hashedPassword,
                isVerified: role === 'admin', // Auto-verify admins
                assignedVehicleId: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('users').doc(userRecord.uid).set(userDoc);

            logger.info(`User registered successfully: ${email}`, { userId: userRecord.uid, role });

            // Generate JWT token
            const token = this.generateToken(userRecord.uid, email, role);

            return {
                user: {
                    uid: userRecord.uid,
                    email,
                    username,
                    role,
                    isVerified: userDoc.isVerified
                },
                token
            };
        } catch (error) {
            logger.error('Registration error:', error);

            if (error.code === 'auth/email-already-exists') {
                throw new ConflictError('User with this email already exists');
            }
            if (error.code === 'auth/invalid-email') {
                throw new ValidationError('Invalid email format');
            }
            if (error.code === 'auth/weak-password') {
                throw new ValidationError('Password is too weak');
            }

            throw error;
        }
    }

    /**
     * Login user
     * @param {string} email
     * @param {string} password
     * @returns {Promise<Object>}
     */
    async login(email, password) {
        try {
            // Authenticate with Firebase Auth
            let userRecord;
            try {
                // Verify credentials by attempting to get user
                userRecord = await this.auth.getUserByEmail(email);

                // For admin SDK, we need to verify the password differently
                // We'll use a custom token approach or verify against Firestore
                // Since we can't directly verify password with Admin SDK, 
                // we'll use Firebase Auth REST API
                const response = await this.verifyPasswordWithFirebase(email, password);

                if (!response.success) {
                    throw new AuthenticationError('Invalid email or password');
                }
            } catch (error) {
                if (error.code === 'auth/user-not-found') {
                    throw new AuthenticationError('Invalid email or password');
                }
                throw error;
            }

            // Get user data from Firestore
            const userDoc = await this.db.collection('users').doc(userRecord.uid).get();

            if (!userDoc.exists) {
                throw new AuthenticationError('User data not found');
            }

            const userData = userDoc.data();

            // Check if user is verified
            if (!userData.isVerified) {
                throw new AuthenticationError('Account not verified. Please contact administrator.');
            }

            // Generate JWT token
            const token = this.generateToken(userRecord.uid, email, userData.role);

            // Update last login
            await this.db.collection('users').doc(userRecord.uid).update({
                lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
            });

            logger.info(`User logged in successfully: ${email}`, { userId: userRecord.uid });

            return {
                user: {
                    uid: userRecord.uid,
                    email: userData.email,
                    username: userData.username,
                    role: userData.role,
                    isVerified: userData.isVerified,
                    assignedVehicleId: userData.assignedVehicleId
                },
                token
            };
        } catch (error) {
            logger.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Verify password using Firebase Auth REST API
     * @param {string} email
     * @param {string} password
     * @returns {Promise<Object>}
     */
    async verifyPasswordWithFirebase(email, password) {
        try {
            const apiKey = config.FIREBASE.API_KEY;
            const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                    returnSecureToken: true
                })
            });

            const data = await response.json();

            if (!response.ok) {
                return { success: false, error: data.error };
            }

            return { success: true, data };
        } catch (error) {
            logger.error('Firebase password verification error:', error);
            return { success: false, error };
        }
    }

    /**
     * Generate JWT token
     * @param {string} uid
     * @param {string} email
     * @param {string} role
     * @returns {string}
     */
    generateToken(uid, email, role) {
        const payload = {
            uid,
            email,
            role
        };

        return jwt.sign(payload, config.JWT.SECRET, {
            expiresIn: config.JWT.EXPIRY
        });
    }

    /**
     * Verify JWT token
     * @param {string} token
     * @returns {Object}
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, config.JWT.SECRET);
        } catch (error) {
            throw new AuthenticationError('Invalid or expired token');
        }
    }

    /**
     * Get all users
     * @param {Object} filters - Optional filters
     * @returns {Promise<Array>}
     */
    async getAllUsers(filters = {}) {
        try {
            let query = this.db.collection('users');

            // Apply filters
            if (filters.role) {
                query = query.where('role', '==', filters.role);
            }
            if (filters.isVerified !== undefined) {
                query = query.where('isVerified', '==', filters.isVerified);
            }

            const snapshot = await query.get();
            const users = serializeDocs(snapshot);

            // Remove sensitive data
            return users.map(user => {
                const { hashedPassword, ...safeUser } = user;
                return safeUser;
            });
        } catch (error) {
            logger.error('Get users error:', error);
            throw error;
        }
    }

    /**
     * Get user by ID
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async getUserById(userId) {
        try {
            const userDoc = await this.db.collection('users').doc(userId).get();

            if (!userDoc.exists) {
                throw new NotFoundError('User');
            }

            const userData = serializeDoc(userDoc);
            const { hashedPassword, ...safeUser } = userData;

            return safeUser;
        } catch (error) {
            logger.error('Get user error:', error);
            throw error;
        }
    }

    /**
     * Verify user account
     * @param {string} userId
     * @param {boolean} isVerified
     * @returns {Promise<Object>}
     */
    async verifyUser(userId, isVerified) {
        try {
            const userDoc = await this.db.collection('users').doc(userId).get();

            if (!userDoc.exists) {
                throw new NotFoundError('User');
            }

            await this.db.collection('users').doc(userId).update({
                isVerified,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            logger.info(`User verification updated: ${userId}`, { isVerified });

            return await this.getUserById(userId);
        } catch (error) {
            logger.error('Verify user error:', error);
            throw error;
        }
    }

    /**
     * Assign vehicle to user
     * @param {string} userId
     * @param {string} vehicleId
     * @returns {Promise<Object>}
     */
    async assignVehicle(userId, vehicleId) {
        try {
            const userDoc = await this.db.collection('users').doc(userId).get();

            if (!userDoc.exists) {
                throw new NotFoundError('User');
            }
            const userData = userDoc.data();
            const oldVehicleId = userData.assignedVehicleId;

            // Case 1: Unassign vehicle (vehicleId is null)
            if (!vehicleId) {
                // If user had a vehicle, unassign from it
                if (oldVehicleId) {
                    await vehicleService.unassignUser(oldVehicleId);
                }

                await this.db.collection('users').doc(userId).update({
                    assignedVehicleId: null,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                logger.info(`Vehicle unassigned from user: ${userId}`);
                return await this.getUserById(userId);
            }

            // Case 2: Assign new vehicle
            // Verify new vehicle exists
            const vehicleDoc = await this.db.collection('vehicles').doc(vehicleId).get();
            if (!vehicleDoc.exists) {
                throw new NotFoundError('Vehicle');
            }

            // If user had a different vehicle, unassign from it first
            if (oldVehicleId && oldVehicleId !== vehicleId) {
                await vehicleService.unassignUser(oldVehicleId);
            }

            // Update user document
            await this.db.collection('users').doc(userId).update({
                assignedVehicleId: vehicleId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Also update the vehicle document
            await vehicleService.assignUser(vehicleId, userId);

            logger.info(`Vehicle assigned to user: ${userId}`, { vehicleId });

            return await this.getUserById(userId);
        } catch (error) {
            logger.error('Assign vehicle error:', error);
            throw error;
        }
    }

    /**
     * Update user
     * @param {string} userId
     * @param {Object} updateData
     * @returns {Promise<Object>}
     */
    async updateUser(userId, updateData) {
        try {
            const userDoc = await this.db.collection('users').doc(userId).get();

            if (!userDoc.exists) {
                throw new NotFoundError('User');
            }

            const allowedFields = ['username', 'fullName', 'phone', 'phoneNumber', 'role'];
            const updates = {};

            // Handle standard fields
            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    updates[field] = updateData[field];
                    // Sync username with fullName and phone with phoneNumber for compatibility
                    if (field === 'username') updates.fullName = updateData[field];
                    if (field === 'phone') updates.phoneNumber = updateData[field];
                }
            }

            // Handle password update
            if (updateData.password) {
                // Update Firebase Auth password
                await this.auth.updateUser(userId, {
                    password: updateData.password
                });

                // Update hashed password in Firestore (for backup/reference)
                const hashedPassword = await bcrypt.hash(updateData.password, 10);
                updates.hashedPassword = hashedPassword;

                logger.info(`Password updated for user: ${userId}`);
            }

            // If we have any updates to apply
            if (Object.keys(updates).length > 0) {
                updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                await this.db.collection('users').doc(userId).update(updates);
                logger.info(`User updated: ${userId}`, Object.keys(updates));
            }

            return await this.getUserById(userId);
        } catch (error) {
            logger.error('Update user error:', error);
            throw error;
        }
    }
}

module.exports = new AuthService();
