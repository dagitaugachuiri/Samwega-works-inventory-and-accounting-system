/**
 * Script to clear supplier cache
 */

const { getFirestore } = require('../src/config/firebase.config');
const { initializeFirebase } = require('../src/config/firebase.config');
const cache = require('../src/utils/cache');

async function clearSupplierCache() {
    try {
        initializeFirebase();

        console.log('🔄 Clearing supplier cache...\n');

        // Clear all supplier-related cache
        await cache.delPattern('supplier:*');

        console.log('✅ Supplier cache cleared!');
        console.log('💡 Try refreshing the frontend now.\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

clearSupplierCache();
