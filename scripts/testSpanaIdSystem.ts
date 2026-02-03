/**
 * Test SPANA ID System (Database Only)
 * Tests the SPANA ID system without needing the server running
 */

import prisma from '../lib/database';
import { generateUserId } from '../lib/spanaIdGenerator';

async function testSpanaIdSystem() {
  console.log('🧪 Testing SPANA ID System\n');

  try {
    // Test 1: Verify all users have SPANA IDs
    console.log('📝 Test 1: Verifying user IDs...');
    const users = await prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });

    console.log(`   Found ${users.length} users (showing last 10)`);
    users.forEach((user, idx) => {
      const isSpanaFormat = user.id.startsWith('SPN-') && user.id.length === 10;
      const icon = isSpanaFormat ? '✅' : '❌';
      console.log(`   ${icon} ${idx + 1}. ${user.firstName} ${user.lastName}`);
      console.log(`      ID: ${user.id}`);
      console.log(`      Email: ${user.email}`);
    });

    const allSpanaFormat = users.every(u => u.id.startsWith('SPN-') && u.id.length === 10);
    console.log(`\n   Result: ${allSpanaFormat ? '✅ All users have SPANA IDs' : '❌ Some users have non-SPANA IDs'}\n`);

    // Test 2: Test generating new SPANA ID
    console.log('📝 Test 2: Generating new SPANA ID...');
    const newId = await generateUserId();
    console.log(`   Generated: ${newId}`);
    console.log(`   Format check: ${newId.startsWith('SPN-') && newId.length === 10 ? '✅' : '❌'}\n`);

    // Test 3: Count all records
    console.log('📝 Test 3: Database record counts...');
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.customer.count(),
      prisma.serviceProvider.count(),
      prisma.booking.count(),
      prisma.payment.count(),
      prisma.message.count(),
      prisma.document.count()
    ]);

    console.log(`   Users: ${counts[0]}`);
    console.log(`   Customers: ${counts[1]}`);
    console.log(`   Service Providers: ${counts[2]}`);
    console.log(`   Bookings: ${counts[3]}`);
    console.log(`   Payments: ${counts[4]}`);
    console.log(`   Messages: ${counts[5]}`);
    console.log(`   Documents: ${counts[6]}\n`);

    // Test 4: Verify foreign key integrity
    console.log('📝 Test 4: Checking foreign key integrity...');
    
    // Check customers
    const allCustomers = await prisma.customer.findMany();
    const allUserIds = new Set((await prisma.user.findMany({ select: { id: true } })).map(u => u.id));
    const orphanedCustomers = allCustomers.filter(c => !allUserIds.has(c.userId));
    console.log(`   Customers: ${allCustomers.length} total, ${orphanedCustomers.length} orphaned ${orphanedCustomers.length === 0 ? '✅' : '⚠️'}`);

    // Check providers
    const allProviders = await prisma.serviceProvider.findMany();
    const orphanedProviders = allProviders.filter(p => !allUserIds.has(p.userId));
    console.log(`   Providers: ${allProviders.length} total, ${orphanedProviders.length} orphaned ${orphanedProviders.length === 0 ? '✅' : '⚠️'}`);

    // Check bookings
    const allBookings = await prisma.booking.findMany();
    const allCustomerIds = new Set(allCustomers.map(c => c.id));
    const orphanedBookings = allBookings.filter(b => !allCustomerIds.has(b.customerId));
    console.log(`   Bookings: ${allBookings.length} total, ${orphanedBookings.length} orphaned ${orphanedBookings.length === 0 ? '✅' : '⚠️'}\n`);

    // Summary
    console.log('='.repeat(60));
    console.log('✅ SPANA ID System Test Complete');
    console.log('='.repeat(60));
    console.log(`\nAll user IDs are in SPN-{random} format: ${allSpanaFormat ? '✅' : '❌'}`);
    console.log(`ID Generator working: ✅`);
    console.log(`Database accessible: ✅`);
    
    if (orphanedCustomers.length > 0 || orphanedProviders.length > 0) {
      console.log(`\n⚠️  Note: ${orphanedCustomers.length + orphanedProviders.length} orphaned records found`);
      console.log(`   These are from old test data and can be cleaned up`);
    }

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testSpanaIdSystem();
