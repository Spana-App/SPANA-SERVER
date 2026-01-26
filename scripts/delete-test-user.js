const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function deleteTestUser() {
  try {
    const email = 'eksnxiweni+test1769186925660@gmail.com';
    
    console.log(`\n🗑️  Deleting test user: ${email}...\n`);
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        serviceProvider: true
      }
    });

    if (!user) {
      console.log('✅ User not found (may already be deleted)\n');
      return;
    }

    console.log(`Found user: ${user.id} - ${user.email}`);
    
    // Delete service provider record if exists
    if (user.serviceProvider) {
      console.log('Deleting service provider record...');
      await prisma.serviceProvider.delete({
        where: { userId: user.id }
      });
      console.log('✅ Service provider record deleted');
    }

    // Delete user
    console.log('Deleting user...');
    await prisma.user.delete({
      where: { id: user.id }
    });
    
    console.log('✅ Test user deleted successfully!\n');
    
  } catch (error) {
    console.error('❌ Error deleting user:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

deleteTestUser();
