const { admin } = require('../config/firebase.config');

/**
 * Serialize Firestore timestamp to ISO string
 * @param {admin.firestore.Timestamp} timestamp
 * @returns {string|null}
 */
const serializeTimestamp = (timestamp) => {
    if (!timestamp) return null;
    if (timestamp.toDate) {
        return timestamp.toDate().toISOString();
    }
    return timestamp;
};

/**
 * Serialize Firestore document to plain object
 * @param {admin.firestore.DocumentSnapshot} doc
 * @returns {Object}
 */
const serializeDoc = (doc) => {
    if (!doc.exists) {
        return null;
    }

    const data = doc.data();
    const serialized = { id: doc.id };

    for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && value.toDate) {
            // Firestore Timestamp
            serialized[key] = serializeTimestamp(value);
        } else if (Array.isArray(value)) {
            // Array - check each item for timestamps
            serialized[key] = value.map(item => {
                if (item && typeof item === 'object') {
                    const serializedItem = {};
                    for (const [k, v] of Object.entries(item)) {
                        serializedItem[k] = (v && typeof v === 'object' && v.toDate)
                            ? serializeTimestamp(v)
                            : v;
                    }
                    return serializedItem;
                }
                return item;
            });
        } else {
            serialized[key] = value;
        }
    }

    return serialized;
};

/**
 * Serialize multiple Firestore documents
 * @param {admin.firestore.QuerySnapshot} snapshot
 * @returns {Array<Object>}
 */
const serializeDocs = (snapshot) => {
    return snapshot.docs.map(doc => serializeDoc(doc)).filter(doc => doc !== null);
};

module.exports = {
    serializeTimestamp,
    serializeDoc,
    serializeDocs
};
