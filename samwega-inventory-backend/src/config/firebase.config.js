const admin = require('firebase-admin');
const config = require('./environment');

let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 * @returns {admin.app.App} Firebase app instance
 */
const initializeFirebase = () => {
    if (firebaseApp) {
        return firebaseApp;
    }

    try {
        // Check if service account key file exists
        const serviceAccount = {
    type: 'service_account',
    project_id: config.FIREBASE.PROJECT_ID,
    private_key: config.FIREBASE.PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: config.FIREBASE.CLIENT_EMAIL,
    token_uri: 'https://oauth2.googleapis.com/token'
     };

        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: config.FIREBASE.DB_URL
        });

        console.log('✅ Firebase Admin SDK initialized successfully');
        return firebaseApp;
    } catch (error) {
        console.error('❌ Firebase initialization error:', error.message);
        throw new Error('Failed to initialize Firebase Admin SDK');
    }
};

/**
 * Get Firestore database instance
 * @returns {admin.firestore.Firestore}
 */
const getFirestore = () => {
    if (!firebaseApp) {
        initializeFirebase();
    }
    return admin.firestore();
};

/**
 * Get Firebase Auth instance
 * @returns {admin.auth.Auth}
 */
const getAuth = () => {
    if (!firebaseApp) {
        initializeFirebase();
    }
    return admin.auth();
};

module.exports = {
    initializeFirebase,
    getFirestore,
    getAuth,
    admin
};
