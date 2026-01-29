const axios = require('axios');
const config = require('./environment');
const { getFirestore } = require('./firebase.config');
const { admin } = require('./firebase.config');

class TextSMSService {
    constructor() {
        console.log('🚀 Initializing TextSMS Service...');

        this.config = {
            apiKey: config.TEXTSMS.API_KEY,
            partnerID: config.TEXTSMS.PARTNER_ID,
            shortcode: config.TEXTSMS.SENDER_ID,
            apiUrl: config.TEXTSMS.API_URL
        };

        console.log('📋 TextSMS Service Configuration:');
        console.log(`   - API Key: ${this.config.apiKey ? '***CONFIGURED***' : 'NOT SET'}`);
        console.log(`   - Partner ID: ${this.config.partnerID || 'NOT SET'}`);
        console.log(`   - Sender ID: ${this.config.shortcode}`);

        if (!this.config.apiKey || !this.config.partnerID) {
            console.warn('⚠️  TextSMS credentials not configured');
        }
    }

    /**
     * Send SMS message
     * @param {string} phone - Recipient phone number
     * @param {string} message - SMS message content
     * @returns {Promise<Object>}
     */
    async sendSMS(phone, message) {
        try {
            if (!this.config.apiKey || !this.config.partnerID) {
                throw new Error('TextSMS credentials not configured');
            }

            const response = await axios.post(this.config.apiUrl, {
                apikey: this.config.apiKey,
                partnerID: this.config.partnerID,
                message: message,
                shortcode: this.config.shortcode,
                mobile: phone
            });

            // Log notification to Firestore
            const db = getFirestore();
            await db.collection('notifications').add({
                type: 'sms',
                recipient: phone,
                message: message,
                status: 'sent',
                response: response.data,
                sentAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ SMS sent successfully to ${phone}`);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ SMS sending failed:', error.message);

            // Log failed notification
            const db = getFirestore();
            await db.collection('notifications').add({
                type: 'sms',
                recipient: phone,
                message: message,
                status: 'failed',
                error: error.message,
                failedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            throw error;
        }
    }

    /**
     * Send bulk SMS messages
     * @param {Array<{phone: string, message: string}>} messages
     * @returns {Promise<Object>}
     */
    async sendBulkSMS(messages) {
        const results = {
            success: [],
            failed: []
        };

        for (const { phone, message } of messages) {
            try {
                await this.sendSMS(phone, message);
                results.success.push(phone);
            } catch (error) {
                results.failed.push({ phone, error: error.message });
            }
        }

        return results;
    }
}

// Export singleton instance
module.exports = new TextSMSService();
