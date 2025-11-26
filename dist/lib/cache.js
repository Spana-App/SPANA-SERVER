"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get = get;
exports.set = set;
exports.del = del;
// Simple cache abstraction - uses Redis if available, otherwise in-memory
// Lazy load Redis functions to avoid circular dependency
let redisGet, redisSet, redisDel;
function getRedisFunctions() {
    if (!redisGet) {
        try {
            const server = require('../server');
            redisGet = server.redisGet || (async () => null);
            redisSet = server.redisSet || (async () => { });
            redisDel = server.redisDel || (async () => { });
        }
        catch (err) {
            redisGet = async () => null;
            redisSet = async () => { };
            redisDel = async () => { };
        }
    }
    return { redisGet, redisSet, redisDel };
}
// In-memory cache fallback
const memoryCache = new Map();
// Get from cache
async function get(key) {
    try {
        // Try Redis first if available
        const { redisGet: getRedis } = getRedisFunctions();
        const redisValue = await getRedis(key);
        if (redisValue) {
            return typeof redisValue === 'string' ? JSON.parse(redisValue) : redisValue;
        }
    }
    catch (err) {
        // Redis not available, fall back to memory
    }
    // Fall back to memory cache
    const cached = memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
        return cached.value;
    }
    // Expired or not found
    if (cached) {
        memoryCache.delete(key);
    }
    return null;
}
// Set cache value
async function set(key, value, expiry, ttl) {
    const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
    try {
        // Try Redis first if available
        const { redisSet: setRedis } = getRedisFunctions();
        if (expiry === 'EX' && ttl) {
            await setRedis(key, valueToStore, 'EX', ttl);
            return;
        }
        await setRedis(key, valueToStore);
    }
    catch (err) {
        // Redis not available, fall back to memory
    }
    // Fall back to memory cache
    const expires = ttl ? Date.now() + (ttl * 1000) : Date.now() + (5 * 60 * 1000); // Default 5 minutes
    memoryCache.set(key, { value, expires });
    // Clean up expired entries periodically
    if (memoryCache.size > 1000) {
        const now = Date.now();
        for (const [k, v] of memoryCache.entries()) {
            if (v.expires <= now) {
                memoryCache.delete(k);
            }
        }
    }
}
// Delete from cache
async function del(key) {
    try {
        const { redisDel: delRedis } = getRedisFunctions();
        await delRedis(key);
    }
    catch (err) {
        // Ignore
    }
    memoryCache.delete(key);
}
