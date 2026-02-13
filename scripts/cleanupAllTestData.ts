/**
 * Cleanup All Test Data
 * ⚠️  WARNING: This script DELETES data permanently!
 * 
 * Removes all E2E test users, orphaned records, and test applications
 * 
 * ⚠️  SAFETY: This script requires explicit admin confirmation via environment variable.
 * To run this script, you MUST set: ALLOW_CLEANUP=true
 * 
 * Example: ALLOW_CLEANUP=true npx ts-node scripts/cleanupAllTestData.ts
 * 
 * This prevents accidental automatic execution. All deletions must be manual and intentional.
 */

import prisma from '../lib/database';

async function cleanupAllTestData() {
  // SAFETY CHECK: Require explicit admin confirmation
  const allowCleanup = process.env.ALLOW_CLEANUP === 'true';
  
  if (!allowCleanup) {
    console.error('\n❌ CLEANUP BLOCKED: Automatic cleanup is disabled!\n');
    console.error('⚠️  This script DELETES data permanently.');
    console.error('⚠️  To prevent accidental data loss, this script requires explicit confirmation.\n');
    console.error('📋 To run this script manually (admin only):');
    console.error('   Set environment variable: ALLOW_CLEANUP=true');
    console.error('   Example: ALLOW_CLEANUP=true npx ts-node scripts/cleanupAllTestData.ts\n');
    console.error('🔒 Policy: All deletions must be manual and intentional.');
    console.error('   Automatic cleanup is NOT allowed.\n');
    process.exit(1);
  }

  console.log('\n⚠️  WARNING: This script will DELETE data permanently!');
  console.log('⚠️  You have explicitly enabled cleanup with ALLOW_CLEANUP=true\n');
  console.log('🧹 Cleaning up ALL test data and orphaned records...\n');

  try {
    // 1. Delete all E2E test users and their related data
    console.log('📝 Removing E2E test users...');
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: 'e2e-' } },
          { email: { contains: 'test-login-' } },
          { email: { contains: 'example.com' } }
        ]
      }
    });
    
    if (testUsers.length > 0) {
      const testUserIds = testUsers.map(u => u.id);
      
      // Delete related customers
      const customersDeleted = await prisma.customer.deleteMany({
        where: { userId: { in: testUserIds } }
      });
      console.log(`   ├─ Deleted ${customersDeleted.count} test customers`);
      
      // Delete related providers (and their dependencies)
      const testProviders = await prisma.serviceProvider.findMany({
        where: { userId: { in: testUserIds } }
      });
      
      if (testProviders.length > 0) {
        const testProviderIds = testProviders.map(p => p.id);
        
        // Delete provider-related data
        await prisma.service.deleteMany({ where: { providerId: { in: testProviderIds } } });
        await prisma.document.deleteMany({ where: { providerId: { in: testProviderIds } } });
        await prisma.serviceProvider.deleteMany({ where: { id: { in: testProviderIds } } });
        
        console.log(`   ├─ Deleted ${testProviders.length} test providers + related data`);
      }
      
      // Delete test users
      const usersDeleted = await prisma.user.deleteMany({
        where: { id: { in: testUserIds } }
      });
      console.log(`   └─ Deleted ${usersDeleted.count} test users ✅\n`);
    } else {
      console.log(`   No test users found ✅\n`);
    }

    // 2. Clean up orphaned records
    console.log('📝 Cleaning up orphaned records...');
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    const validUserIds = new Set(allUsers.map(u => u.id));
    
    // Find orphaned customers
    const allCustomers = await prisma.customer.findMany();
    const orphanedCustomers = allCustomers.filter(c => !validUserIds.has(c.userId));
    
    if (orphanedCustomers.length > 0) {
      const orphanedCustomerIds = orphanedCustomers.map(c => c.id);
      
      // Delete orphaned bookings
      await prisma.booking.deleteMany({
        where: { customerId: { in: orphanedCustomerIds } }
      });
      
      // Delete orphaned customers
      await prisma.customer.deleteMany({
        where: { id: { in: orphanedCustomerIds } }
      });
      
      console.log(`   ├─ Deleted ${orphanedCustomers.length} orphaned customers ✅`);
    }
    
    // Find orphaned providers
    const allProviders = await prisma.serviceProvider.findMany();
    const orphanedProviders = allProviders.filter(p => !validUserIds.has(p.userId));
    
    if (orphanedProviders.length > 0) {
      const orphanedProviderIds = orphanedProviders.map(p => p.id);
      
      // Delete orphaned provider data
      await prisma.service.deleteMany({ where: { providerId: { in: orphanedProviderIds } } });
      await prisma.document.deleteMany({ where: { providerId: { in: orphanedProviderIds } } });
      await prisma.serviceProvider.deleteMany({ where: { id: { in: orphanedProviderIds } } });
      
      console.log(`   └─ Deleted ${orphanedProviders.length} orphaned providers ✅\n`);
    }

    // 3. Final verification
    console.log('📝 Final verification...');
    const finalCustomers = await prisma.customer.findMany();
    const finalProviders = await prisma.serviceProvider.findMany();
    const finalOrphanedCustomers = finalCustomers.filter(c => !validUserIds.has(c.userId));
    const finalOrphanedProviders = finalProviders.filter(p => !validUserIds.has(p.userId));
    
    console.log(`   Customers: ${finalCustomers.length} total, ${finalOrphanedCustomers.length} orphaned`);
    console.log(`   Providers: ${finalProviders.length} total, ${finalOrphanedProviders.length} orphaned`);
    
    if (finalOrphanedCustomers.length === 0 && finalOrphanedProviders.length === 0) {
      console.log('\n✅ Database is clean! No orphaned records.');
    }

  } catch (error: any) {
    console.error('\n❌ Cleanup failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupAllTestData();
