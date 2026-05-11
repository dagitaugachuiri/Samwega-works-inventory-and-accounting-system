const textSMSService = require('../config/textsms.config');
const logger = require('../utils/logger');

class SmsService {
    /**
     * Format phone number to international format (+254...)
     * @param {string|number} phone 
     * @returns {string|null}
     */
    formatPhone(phone) {
        if (!phone) return null;
        let p = phone.toString().replace(/\s+/g, '');
        if (p.startsWith('+254')) return p;
        if (p.startsWith('254')) return '+' + p;
        if (p.startsWith('0')) return '+254' + p.substring(1);
        if (p.length === 9) return '+254' + p; // Handle 7xxxxxxxx
        return '+254' + p;
    }

    /**
     * Send sale confirmation SMS to customer
     * @param {Object} sale 
     * @returns {Promise<void>}
     */
    async sendSaleConfirmationSMS(sale) {
        if (!sale.customerPhone) return;

        try {
            const phone = this.formatPhone(sale.customerPhone);
            if (!phone) return;

            // Format date for SMS (e.g., 11 May 2026)
            const dateStr = sale.saleDate ? new Date(sale.saleDate).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            }) : new Date().toLocaleDateString('en-GB');
            
            const amountStr = Math.floor(sale.grandTotal).toLocaleString();
            
            const message = `Hello ${sale.customerName || 'Customer'}, your purchase of KSh ${amountStr} (Receipt: ${sale.receiptNumber}) on ${dateStr} was successful. Thank you for shopping with Samwega.`;
            
            logger.info(`[SmsService] Sending sale confirmation SMS to ${phone}`);
            await textSMSService.sendSMS(phone, message);
        } catch (error) {
            logger.error(`[SmsService] Failed to send sale confirmation SMS: ${error.message}`);
        }
    }

    /**
     * Send debt/invoice notification SMS
     * @param {Object} debt 
     * @returns {Promise<void>}
     */
    async sendDebtNotificationSMS(debt) {
        if (!debt.storeOwner?.phoneNumber) return;

        try {
            const phone = this.formatPhone(debt.storeOwner.phoneNumber);
            if (!phone) return;

            const amountStr = Math.floor(debt.remainingAmount || debt.amount).toLocaleString();
            const dueDate = debt.dueDate ? new Date(debt.dueDate).toLocaleDateString('en-GB') : 'N/A';
            
            const message = `Hello ${debt.storeOwner.name}, you have an outstanding debt of KSh ${amountStr} (Code: ${debt.debtCode}). Due date: ${dueDate}. Please settle as soon as possible. Thank you.`;
            
            logger.info(`[SmsService] Sending debt notification SMS to ${phone}`);
            await textSMSService.sendSMS(phone, message);
        } catch (error) {
            logger.error(`[SmsService] Failed to send debt notification SMS: ${error.message}`);
        }
    }
}

module.exports = new SmsService();
