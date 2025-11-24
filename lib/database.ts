import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

// Helper function to parse DATABASE_URL
function parseDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432'),
      database: parsed.pathname.slice(1), // Remove leading '/'
      user: parsed.username,
      password: parsed.password,
      ssl: parsed.searchParams.get('sslmode') || parsed.searchParams.get('ssl') || null
    };
  } catch (e) {
    return null;
  }
}

// PostgreSQL connection pool configuration
const postgresHost = process.env.POSTGRES_HOST || 'localhost';

// Parse DATABASE_URL if provided
const dbUrlParsed = process.env.DATABASE_URL ? parseDatabaseUrl(process.env.DATABASE_URL) : null;

// Detect database provider
const isNeonDatabase = process.env.DATABASE_URL?.includes('@dpg-') && 
                       !process.env.DATABASE_URL?.includes('.render.com') &&
                       !process.env.DATABASE_URL?.includes('.neon.tech');
const isInternalRenderUrl = process.env.DATABASE_URL?.includes('@dpg-') && 
                            !process.env.DATABASE_URL?.includes('.render.com') &&
                            !isNeonDatabase;
const isExternalRenderUrl = process.env.DATABASE_URL?.includes('.render.com') || 
                            postgresHost.includes('.render.com');
const isNeonUrl = process.env.DATABASE_URL?.includes('.neon.tech');

// Extract hostname from DATABASE_URL or use POSTGRES_HOST
let fullHostname: string;
if (dbUrlParsed) {
  fullHostname = dbUrlParsed.host;
  // If Neon database with incomplete hostname, warn user
  if (isNeonDatabase && !fullHostname.includes('.')) {
    console.warn('⚠️  Warning: Neon database hostname appears incomplete. Ensure your DATABASE_URL includes the full hostname (e.g., dpg-xxx.xxxxx.neon.tech)');
  }
} else {
  // If using Render internal URL, use short hostname; otherwise use full hostname
  fullHostname = isInternalRenderUrl 
    ? postgresHost  // Internal: use short hostname (dpg-xxx)
    : (postgresHost.includes('.render.com') ? postgresHost : `${postgresHost}.frankfurt-postgres.render.com`);
}

// SSL configuration
// Neon databases always require SSL
// Render external URLs require SSL
// Render internal URLs don't need SSL
// Check POSTGRES_SSL env var first, then auto-detect
let shouldUseSSL: boolean;
if (process.env.POSTGRES_SSL === 'true') {
  shouldUseSSL = true;
} else if (process.env.POSTGRES_SSL === 'false') {
  shouldUseSSL = false;
} else {
  // Auto-detect based on database type
  // Render external databases (with .render.com) always need SSL
  const isRenderExternal = isExternalRenderUrl || 
                          (dbUrlParsed?.host && dbUrlParsed.host.includes('.render.com'));
  shouldUseSSL = isNeonDatabase || isNeonUrl || isRenderExternal || 
                 (dbUrlParsed?.ssl && (dbUrlParsed.ssl === 'require' || dbUrlParsed.ssl === 'prefer'));
}

const poolConfig = {
  host: dbUrlParsed?.host || fullHostname,
  port: dbUrlParsed?.port || parseInt(process.env.POSTGRES_PORT || '5432'),
  database: dbUrlParsed?.database || process.env.POSTGRES_DB || 'spana_db',
  user: dbUrlParsed?.user || process.env.POSTGRES_USER || 'postgres',
  password: dbUrlParsed?.password || process.env.POSTGRES_PASSWORD || 'EksIsHands0me',
  ssl: shouldUseSSL ? { rejectUnauthorized: false } : false,
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
let databaseUrl: string;
if (process.env.DATABASE_URL) {
  databaseUrl = process.env.DATABASE_URL;
  // Ensure SSL is configured for external databases if not already in URL
  // Check if hostname contains .render.com (Render external) or .neon.tech (Neon)
  const hostname = dbUrlParsed?.host || '';
  const isRenderExternalDB = hostname.includes('.render.com');
  const isNeonDB = hostname.includes('.neon.tech') || isNeonDatabase;
  
  if ((isNeonDB || isRenderExternalDB) && !databaseUrl.includes('sslmode') && !databaseUrl.includes('ssl=')) {
    const separator = databaseUrl.includes('?') ? '&' : '?';
    databaseUrl = `${databaseUrl}${separator}sslmode=require`;
    console.log('🔒 Added SSL requirement for external database connection');
  }
} else {
  const sslParam = shouldUseSSL ? '?sslmode=require' : '';
  databaseUrl = `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${fullHostname}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}${sslParam}`;
}

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
if (dbUrlParsed) {
  const provider = isNeonDatabase ? 'Neon (detected)' : isNeonUrl ? 'Neon' : isInternalRenderUrl ? 'Render (internal)' : isExternalRenderUrl ? 'Render (external)' : 'Other';
  console.log('  Provider:', provider);
  console.log('  Hostname:', dbUrlParsed.host);
  console.log('  Database:', dbUrlParsed.database);
  console.log('  User:', dbUrlParsed.user);
  console.log('  SSL:', shouldUseSSL ? '✅ Required' : '❌ Disabled');
} else if (!process.env.DATABASE_URL) {
  // Only show individual component warnings if DATABASE_URL is not set
  console.log('  POSTGRES_HOST:', process.env.POSTGRES_HOST || '❌ Not set');
  console.log('  Full Hostname:', fullHostname);
  console.log('  POSTGRES_USER:', process.env.POSTGRES_USER || '❌ Not set');
  console.log('  POSTGRES_DB:', process.env.POSTGRES_DB || '❌ Not set');
  console.log('  SSL:', shouldUseSSL ? '✅ Required' : '❌ Disabled');
}
console.log('  Final URL:', databaseUrl.replace(/:[^:@]+@/, ':***@')); // Hide password in logs

const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'], // Removed 'query' to reduce memory usage
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

// Test the connection (non-blocking, immediate)
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    // Silently fail - connection will be tested when needed
  } else {
    console.log('✅ PostgreSQL pool ready');
  }
});

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
