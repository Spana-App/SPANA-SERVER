/**
 * Debug Orphaned Records
 */

import prisma from '../lib/database';

async function debugOrphans() {
  console.log('🔍 Debugging Orphaned Records\n');

  try {
    // Get all users
    const allUsers = await prisma.user.findMany({ select: { id: true, email: true } });
    const allUserIds = new Set(allUsers.map(u => u.id));
    
    // Get orphaned customers
    const allCustomers = await prisma.customer.findMany();
    const orphanedCustomers = allCustomers.filter(c => !allUserIds.has(c.userId));
    
    console.log(`📊 Total users: ${allUsers.length}`);
    console.log(`📊 Total customers: ${allCustomers.length}`);
    console.log(`❌ Orphaned customers: ${orphanedCustomers.length}\n`);
    
    if (orphanedCustomers.length > 0) {
      console.log('🔍 Orphaned Customer Details:');
      for (const customer of orphanedCustomers.slice(0, 10)) {
        console.log(`   ID: ${customer.id}`);
        console.log(`   User ID: ${customer.userId} (DOESN'T EXIST)`);
        console.log(`   Created: ${customer.createdAt}\n`);
      }
    }
    
    // Get orphaned providers
    const allProviders = await prisma.serviceProvider.findMany();
    const orphanedProviders = allProviders.filter(p => !allUserIds.has(p.userId));
    
    console.log(`📊 Total providers: ${allProviders.length}`);
    console.log(`❌ Orphaned providers: ${orphanedProviders.length}\n`);
    
    if (orphanedProviders.length > 0) {
      console.log('🔍 Orphaned Provider Details (first 10):');
      for (const provider of orphanedProviders.slice(0, 10)) {
        console.log(`   ID: ${provider.id}`);
        console.log(`   User ID: ${provider.userId} (DOESN'T EXIST)`);
        console.log(`   Created: ${provider.createdAt}\n`);
      }
    }
    
    // Check if any user IDs being referenced actually exist
    console.log('🔍 Checking if referenced user IDs exist:');
    const orphanedUserIds = [...new Set([
      ...orphanedCustomers.map(c => c.userId),
      ...orphanedProviders.map(p => p.userId)
    ])];
    
    for (const userId of orphanedUserIds.slice(0, 5)) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      console.log(`   ${userId}: ${user ? '✅ EXISTS' : '❌ MISSING'}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugOrphans();
