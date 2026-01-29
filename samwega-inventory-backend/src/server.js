const app = require('./app');
const config = require('./config/environment');
const logger = require('./utils/logger');

const PORT = config.PORT;

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info('═══════════════════════════════════════════════════════');
    logger.info(`🚀 SAMWEGA BACKEND SERVER STARTED`);
    logger.info('═══════════════════════════════════════════════════════');
    logger.info(`📍 Environment: ${config.NODE_ENV}`);
    logger.info(`🌐 Server running on: http://0.0.0.0:${PORT}`);
    logger.info(`🏥 Health check: http://0.0.0.0:${PORT}/health`);
    logger.info(`📚 API Base URL: http://0.0.0.0:${PORT}/api`);
    logger.info('═══════════════════════════════════════════════════════');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // In production, you might want to exit the process
    if (config.NODE_ENV === 'production') {
        process.exit(1);
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // In production, exit the process
    if (config.NODE_ENV === 'production') {
        process.exit(1);
    }
});

module.exports = server;
