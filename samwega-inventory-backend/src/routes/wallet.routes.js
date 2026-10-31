const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimit.middleware');

// Everyone logged in (including sales persons on the POS) can read wallets
router.get('/', verifyToken, walletController.getAll);

// Only admin can add wallets or switch them active/inactive
router.post('/', verifyToken, requireRole('admin'), writeLimiter, walletController.create);
router.patch('/:id/active', verifyToken, requireRole('admin'), writeLimiter, walletController.setActive);

module.exports = router;
