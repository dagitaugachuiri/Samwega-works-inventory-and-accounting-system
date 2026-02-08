require('dotenv').config();

module.exports = {
    // Server Configuration
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 8080,

    // Firebase Configuration
    FIREBASE: {
        PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
        CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
        DB_URL: process.env.FIREBASE_DB_URL,
        API_KEY: process.env.FIREBASE_API_KEY
    },

    // TextSMS API Configuration
    TEXTSMS: {
        API_KEY: process.env.TEXTSMS_API_KEY,
        PARTNER_ID: process.env.TEXTSMS_PARTNER_ID,
        SENDER_ID: process.env.TEXTSMS_SENDER_ID,
        API_URL: 'https://sms.textsms.co.ke/api/services/sendsms/'
    },

    // Cloudinary Configuration
    CLOUDINARY: {
        CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
        API_KEY: process.env.CLOUDINARY_API_KEY,
        API_SECRET: process.env.CLOUDINARY_API_SECRET
    },

    // JWT Configuration
    JWT: {
        SECRET: process.env.JWT_SECRET,
        EXPIRY: process.env.JWT_EXPIRY || '1h',
        REFRESH_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d'
    },

    // Rate Limiting
    RATE_LIMIT: {
        WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000
    }
};
