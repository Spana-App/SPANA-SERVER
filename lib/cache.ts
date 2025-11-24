// Simple cache abstraction - uses Redis if available, otherwise in-memory
// Lazy load Redis functions to avoid circular dependency
let redisGet: any, redisSet: any, redisDel: any;

function getRedisFunctions() {
  if (!redisGet) {
    try {
      const server = require('../server');
      redisGet = server.redisGet || (async () => null);
      redisSet = server.redisSet || (async () => {});
      redisDel = server.redisDel || (async () => {});
    } catch (err) {
      redisGet = async () => null;
      redisSet = async () => {};
      redisDel = async () => {};
    }
  }
  return { redisGet, redisSet, redisDel };
}

// In-memory cache fallback
const memoryCache = new Map<string, { value: any; expires: number }>();

// Get from cache
export async function get(key: string): Promise<any> {
  try {
    // Try Redis first if available
    const { redisGet: getRedis } = getRedisFunctions();
    const redisValue = await getRedis(key);
    if (redisValue) {
      return typeof redisValue === 'string' ? JSON.parse(redisValue) : redisValue;
    }
  } catch (err) {
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
export async function set(key: string, value: any, expiry?: string, ttl?: number): Promise<void> {
  const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
  
  try {
    // Try Redis first if available
    const { redisSet: setRedis } = getRedisFunctions();
    if (expiry === 'EX' && ttl) {
      await setRedis(key, valueToStore, 'EX', ttl);
      return;
    }
    await setRedis(key, valueToStore);
  } catch (err) {
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
export async function del(key: string): Promise<void> {
  try {
    const { redisDel: delRedis } = getRedisFunctions();
    await delRedis(key);
  } catch (err) {
    // Ignore
  }
  memoryCache.delete(key);
}

