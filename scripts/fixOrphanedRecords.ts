/**
 * Fix Orphaned Records
 * 
 * After migrating user IDs to SPANA format, some customers and providers
 * may have old user IDs that no longer exist. This script fixes those.
 */

import prisma from '../lib/database';

async function fixOrphanedRecords() {
  console.log('🔧 Fixing Orphaned Records\n');

  try {
    // Get all current user IDs (SPANA format)
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    const userIdSet = new Set(allUsers.map(u => u.id));
    console.log(`Found ${allUsers.length} users with SPANA IDs\n`);

    // Fix orphaned customers
    console.log('📝 Checking customers...');
    const allCustomers = await prisma.customer.findMany();
    const orphanedCustomers = allCustomers.filter(c => !userIdSet.has(c.userId));
    
    if (orphanedCustomers.length > 0) {
      console.log(`   Found ${orphanedCustomers.length} orphaned customers`);
      console.log('   ⚠️  These customers reference non-existent users');
      console.log('   💡 These may be test data or need manual cleanup\n');
      
      // Optionally delete orphaned customers
      // await prisma.customer.deleteMany({
      //   where: {
      //     userId: { notIn: Array.from(userIdSet) }
      //   }
      // });
    } else {
      console.log('   ✅ All customers have valid user references\n');
    }

    // Fix orphaned providers
    console.log('📝 Checking service providers...');
    const allProviders = await prisma.serviceProvider.findMany();
    const orphanedProviders = allProviders.filter(p => !userIdSet.has(p.userId));
    
    if (orphanedProviders.length > 0) {
      console.log(`   Found ${orphanedProviders.length} orphaned providers`);
      console.log('   ⚠️  These providers reference non-existent users');
      console.log('   💡 These may be test data or need manual cleanup\n');
      
      // Optionally delete orphaned providers
      // await prisma.serviceProvider.deleteMany({
      //   where: {
      //     userId: { notIn: Array.from(userIdSet) }
      //   }
      // });
    } else {
      console.log('   ✅ All providers have valid user references\n');
    }

    // Summary
    console.log('='.repeat(60));
    console.log('Summary:');
    console.log(`   Orphaned customers: ${orphanedCustomers.length}`);
    console.log(`   Orphaned providers: ${orphanedProviders.length}`);
    console.log('\n💡 To clean up orphaned records, uncomment the delete statements in the script');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixOrphanedRecords();
