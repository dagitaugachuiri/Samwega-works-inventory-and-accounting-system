/**
 * Script to recalculate supplier financial stats from invoices
 * Run this once to populate supplier totals from existing data
 */

const { getFirestore } = require('../src/config/firebase.config');
const { admin } = require('../src/config/firebase.config');
const { initializeFirebase } = require('../src/config/firebase.config');

// usage: node scripts/recalculate-supplier-financials.js [--dry-run]
const DRY_RUN = process.argv.includes('--dry-run');

async function recalculateSupplierFinancials() {
    try {
        // Initialize Firebase
        initializeFirebase();
        const db = getFirestore();

        console.log(DRY_RUN ? '🔎 DRY RUN - nothing will be saved\n' : '🔄 Starting supplier financial recalculation...\n');

        // Get all suppliers
        const suppliersSnapshot = await db.collection('suppliers').get();
        const suppliers = suppliersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        console.log(`📊 Found ${suppliers.length} suppliers\n`);

        // Get all invoices
        const invoicesSnapshot = await db.collection('invoices').get();
        const invoices = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        console.log(`📄 Found ${invoices.length} invoices\n`);

        // Calculate totals for each supplier
        for (const supplier of suppliers) {
            // voided (reversed) invoices must not count towards supplier totals
            const supplierInvoices = invoices.filter(inv => inv.supplierId === supplier.id && inv.status !== 'voided');

            const totalPurchases = supplierInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
            const totalPaid = supplierInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
            const outstandingBalance = totalPurchases - totalPaid;

            // Update supplier document (skipped with --dry-run, so you can look first)
            if (!DRY_RUN) {
                await db.collection('suppliers').doc(supplier.id).update({
                    totalPurchases,
                    totalPaid,
                    outstandingBalance,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            console.log(`✅ ${supplier.name}:`);
            console.log(`   Invoices: ${supplierInvoices.length}`);
            console.log(`   Total Purchases: KES ${totalPurchases.toLocaleString()}`);
            console.log(`   Total Paid: KES ${totalPaid.toLocaleString()}`);
            console.log(`   Outstanding: KES ${outstandingBalance.toLocaleString()}\n`);
        }

        console.log('✨ Recalculation complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

recalculateSupplierFinancials();
