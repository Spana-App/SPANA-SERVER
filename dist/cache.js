"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// cache.js
const redis = require('redis');
const { promisify } = require('util');
const USE_REDIS = String(process.env.USE_REDIS || '').toLowerCase() === 'true';
// Simple in-memory TTL cache fallback
const memoryStore = new Map();
function memGet(key) {
    const entry = memoryStore.get(key);
    if (!entry)
        return null;
    const { value, expireAt } = entry;
    if (expireAt && expireAt < Date.now()) {
        memoryStore.delete(key);
        return null;
    }
    return value;
}
function memSet(key, value, mode, ttlSeconds) {
    let expireAt = undefined;
    if ((mode === 'EX' || mode === 'PX') && ttlSeconds) {
        expireAt = Date.now() + (mode === 'EX' ? ttlSeconds * 1000 : ttlSeconds);
    }
    memoryStore.set(key, { value, expireAt });
}
function memDel(key) {
    memoryStore.delete(key);
}
let redisClientLocal = null;
let getAsync = async (key) => null;
let setAsync = async (key, value, mode, ttl) => { };
let delAsync = async (key) => { };
if (USE_REDIS) {
    redisClientLocal = redis.createClient({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD || undefined
    });
    redisClientLocal.on('error', (err) => {
        console.log('Redis error:', err);
    });
    getAsync = promisify(redisClientLocal.get).bind(redisClientLocal);
    setAsync = promisify(redisClientLocal.set).bind(redisClientLocal);
    delAsync = promisify(redisClientLocal.del).bind(redisClientLocal);
}
else {
    // Bind to in-memory
    getAsync = async (key) => memGet(key);
    setAsync = async (key, value, mode, ttl) => memSet(key, value, mode, ttl);
    delAsync = async (key) => memDel(key);
}
module.exports = {
    get: getAsync,
    set: setAsync,
    del: delAsync,
    client: redisClientLocal,
    usingRedis: USE_REDIS
};
