import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

// PostgreSQL connection pool configuration
const postgresHost = process.env.POSTGRES_HOST || 'localhost';
// If using Render PostgreSQL, ensure we use the full hostname
const fullHostname = postgresHost.includes('.render.com') ? postgresHost : `${postgresHost}.frankfurt-postgres.render.com`;

const poolConfig = {
  host: fullHostname,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'spana_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'EksIsHands0me',
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false, sslmode: 'prefer' } : false,
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
// Build DATABASE_URL from individual components if not provided
const databaseUrl = process.env.DATABASE_URL || 
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${fullHostname}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}${process.env.POSTGRES_SSL === 'true' ? '?sslmode=prefer' : ''}`;

// Validate that we have a database URL
if (!databaseUrl || databaseUrl === 'postgresql://undefined:undefined@undefined:undefined/undefined') {
  console.error('❌ Database configuration error:');
  console.error('  DATABASE_URL:', process.env.DATABASE_URL || 'Not set');
  console.error('  POSTGRES_USER:', process.env.POSTGRES_USER || 'Not set');
  console.error('  POSTGRES_PASSWORD:', process.env.POSTGRES_PASSWORD ? 'Set' : 'Not set');
  console.error('  POSTGRES_HOST:', process.env.POSTGRES_HOST || 'Not set');
  console.error('  POSTGRES_DB:', process.env.POSTGRES_DB || 'Not set');
  console.error('  POSTGRES_PORT:', process.env.POSTGRES_PORT || 'Not set');
  console.error('Please set DATABASE_URL or all individual PostgreSQL environment variables.');
  process.exit(1);
}

// Debug logging for database connection
console.log('🔍 Database Configuration:');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set');
console.log('  POSTGRES_HOST:', process.env.POSTGRES_HOST || '❌ Not set');
console.log('  Full Hostname:', fullHostname);
console.log('  POSTGRES_USER:', process.env.POSTGRES_USER || '❌ Not set');
console.log('  POSTGRES_DB:', process.env.POSTGRES_DB || '❌ Not set');
console.log('  Final URL:', databaseUrl.replace(/:[^:@]+@/, ':***@')); // Hide password in logs

const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: databaseUrl
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
