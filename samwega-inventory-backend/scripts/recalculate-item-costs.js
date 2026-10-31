/**
 * Rebuilds each product's unit cost (buyingPrice) as a MOVING AVERAGE from its purchase history.
 *
 * Why: until now every receipt overwrote the product's buying price with the newest invoice price,
 * so stock value (stock x buying price) dropped whenever a cheaper invoice came in, and stayed wrong
 * after the invoice was deleted. New receipts now average correctly; this script repairs the products
 * that were already damaged.
 *
 * It replays the purchase records (stock_adjustments, reason "purchase") oldest to newest:
 *     cost = (stock before x cost so far + this invoice's cost) / (stock before + pieces received)
 * Reversed invoices are skipped. Products with no purchase records are left alone.
 *
 * SAFE BY DEFAULT: it only reports (and writes item-cost-report.csv). Nothing changes unless you add --apply,
 * and --apply makes you type the Firebase project id first.
 *
 *   DOTENV_CONFIG_PATH=.env.test node -r dotenv/config scripts/recalculate-item-costs.js
 *   DOTENV_CONFIG_PATH=.env.test node -r dotenv/config scripts/recalculate-item-costs.js --apply
 */
const fs = require('fs');
const readline = require('readline');

/** @param {Array} entries purchase records for ONE product, any order */
function replayCost(entries) {
    const sorted = [...entries].sort((a, b) => a.time - b.time);
    let avg = 0;
    for (const e of sorted) {
        const pieces = e.adjustment;
        const cost = (e.itemCost !== undefined && e.itemCost !== null) ? e.itemCost : (e.buyingPrice || 0) * pieces;
        if (!(pieces > 0) || !(cost > 0)) continue;
        const prev = Math.max(0, e.previousStock || 0);
        avg = (prev > 0 && avg > 0) ? (prev * avg + cost) / (prev + pieces) : cost / pieces;
    }
    return Math.round(avg * 100) / 100;
}

module.exports = { replayCost };

if (require.main === module) {
    const admin = require('firebase-admin');
    const APPLY = process.argv.includes('--apply');
    const projectId = process.env.FIREBASE_PROJECT_ID || '';

    admin.initializeApp({
        credential: admin.credential.cert({
            type: 'service_account',
            project_id: projectId,
            private_key: Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf-8'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            token_uri: 'https://oauth2.googleapis.com/token'
        })
    });
    const db = admin.firestore();
    const toMs = (v) => (v && v.toMillis ? v.toMillis() : (v ? new Date(v).getTime() : 0));
    const ask = (q) => new Promise(r => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, a => { rl.close(); r(a); }); });

    (async () => {
        console.log(`Firebase project: ${projectId}`);
        console.log(APPLY ? 'MODE: APPLY (will write)\n' : 'MODE: report only (nothing is changed)\n');

        const [voided, purchases, items] = await Promise.all([
            db.collection('invoices').where('status', '==', 'voided').get(),
            db.collection('stock_adjustments').where('reason', '==', 'purchase').get(),
            db.collection('inventory').get()
        ]);
        const voidedIds = new Set(voided.docs.map(d => d.id));

        const byItem = new Map();
        purchases.docs.forEach(d => {
            const a = d.data();
            if (!a.inventoryId || !(a.adjustment > 0) || voidedIds.has(a.invoiceId)) return;
            const list = byItem.get(a.inventoryId) || [];
            list.push({ ...a, time: toMs(a.createdAt) });
            byItem.set(a.inventoryId, list);
        });

        const rows = [];
        for (const doc of items.docs) {
            const it = doc.data();
            const entries = byItem.get(doc.id);
            if (!entries || !entries.length) continue;
            const suggested = replayCost(entries);
            const current = Number(it.buyingPrice) || 0;
            if (!(suggested > 0)) continue;
            const stock = Number(it.stock) || 0;
            const changed = !current || Math.abs(suggested - current) / current > 0.02;
            rows.push({ id: doc.id, name: it.productName || it.name || doc.id, stock, current, suggested, valueNow: stock * current, valueNew: stock * suggested, changed, hasPerUnit: it.buyingPricePerUnit !== undefined });
        }

        const changes = rows.filter(r => r.changed);
        console.table(changes.slice(0, 60).map(r => ({
            product: r.name.slice(0, 28), stock: r.stock, 'cost now': r.current, 'cost new': r.suggested,
            'value now': Math.round(r.valueNow), 'value new': Math.round(r.valueNew)
        })));
        if (changes.length > 60) console.log(`... and ${changes.length - 60} more (see the CSV)`);
        const totalNow = rows.reduce((s, r) => s + r.valueNow, 0);
        const totalNew = rows.reduce((s, r) => s + r.valueNew, 0);
        console.log(`\nProducts checked: ${rows.length}, would change: ${changes.length}`);
        console.log(`Stock value of checked products: ${Math.round(totalNow).toLocaleString()} now -> ${Math.round(totalNew).toLocaleString()} after`);

        fs.writeFileSync('item-cost-report.csv',
            'product,stock,cost_now,cost_new,value_now,value_new,will_change\n' +
            rows.map(r => [JSON.stringify(r.name), r.stock, r.current, r.suggested, Math.round(r.valueNow), Math.round(r.valueNew), r.changed].join(',')).join('\n'));
        console.log('Full list saved to item-cost-report.csv');

        if (!APPLY) { console.log('\nNothing was changed. Run again with --apply to write these costs.'); process.exit(0); }
        if (!changes.length) { console.log('Nothing to apply.'); process.exit(0); }

        const typed = await ask(`\nType the Firebase project id (${projectId}) to apply ${changes.length} changes: `);
        if (typed.trim() !== projectId) { console.log('Project id did not match. Nothing was changed.'); process.exit(1); }

        for (let i = 0; i < changes.length; i += 400) {
            const batch = db.batch();
            changes.slice(i, i + 400).forEach(r => {
                const u = { buyingPrice: r.suggested, costRepairedAt: admin.firestore.FieldValue.serverTimestamp() };
                if (r.hasPerUnit) u.buyingPricePerUnit = r.suggested;
                batch.update(db.collection('inventory').doc(r.id), u);
            });
            await batch.commit();
        }
        console.log(`Done. ${changes.length} products updated.`);
        process.exit(0);
    })().catch(e => { console.error(e); process.exit(1); });
}
