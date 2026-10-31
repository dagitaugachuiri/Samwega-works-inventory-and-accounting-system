const walletService = require('../services/wallet.service');
const { successResponse } = require('../utils/response');

class WalletController {
    async getAll(req, res, next) {
        try {
            const includeInactive = req.query.includeInactive === 'true' && req.user?.role === 'admin';
            const wallets = await walletService.getAllWallets({ includeInactive });
            res.json(successResponse(wallets, 'Wallets retrieved successfully'));
        } catch (error) { next(error); }
    }

    async create(req, res, next) {
        try {
            const wallet = await walletService.createWallet(req.body, req.user);
            res.status(201).json(successResponse(wallet, 'Wallet added successfully'));
        } catch (error) { next(error); }
    }

    async setActive(req, res, next) {
        try {
            const wallet = await walletService.setWalletActive(req.params.id, req.body.isActive);
            res.json(successResponse(wallet, wallet.isActive ? 'Wallet activated' : 'Wallet deactivated'));
        } catch (error) { next(error); }
    }
}

module.exports = new WalletController();
