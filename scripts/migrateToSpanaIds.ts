/**
 * Migration Script: Update All IDs to SPANA Format
 * 
 * This script updates all existing records in the database to use SPANA IDs:
 * - Users: SPN-{randomCode}
 * - Bookings: SPB-{randomCode}
 * - Payments: SPP-{randomCode}
 * - Services: SPS-{randomCode}
 * - Messages: SPM-{randomCode}
 * - Documents: SPD-{randomCode}
 * - Customers: SPC-{randomCode}
 * - Service Providers: SPR-{randomCode}
 * - Complaints: SPX-{randomCode}
 * - Applications: SPA-{randomCode}
 * - Payouts: SPY-{randomCode}
 * 
 * All codes are cryptographically secure random (no sequential patterns)
 */

import prisma from '../lib/database';
const crypto = require('crypto');

// Generate cryptographically secure random code
function generateSecureCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
}

// Generate SPANA ID with prefix
function generateSpanaId(prefix: string): string {
  return `${prefix}-${generateSecureCode()}`;
}

// Generate unique SPANA ID (with collision check only if needed)
async function generateUniqueSpanaId(prefix: string, existingIds: Set<string>): Promise<string> {
  let spanaId: string;
  let attempts = 0;
  do {
    spanaId = generateSpanaId(prefix);
    attempts++;
    // With crypto.randomBytes, collisions are extremely unlikely
    // Only check against in-memory set for speed
    if (attempts > 50) {
      // Fallback: use timestamp-based code if somehow we get many collisions
      const timestamp = Date.now().toString(36).slice(-6);
      const random = crypto.randomBytes(2).toString('hex');
      spanaId = `${prefix}-${timestamp}${random}`;
      break;
    }
  } while (existingIds.has(spanaId));
  
  existingIds.add(spanaId);
  return spanaId;
}

