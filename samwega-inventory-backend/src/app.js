const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./config/environment');
const logger = require('./utils/logger');

// Import middleware
const { morganMiddleware, requestLogger } = require('./middleware/logging.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const { apiLimiter } = require('./middleware/rateLimit.middleware');

// Import routes
const routes = require('./routes');

// Initialize configurations
const { initializeFirebase } = require('./config/firebase.config');


// Create Express app
const app = express();

// Initialize services
logger.info('🚀 Initializing Samwega Backend...');
initializeFirebase();


// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for API
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: '*', // Configure this in production
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morganMiddleware);
app.use(requestLogger);

// Rate limiting
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Samwega Backend is healthy',
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV
    });
});

// API routes
app.use('/api', routes);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
