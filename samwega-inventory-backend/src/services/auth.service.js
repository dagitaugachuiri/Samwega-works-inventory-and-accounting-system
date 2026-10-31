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
     * Create a user. Only ever called from the admin-only POST /auth/users route.
     * (There is no public sign-up any more: nobody can create their own account.)
     * @param {Object} userData - email, password, username, role, phone, isVerified
     * @param {Object} createdBy - the admin making the account (req.user)
     * @returns {Promise<Object>} the new user (no login token: the new person logs in themselves)
     */
    async createUser(userData, createdBy = null) {
        let userRecord = null;
        try {
            const { email, password, username, role, phone } = userData;

            const existingUser = await this.db.collection('users')
                .where('email', '==', email)
                .limit(1)
                .get();

            if (!existingUser.empty) {
                throw new ConflictError('User with this email already exists');
            }

            // Create Firebase Auth user
            userRecord = await this.auth.createUser({
                email,
                password,
                displayName: username
            });

            // Hash password for Firestore storage (backup)
            const hashedPassword = await bcrypt.hash(password, 10);

            const userDoc = {
                email,
                username,
                fullName: username, // For frontend compatibility
                role,
                phone: phone || null,
                phoneNumber: phone || null, // For frontend compatibility
                hashedPassword,
                // activation is an admin decision; accounts an admin creates are active unless said otherwise
                isVerified: userData.isVerified !== false,
                isDisabled: false,
                assignedVehicleId: null,
                createdBy: createdBy ? (createdBy.uid || null) : null,
                createdByName: createdBy ? (createdBy.username || createdBy.email || null) : null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            try {
                await this.db.collection('users').doc(userRecord.uid).set(userDoc);
            } catch (dbError) {
                // don't leave a login behind that has no profile
                await this.auth.deleteUser(userRecord.uid).catch(() => {});
                throw dbError;
            }

            logger.info(`User created by admin: ${email}`, { userId: userRecord.uid, role });

            return {
                uid: userRecord.uid,
                id: userRecord.uid,
                email,
                username,
                role,
                isVerified: userDoc.isVerified
            };
        } catch (error) {
            logger.error('Create user error:', error);

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
     * Permanently delete a user (admin only). Their name stays in old activity-log entries
     * and on records they created, because those store the name as text.
     * Disabling is the normal way to remove access; delete is for mistakes and accounts that no longer exist.
     * @param {string} userId
     * @param {Object} actingUser - req.user (the admin doing it)
     */
    async deleteUser(userId, actingUser) {
        if (actingUser && actingUser.uid === userId) {
            throw new ValidationError('You cannot delete your own account');
        }

        const ref = this.db.collection('users').doc(userId);
        const doc = await ref.get();
        // A login can exist with no profile ("non-existing" user): still allow cleaning it up
        const data = doc.exists ? doc.data() : null;

        if (data && data.role === 'admin') {
            const admins = await this.db.collection('users').where('role', '==', 'admin').get();
            const otherAdmins = admins.docs.filter(d => d.id !== userId);
            if (otherAdmins.length === 0) {
                throw new ValidationError('You cannot delete the last admin');
            }
        }

        let authDeleted = false;
        try {
            await this.auth.deleteUser(userId);
            authDeleted = true;
        } catch (e) {
            if (e.code !== 'auth/user-not-found') throw e;
        }
        if (!doc.exists && !authDeleted) {
            throw new NotFoundError('User');
        }

        // Free up the vehicle this person was assigned to
        const vehicleFields = ['assignedDriverId', 'assignedUserId'];
        for (const field of vehicleFields) {
            const vs = await this.db.collection('vehicles').where(field, '==', userId).get();
            for (const v of vs.docs) {
                await v.ref.update({ [field]: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            }
        }

        if (doc.exists) await ref.delete();

        logger.info(`User deleted: ${userId}`, { by: actingUser && actingUser.uid });
        return {
            id: userId,
            username: data ? (data.username || data.fullName || data.email) : null,
            email: data ? data.email : null,
            role: data ? data.role : null
        };
    }

  /**
     * Login user
     * @param {string} email
     * @param {string} password
     * @returns {Promise<Object>}
     */
    async login(email, password) {
        try {
            // 1. Authenticate with Firebase Auth REST API to get ID Token
            const authResponse = await this.verifyPasswordWithFirebase(email, password);
            if (!authResponse.success) {
                throw new AuthenticationError('Invalid email or password');
            }
            const firebaseIdToken = authResponse.data.idToken;

            // 2. Get User Record to verify existence and get UID
            const userRecord = await this.auth.getUserByEmail(email);

            // 3. Get user data from Firestore
            const userDoc = await this.db.collection('users').doc(userRecord.uid).get();

            if (!userDoc.exists) {
                throw new AuthenticationError('User data not found');
            }

            const userData = userDoc.data();

            // Check if user is verified
            if (!userData.isVerified) {
                throw new AuthenticationError('Account not verified. Please contact administrator.');
            }

            // Check if user is disabled
            if (userData.isDisabled) {
                throw new AuthenticationError('Account disabled. Please contact administrator.');
            }

            // Generate custom JWT token for Inventory Backend APIs
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
                token,
                firebaseToken: firebaseIdToken
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
            const role = userData.role;

            // Case 1: Unassign vehicle (vehicleId is null)
            if (!vehicleId) {
                // If user had a vehicle, unassign from it
                if (oldVehicleId) {
                    await vehicleService.unassignUser(oldVehicleId, role);
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
                await vehicleService.unassignUser(oldVehicleId, role);
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

            const allowedFields = ['username', 'fullName', 'phone', 'phoneNumber', 'role', 'isDisabled'];
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