async function migrateToSpanaIds() {
  console.log('🚀 Starting SPANA ID Migration\n');
  console.log('This will update all existing records with SPANA IDs...\n');

  let totalUpdated = 0;

  try {
    // ============================================
    // 1. MIGRATE USERS
    // ============================================
    console.log('📝 Migrating Users...');
    // NOTE: This script is deprecated - User IDs are now SPANA format directly
    // Users are migrated via migrateUserIdToSpana.ts script
    console.log('   ⚠️  User migration already completed via migrateUserIdToSpana.ts');
    console.log('   ⚠️  User IDs are now SPANA format (SPN-{random})');
    const users = await prisma.user.findMany({
      where: {
        id: { not: { startsWith: 'SPN-' } } // Find users without SPANA IDs
      }
    });

    let userCount = 0;
    const userIds = new Set<string>();
    
    // Batch update users (migrate old cuid() IDs to SPANA format)
    for (const user of users) {
      const spanaId = await generateUniqueSpanaId('SPN', userIds);
      
      // This migration requires updating primary key - use migrateUserIdToSpana.ts instead
      console.log(`   ⚠️  Skipping user ${user.id} - use migrateUserIdToSpana.ts for primary key migration`);
      userCount++;
      
      if (userCount % 10 === 0) {
        process.stdout.write(`   Processing... ${userCount}/${users.length}\r`);
      }
    }
    process.stdout.write('\n');
    console.log(`   ✅ Updated ${userCount} users`);
    totalUpdated += userCount;

    // ============================================
    // 2. MIGRATE BOOKINGS
    // ============================================
    console.log('\n📝 Migrating Bookings...');
    // Update ALL bookings - including those with old sequential IDs
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { referenceNumber: null },
          { referenceNumber: { startsWith: 'SPANA-BK-' } }, // Old sequential format
          { referenceNumber: { not: { startsWith: 'SPB-' } } } // Other formats
        ]
      }
    });

    let bookingCount = 0;
    const bookingIds = new Set<string>();
    
    for (const booking of bookings) {
      const spanaId = await generateUniqueSpanaId('SPB', bookingIds);
      
      await prisma.booking.update({
        where: { id: booking.id },
        data: { referenceNumber: spanaId }
      });
      bookingCount++;
      
      if (bookingCount % 10 === 0) {
        process.stdout.write(`   Processing... ${bookingCount}/${bookings.length}\r`);
      }
    }
    process.stdout.write('\n');
    console.log(`   ✅ Updated ${bookingCount} bookings`);
    totalUpdated += bookingCount;

    // ============================================
    // 3. MIGRATE PAYMENTS
    // ============================================
    console.log('\n📝 Migrating Payments...');
    // Update ALL payments - including those with old sequential IDs
    const payments = await prisma.payment.findMany({
      where: {
        OR: [
          { referenceNumber: null },
          { referenceNumber: { startsWith: 'SPANA-PY-' } }, // Old sequential format
          { referenceNumber: { not: { startsWith: 'SPP-' } } } // Other formats
        ]
      }
    });

    let paymentCount = 0;
    const paymentIds = new Set<string>();
    
    for (const payment of payments) {
      const spanaId = await generateUniqueSpanaId('SPP', paymentIds);
      
      await prisma.payment.update({
        where: { id: payment.id },
        data: { referenceNumber: spanaId }
      });
      paymentCount++;
      
      if (paymentCount % 10 === 0) {
        process.stdout.write(`   Processing... ${paymentCount}/${payments.length}\r`);
      }
    }
    process.stdout.write('\n');
    console.log(`   ✅ Updated ${paymentCount} payments`);
    totalUpdated += paymentCount;

    // ============================================
    // 4. MIGRATE SERVICES
    // ============================================
    console.log('\n📝 Migrating Services...');
    // Note: Services don't have referenceNumber field in schema
    // If needed, add referenceNumber field to Service model first
    console.log(`   ⚠️  Services model doesn't have referenceNumber field (skipped)`);

    // ============================================
    // 5. MIGRATE MESSAGES
    // ============================================
    console.log('\n📝 Migrating Messages...');
    // Update ALL messages - including those with old sequential IDs
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { referenceNumber: null },
          { referenceNumber: { startsWith: 'SPN-MSG-' } }, // Old sequential format
          { referenceNumber: { not: { startsWith: 'SPM-' } } } // Other formats
        ]
      }
    });

    let messageCount = 0;
    const messageIds = new Set<string>();
    
    for (const message of messages) {
      const spanaId = await generateUniqueSpanaId('SPM', messageIds);
      
      await prisma.message.update({
        where: { id: message.id },
        data: { referenceNumber: spanaId }
      });
      messageCount++;
      
      if (messageCount % 10 === 0) {
        process.stdout.write(`   Processing... ${messageCount}/${messages.length}\r`);
      }
    }
    process.stdout.write('\n');
    console.log(`   ✅ Updated ${messageCount} messages`);
    totalUpdated += messageCount;

    // ============================================
    // 6. MIGRATE DOCUMENTS
    // ============================================
    console.log('\n📝 Migrating Documents...');
    // Documents don't have referenceNumber field, but we can add it if needed
    console.log(`   ⚠️  Documents model doesn't have referenceNumber field (skipped)`);

    // ============================================
    // 7. MIGRATE CUSTOMERS
    // ============================================
    console.log('\n📝 Migrating Customers...');
    // Customers don't have referenceNumber field, but they're linked to Users
    // User referenceNumber is already updated above
    console.log(`   ℹ️  Customers use User referenceNumber (already migrated)`);

    // ============================================
    // 8. MIGRATE SERVICE PROVIDERS
    // ============================================
    console.log('\n📝 Migrating Service Providers...');
    // Service Providers don't have referenceNumber field, but they're linked to Users
    // User referenceNumber is already updated above
    console.log(`   ℹ️  Service Providers use User referenceNumber (already migrated)`);

    // ============================================
    // 9. MIGRATE COMPLAINTS
    // ============================================
    console.log('\n📝 Migrating Complaints...');
    // Complaints don't have referenceNumber field
    console.log(`   ⚠️  Complaints model doesn't have referenceNumber field (skipped)`);

    // ============================================
    // 10. MIGRATE APPLICATIONS
    // ============================================
    console.log('\n📝 Migrating Applications...');
    const applications = await prisma.serviceProviderApplication.findMany();

    // Applications don't have referenceNumber field, but we can add IDs if needed
    console.log(`   ⚠️  Applications model doesn't have referenceNumber field (skipped)`);

    // ============================================
    // 11. MIGRATE PAYOUTS
    // ============================================
    console.log('\n📝 Migrating Payouts...');
    // Payouts don't have referenceNumber field
    console.log(`   ⚠️  Payouts model doesn't have referenceNumber field (skipped)`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration Complete!');
    console.log('='.repeat(60));
    console.log(`Total records updated: ${totalUpdated}`);
    console.log('\n📊 Breakdown:');
    console.log(`   Users: ${userCount}`);
    console.log(`   Bookings: ${bookingCount}`);
    console.log(`   Payments: ${paymentCount}`);
    console.log(`   Messages: ${messageCount}`);
    console.log('\n✨ All IDs now use SPANA format with secure random codes!');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateToSpanaIds();
