/**
 * A simple in-memory cache utility for StarzoMobiles
 */
class CacheService {
    constructor() {
        this.cache = new Map();
        this.ttl = 1000 * 60 * 60; // Default 1 hour
    }

    set(key, value, customTtl = null) {
        const expiry = Date.now() + (customTtl || this.ttl);
        this.cache.set(key, { value, expiry });
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }

        return entry.value;
    }

    delete(key) {
        this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }
}

export const commonCache = new CacheService();
export const CACHE_KEYS = {
    CATEGORIES: 'categories_all',
    PUBLIC_BRANDS: 'brands_public'
};
