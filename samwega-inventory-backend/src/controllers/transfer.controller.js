const transferService = require('../services/transfer.service');
const { successResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Create new transfer
 */
const createTransfer = async (req, res, next) => {
    try {
        const transfer = await transferService.createTransfer(req.body, req.user.uid);
        res.status(201).json(successResponse(transfer, 'Transfer created successfully'));
    } catch (error) {
        logger.error('Create transfer controller error:', error);
        next(error);
    }
};

/**
 * Get all transfers
 */
const getAllTransfers = async (req, res, next) => {
    try {
        const result = await transferService.getAllTransfers(req.query);
        res.json(successResponse(result, 'Transfers retrieved successfully'));
    } catch (error) {
        logger.error('Get all transfers controller error:', error);
        next(error);
    }
};

/**
 * Get transfer by ID
 */
const getTransferById = async (req, res, next) => {
    try {
        const transfer = await transferService.getTransferById(req.params.id);
        res.json(successResponse(transfer, 'Transfer retrieved successfully'));
    } catch (error) {
        logger.error('Get transfer by ID controller error:', error);
        next(error);
    }
};

/**
 * Approve transfer
 */
const approveTransfer = async (req, res, next) => {
    try {
        const transfer = await transferService.approveTransfer(req.params.id, req.user.uid);
        res.json(successResponse(transfer, 'Transfer approved successfully'));
    } catch (error) {
        logger.error('Approve transfer controller error:', error);
        next(error);
    }
};

/**
 * Confirm transfer
 */
const confirmTransfer = async (req, res, next) => {
    try {
        const transfer = await transferService.confirmTransfer(req.params.id, req.user.uid);
        res.json(successResponse(transfer, 'Transfer confirmed successfully'));
    } catch (error) {
        logger.error('Confirm transfer controller error:', error);
        next(error);
    }
};

/**
 * Collect transfer layer
 */
const collectTransferLayer = async (req, res, next) => {
    try {
        const { id, itemIndex, layerIndex } = req.params;
        const result = await transferService.collectTransferLayer(
            id,
            parseInt(itemIndex),
            parseInt(layerIndex),
            req.user.uid
        );
        res.json(successResponse(result, 'Item collected successfully'));
    } catch (error) {
        logger.error('Collect transfer layer controller error:', error);
        next(error);
    }
};

/**
 * Break unit
 */
const breakUnit = async (req, res, next) => {
    try {
        const result = await transferService.breakUnit(req.params.id, req.body, req.user.uid);
        res.json(successResponse(result, 'Unit breakdown completed successfully'));
    } catch (error) {
        logger.error('Break unit controller error:', error);
        next(error);
    }
};

/**
 * Get pending transfers
 */
const getPendingTransfers = async (req, res, next) => {
    try {
        const transfers = await transferService.getPendingTransfers();
        res.json(successResponse(transfers, 'Pending transfers retrieved successfully'));
    } catch (error) {
        logger.error('Get pending transfers controller error:', error);
        next(error);
    }
};

/**
 * Get collected items for a vehicle
 */
const getCollectedItems = async (req, res, next) => {
    try {
        const items = await transferService.getCollectedItems(req.params.id);
        res.json(successResponse(items, 'Collected items retrieved successfully'));
    } catch (error) {
        logger.error('Get collected items controller error:', error);
        next(error);
    }
};

module.exports = {
    createTransfer,
    getAllTransfers,
    getTransferById,
    approveTransfer,
    confirmTransfer,
    collectTransferLayer,
    breakUnit,
    getPendingTransfers,
    getCollectedItems
};
