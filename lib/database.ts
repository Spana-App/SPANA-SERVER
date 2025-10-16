import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

// PostgreSQL connection pool configuration
const poolConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'spana_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'EksIsHands0me',
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10, // Maximum number of clients in the pool
  min: 2, // Minimum number of clients in the pool
  idleTimeoutMillis: 10000, // Close idle clients after 10 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
  maxUses: 7500, // Close (and replace) a connection after it has been used 7500 times
  allowExitOnIdle: true, // Allow the pool to close all connections and exit when idle
};

// Create PostgreSQL connection pool
const pool = new Pool(poolConfig);

// Global variable to store the Prisma client instance
declare global {
  var __prisma: PrismaClient | undefined;
  var __pgPool: Pool | undefined;
}

// Create a singleton Prisma client instance with connection pooling
const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Store instances globally in development to prevent multiple instances
if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
  globalThis.__pgPool = pool;
}

// Pool event handlers
pool.on('connect', (client) => {
  console.log('✅ New PostgreSQL client connected');
});

pool.on('error', (err, client) => {
  console.error('❌ PostgreSQL pool error:', err);
});

pool.on('remove', (client) => {
  console.log('🔌 PostgreSQL client removed from pool');
});

// Test the connection (non-blocking)
setTimeout(() => {
  pool.query('SELECT NOW()', (err, result) => {
    if (err) {
      console.warn('⚠️  PostgreSQL pool connection test failed (non-critical):', err.message);
    } else {
      console.log('✅ PostgreSQL pool connection test successful:', result.rows[0]);
    }
  });
}, 1000);

export default prisma;
export { pool };

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
