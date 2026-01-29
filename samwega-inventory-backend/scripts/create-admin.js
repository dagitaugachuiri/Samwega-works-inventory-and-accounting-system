const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function createAdminUser() {
    try {
        // Create user in Firebase Auth
        let userRecord;
        try {
            userRecord = await auth.createUser({
                email: 'admin@samwega.com',
                password: 'admin123',
                displayName: 'System Administrator'
            });
            console.log('✅ Firebase Auth user created');
        } catch (error) {
            if (error.code === 'auth/email-already-exists') {
                console.log('⚠️  User already exists in Firebase Auth, fetching...');
                userRecord = await auth.getUserByEmail('admin@samwega.com');
            } else {
                throw error;
            }
        }

        // Create/Update user document in Firestore
        const adminUser = {
            email: 'admin@samwega.com',
            username: 'admin',
            fullName: 'System Administrator',
            phoneNumber: '+254700000000',
            phone: '+254700000000',
            role: 'admin',
            isActive: true,
            isVerified: true,
            assignedVehicleId: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('users').doc(userRecord.uid).set(adminUser, { merge: true });

        console.log('\n═══════════════════════════════════════════');
        console.log('✅ Admin user created successfully!');
        console.log('═══════════════════════════════════════════');
        console.log('📧 Email: admin@samwega.com');
        console.log('🔑 Password: admin123');
        console.log('🆔 User ID:', userRecord.uid);
        console.log('👤 Role: admin');
        console.log('═══════════════════════════════════════════');
        console.log('\n⚠️  Please change the password after first login!');
        console.log('✨ You can now login at http://localhost:3000/login\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admin user:', error);
        process.exit(1);
    }
}

createAdminUser();
