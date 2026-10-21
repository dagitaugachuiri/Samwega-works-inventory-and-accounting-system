const { getFirestore, admin } = require('../config/firebase.config');
const debtSync = require('./debt-sync.service');
const logger = require('../utils/logger');
const { ValidationError } = require('../utils/errors');

const COLLECTION = 'sms_optouts';

// Turns any Kenyan number (07..., 254..., +254...) into +2547XXXXXXXX
const normalizePhone = (phone) => {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length < 9) return null;
    return `+254${digits.slice(-9)}`;
};

class OptOutService {
    constructor() {
        this.db = getFirestore();
    }

    /**
     * True if this number must not receive messages.
     * Fails closed: if the check cannot be made, nothing is sent.
     */
    async isStopped(phone) {
        const key = normalizePhone(phone);
        if (!key) return false;
        try {
            const snap = await this.db.collection(COLLECTION).doc(key).get();
            return snap.exists;
        } catch (error) {
            logger.error(`[OptOut] Check failed, not sending: ${error.message}`);
            return true;
        }
    }

    async setStopped(phone, stopped, userId) {
        const key = normalizePhone(phone);
        if (!key) throw new ValidationError('Invalid phone number');

        // Debt system first: if it fails, nothing is changed here, so a retry is safe
        await debtSync.setSmsOptout(key, stopped, userId);

        const ref = this.db.collection(COLLECTION).doc(key);
        if (stopped) {
            await ref.set({
                phone: key,
                stoppedBy: userId,
                stoppedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await ref.delete();
        }
        return key;
    }
}

module.exports = { optOutService: new OptOutService(), normalizePhone };