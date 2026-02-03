/**
 * Cleanup Orphaned Records
 * Removes customers, providers, and related data that reference non-existent user IDs
 */

import prisma from '../lib/database';

async function cleanupOrphanedRecords() {
  console.log('🧹 Cleaning up orphaned records...\n');

  try {
    // Get all valid user IDs (SPANA IDs)
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    const validUserIds = new Set(allUsers.map(u => u.id));
    console.log(`✅ Found ${validUserIds.size} valid users with SPANA IDs\n`);

    // 1. Find and delete orphaned customers
    console.log('📝 Checking customers...');
    const allCustomers = await prisma.customer.findMany();
    const orphanedCustomers = allCustomers.filter(c => !validUserIds.has(c.userId));
    
    if (orphanedCustomers.length > 0) {
      console.log(`   Found ${orphanedCustomers.length} orphaned customers`);
      
      // Delete related bookings first (foreign key constraint)
      const orphanedCustomerIds = orphanedCustomers.map(c => c.id);
      const bookingsDeleted = await prisma.booking.deleteMany({
        where: { customerId: { in: orphanedCustomerIds } }
      });
      console.log(`   ├─ Deleted ${bookingsDeleted.count} related bookings`);
      
      // Now delete customers
      const customersDeleted = await prisma.customer.deleteMany({
        where: { id: { in: orphanedCustomerIds } }
      });
      console.log(`   └─ Deleted ${customersDeleted.count} orphaned customers ✅\n`);
    } else {
      console.log(`   No orphaned customers found ✅\n`);
    }

    // 2. Find and delete orphaned providers
    console.log('📝 Checking service providers...');
    const allProviders = await prisma.serviceProvider.findMany();
    const orphanedProviders = allProviders.filter(p => !validUserIds.has(p.userId));
    
    if (orphanedProviders.length > 0) {
      console.log(`   Found ${orphanedProviders.length} orphaned providers`);
      
      const orphanedProviderIds = orphanedProviders.map(p => p.id);
      
      // Delete related services
      const servicesDeleted = await prisma.service.deleteMany({
        where: { providerId: { in: orphanedProviderIds } }
      });
      console.log(`   ├─ Deleted ${servicesDeleted.count} related services`);
      
      // Delete related documents (check field name in schema)
      try {
        const documentsDeleted = await prisma.document.deleteMany({
          where: { 
            providerId: { in: orphanedProviderIds } 
          }
        });
        console.log(`   ├─ Deleted ${documentsDeleted.count} related documents`);
      } catch (e) {
        console.log(`   ├─ Documents deletion skipped (field may not exist)`);
      }
      
      // Now delete providers
      const providersDeleted = await prisma.serviceProvider.deleteMany({
        where: { id: { in: orphanedProviderIds } }
      });
      console.log(`   └─ Deleted ${providersDeleted.count} orphaned providers ✅\n`);
    } else {
      console.log(`   No orphaned providers found ✅\n`);
    }

    // 3. Verify cleanup
    console.log('📝 Verification...');
    const remainingCustomers = await prisma.customer.findMany();
    const remainingProviders = await prisma.serviceProvider.findMany();
    
    const stillOrphanedCustomers = remainingCustomers.filter(c => !validUserIds.has(c.userId));
    const stillOrphanedProviders = remainingProviders.filter(p => !validUserIds.has(p.userId));
    
    console.log(`   Customers: ${remainingCustomers.length} total, ${stillOrphanedCustomers.length} orphaned`);
    console.log(`   Providers: ${remainingProviders.length} total, ${stillOrphanedProviders.length} orphaned`);
    
    if (stillOrphanedCustomers.length === 0 && stillOrphanedProviders.length === 0) {
      console.log('\n✅ All orphaned records cleaned up successfully!');
    } else {
      console.log('\n⚠️  Some orphaned records still exist');
    }

  } catch (error: any) {
    console.error('\n❌ Cleanup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOrphanedRecords();
