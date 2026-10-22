const customerService = require('../services/customer.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Create new customer
 */
const createCustomer = async (req, res) => {
    try {
        const customer = await customerService.createCustomer(req.body, req.user.uid);
        return res.status(201).json(successResponse(customer, 'Customer created successfully'));
    } catch (error) {
        logger.error('Create customer controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Get all customers
 */
const getAllCustomers = async (req, res) => {
    try {
        const result = await customerService.getAllCustomers(req.query, req.user);
        return res.status(200).json(successResponse(result, 'Customers retrieved successfully'));
    } catch (error) {
        logger.error('Get all customers controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Search customers (autocomplete)
 */
const searchCustomers = async (req, res) => {
    try {
        const { q, limit, vehicleId } = req.query;
        const customers = await customerService.searchCustomers(q, limit, vehicleId);
        return res.status(200).json(successResponse({ customers }, 'Customers found successfully'));
    } catch (error) {
        logger.error('Search customers controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Get customer by ID
 */
const getCustomerById = async (req, res) => {
    try {
        const customer = await customerService.getCustomerById(req.params.id, req.user);
        return res.status(200).json(successResponse(customer, 'Customer retrieved successfully'));
    } catch (error) {
        logger.error('Get customer by ID controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};
    
const getCustomersByVehicle = async (req, res) => {
    try {
        const vehicles = await customerService.getCustomersGroupedByVehicle(req.user);
        return res.status(200).json(successResponse({ vehicles }, 'Customers by vehicle retrieved'));
    } catch (error) {
        logger.error('Get customers by vehicle controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};
/**
 * Update customer
 */
const updateCustomer = async (req, res) => {
    try {
        const customer = await customerService.updateCustomer(req.params.id, req.body);
        return res.status(200).json(successResponse(customer, 'Customer updated successfully'));
    } catch (error) {
        logger.error('Update customer controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};
const setMessagesStopped = async (req, res) => {
    try {
        const stopped = req.body.stopped;
        const customer = await customerService.setMessagesStopped(req.params.id, stopped, req.user.uid);
        return res.status(200).json(successResponse(customer, stopped ? 'Messages stopped' : 'Messages resumed'));
    } catch (error) {
        logger.error('Set messages stopped controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Delete customer
 */
const deleteCustomer = async (req, res) => {
    try {
        await customerService.deleteCustomer(req.params.id);
        return res.status(200).json(successResponse(null, 'Customer deleted successfully'));
    } catch (error) {
        logger.error('Delete customer controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Record customer payment
 */
const recordPayment = async (req, res) => {
    try {
        const customer = await customerService.recordPayment(req.params.id, req.body.amount);
        return res.status(200).json(successResponse(customer, 'Payment recorded successfully'));
    } catch (error) {
        logger.error('Record payment controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

const getSummary = async (req, res) => {
    try {
        const summary = await customerService.getSummary(req.user);
        return res.status(200).json(successResponse(summary, 'Summary retrieved'));
    } catch (error) {
        logger.error('Get customer summary controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

module.exports = {
    createCustomer,
    getAllCustomers,
    searchCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    recordPayment,
    getCustomersByVehicle,
    setMessagesStopped,
    getSummary
};
