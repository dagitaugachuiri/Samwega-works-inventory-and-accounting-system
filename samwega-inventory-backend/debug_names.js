const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function run() {
    try {
        console.log("Checking Inventory Names...");
        const snapshot = await db.collection("inventory").limit(10).get();
        snapshot.forEach(doc => {
            const d = doc.data();
            console.log(`ID: ${doc.id}`);
            console.log(`  name: "${d.name}"`);
            console.log(`  productName: "${d.productName}"`);
            console.log(`  itemName: "${d.itemName}"`);
        });
    } catch (err) {
        console.error(err);
    }
}

run();
