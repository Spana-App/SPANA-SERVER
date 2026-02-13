/**
 * Verify Database Sync
 *
 * Ensures local .env and production backend use the SAME database.
 * If they differ, bookings created via the app (production API) won't appear
 * when you run scripts locally or query the admin dashboard.
 *
 * Usage: npx ts-node scripts/verifyDatabaseSync.ts
 * Optional: PRODUCTION_URL=https://spana-server-5bhu.onrender.com npx ts-node scripts/verifyDatabaseSync.ts
 */

import prisma from '../lib/database';

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://spana-server-5bhu.onrender.com';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(msg: string, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function getLocalDbIdentifier(): string {
  const url = process.env.DATABASE_URL || '';
  if (!url) return 'NOT_SET';
  try {
    const u = new URL(url.replace(/^postgresql:\/\//, 'https://'));
    return `${u.hostname}:${u.pathname.slice(1) || 'postgres'}`;
  } catch {
    return 'PARSE_ERROR';
  }
}

async function getProductionDbIdentifier(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${PRODUCTION_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    return data.databaseHost || null;
  } catch (err: any) {
    log(`   Could not reach production: ${err.message}`, colors.yellow);
    return null;
  }
}

async function main() {
  log('\n🔍 DATABASE SYNC VERIFICATION\n', colors.blue);
  log('='.repeat(60), colors.blue);

  const localId = getLocalDbIdentifier();
  log(`\n📋 Local (.env DATABASE_URL):`, colors.yellow);
  log(`   ${localId}`, colors.cyan);

  if (localId === 'NOT_SET') {
    log('\n❌ DATABASE_URL is not set in .env', colors.red);
    log('   Set it to match your production backend\'s database.', colors.yellow);
    process.exit(1);
  }

  log(`\n📋 Production (${PRODUCTION_URL}):`, colors.yellow);
  const prodId = await getProductionDbIdentifier();
  if (prodId) {
    log(`   ${prodId}`, colors.cyan);
  } else {
    log('   (Could not fetch - is production running?)', colors.yellow);
  }

  // Compare
  log('\n' + '='.repeat(60), colors.blue);
  if (prodId && localId !== prodId) {
    log('\n⚠️  DATABASE MISMATCH DETECTED', colors.red);
    log('\n   Your local .env points to a DIFFERENT database than production.', colors.yellow);
    log('   Bookings created via the app (production API) are stored in production\'s DB.', colors.yellow);
    log('   Your local scripts and admin will NOT see those bookings.\n', colors.yellow);
    log('   FIX: Update your local .env DATABASE_URL to match production:', colors.cyan);
    log(`   Copy the DATABASE_URL from Render Dashboard → spana-backend → Environment`, colors.cyan);
    log(`   Paste it into spana-backend/.env\n`, colors.cyan);
    process.exit(1);
  }

  if (prodId && localId === prodId) {
    log('\n✅ DATABASES ARE IN SYNC', colors.green);
    log('   Local and production use the same database.', colors.green);
  }

  // Quick count
  try {
    const bookingCount = await prisma.booking.count();
    const serviceCount = await prisma.service.count();
    log(`\n   Bookings in DB: ${bookingCount}`, colors.cyan);
    log(`   Services in DB: ${serviceCount}`, colors.cyan);
  } catch (err: any) {
    log(`\n   Could not query: ${err.message}`, colors.yellow);
  }

  log('\n' + '='.repeat(60) + '\n', colors.blue);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
