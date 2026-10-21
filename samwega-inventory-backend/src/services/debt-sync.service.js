const axios = require('axios');
const logger = require('../utils/logger');
const { ExternalServiceError } = require('../utils/errors');

/**
 * Keeps the debt server's records in step with this system.
 * DEBT_API_URL already ends in /api, e.g. https://samwega-works-debt-server.onrender.com/api
 * Every call throws unless the debt server confirms, so callers can stop before changing anything here.
 */
class DebtSyncService {
    client() {
        const base = process.env.DEBT_API_URL;
        if (!base) {
            const err = new ExternalServiceError('DEBT_API_URL is not set');
            err.statusCode = 500;
            throw err;
        }
        return axios.create({
            baseURL: base.endsWith('/') ? base : `${base}/`,
            timeout: 60000,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    async post(path, body) {
        try {
            const res = await this.client().post(path, body);
            return res.data;
        } catch (error) {
            logger.error(`[DebtSync] POST ${path} failed: ${error.message}`);
            const err = new ExternalServiceError('The debt system did not confirm the change. Nothing was saved. Please try again.');
            err.statusCode = 502;
            throw err;
        }
    }

    setSmsOptout(phone, stopped, userId) {
        return this.post('sms-optouts', { phone, stopped, by: userId });
    }

    relinkPhone(oldPhone, newPhone) {
        return this.post('customers/relink-phone', { oldPhone, newPhone });
    }

    unlinkPhone(phone) {
        return this.post('customers/unlink-phone', { phone });
    }
}

module.exports = new DebtSyncService();
