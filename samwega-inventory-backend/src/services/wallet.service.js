const { getFirestore, admin } = require('../config/firebase.config');
const logger = require('../utils/logger');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/errors');
const { serializeDoc } = require('../utils/serializer');

// Wallets that existed before this feature (were hardcoded in the POS app).
// Seeded automatically the first time wallets are requested.
const DEFAULT_BANK_WALLETS = ['Equity', 'Old KCB', 'New KCB', 'Old Absa', 'New Absa', 'Family'];

class WalletService {
    constructor() {
        this.db = getFirestore();
        this.collection = 'paymentWallets';
    }

    async _seedDefaultsIfEmpty() {
        const snap = await this.db.collection(this.collection).limit(1).get();
        if (!snap.empty) return;
        const batch = this.db.batch();
        DEFAULT_BANK_WALLETS.forEach((name) => {
            const ref = this.db.collection(this.collection).doc();
            batch.set(ref, {
                name,
                nameLower: name.toLowerCase(),
                type: 'bank',
                isActive: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        logger.info('Seeded default payment wallets');
    }

    /**
     * Bank-type wallets selectable when paying by "bank".
     * Cash and M-Pesa are built in and not stored here.
     * By default only active wallets are returned; admins can ask for all.
     */
    async getAllWallets({ includeInactive = false } = {}) {
        await this._seedDefaultsIfEmpty();
        const snap = await this.db.collection(this.collection).get();
        return snap.docs
            .map((d) => serializeDoc(d))
            .map((w) => ({ ...w, isActive: w.isActive !== false })) // older docs count as active
            .filter((w) => includeInactive || w.isActive)
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    async createWallet({ name }, user) {
        const clean = String(name || '').trim();
        if (!clean) throw new ValidationError('Wallet name is required', 'name');
        if (clean.length > 40) throw new ValidationError('Wallet name is too long (max 40 characters)', 'name');

        const lower = clean.toLowerCase();
        if (['cash', 'mpesa', 'm-pesa', 'credit', 'debt', 'mixed', 'bank'].includes(lower)) {
            throw new ValidationError(`"${clean}" is a reserved name`, 'name');
        }

        await this._seedDefaultsIfEmpty();
        const existing = await this.db.collection(this.collection)
            .where('nameLower', '==', lower).limit(1).get();
        if (!existing.empty) {
            const isActive = existing.docs[0].data().isActive !== false;
            throw new ConflictError(isActive
                ? 'A wallet with this name already exists'
                : 'A wallet with this name exists but is inactive. Reactivate it instead.');
        }

        const ref = await this.db.collection(this.collection).add({
            name: clean,
            nameLower: lower,
            type: 'bank',
            isActive: true,
            createdBy: user?.uid || user?.id || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info(`Payment wallet created: ${clean}`, { id: ref.id });
        return serializeDoc(await ref.get());
    }

    async setWalletActive(id, isActive) {
        if (typeof isActive !== 'boolean') throw new ValidationError('isActive must be true or false', 'isActive');
        const ref = this.db.collection(this.collection).doc(id);
        const doc = await ref.get();
        if (!doc.exists) throw new NotFoundError('Wallet not found');
        await ref.update({
            isActive,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info(`Payment wallet ${isActive ? 'activated' : 'deactivated'}: ${doc.data().name}`, { id });
        // Past sales keep their bankName, so history and reports are unaffected.
        return serializeDoc(await ref.get());
    }
}

module.exports = new WalletService();
