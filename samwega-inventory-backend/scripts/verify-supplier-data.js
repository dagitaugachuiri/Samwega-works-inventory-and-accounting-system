/**
 * Script to verify supplier data in Firestore
 */

const { getFirestore } = require('../src/config/firebase.config');
const { initializeFirebase } = require('../src/config/firebase.config');

async function verifySupplierData() {
    try {
        initializeFirebase();
        const db = getFirestore();

        console.log('🔍 Fetching supplier data from Firestore...\n');

        const suppliersSnapshot = await db.collection('suppliers').get();

        console.log(`📊 Total suppliers: ${suppliersSnapshot.docs.length}\n`);

        suppliersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`===== ${data.name} (${doc.id}) =====`);
            console.log(`Total Purchases: ${data.totalPurchases !== undefined ? 'KES ' + data.totalPurchases : 'UNDEFINED'}`);
            console.log(`Total Paid: ${data.totalPaid !== undefined ? 'KES ' + data.totalPaid : 'UNDEFINED'}`);
            console.log(`Outstanding Balance: ${data.outstandingBalance !== undefined ? 'KES ' + data.outstandingBalance : 'UNDEFINED'}`);
            console.log(`Contact: ${data.phone || 'N/A'}`);
            console.log('');
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

verifySupplierData();
