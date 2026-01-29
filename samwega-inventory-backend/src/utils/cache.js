const logger = require('./logger');

/**
 * No-op cache - caching disabled
 * All methods return null/false to skip caching
 */
class Cache {
    constructor() {
        logger.info('⚠️ Cache disabled - no caching active');
    }

    async get(key) {
        return null;
    }

    async set(key, value, ttl) {
        return true;
    }

    async del(key) {
        return true;
    }

    async delPattern(pattern) {
        return 0;
    }

    async exists(key) {
        return false;
    }

    async getOrSet(key, fn, ttl) {
        return await fn();
    }

    async clear() {
        return true;
    }

    size() {
        return 0;
    }

    cleanup() {
        // No-op
    }
}

module.exports = new Cache();
