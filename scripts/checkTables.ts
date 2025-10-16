// Script to check database tables
import prisma from '../lib/database';

async function checkTables() {
  try {
    console.log('🔍 Checking database tables...\n');
    
    // Check if tables exist by querying them
    const tables = [
      'users',
      'customers', 
      'service_providers',
      'services',
      'bookings',
      'payments',
      'documents',
      'notifications',
      'activities'
    ];
    
    // Check each table individually
    try {
      const usersCount = await prisma.user.count();
      console.log(`✅ users: ${usersCount} records`);
    } catch (error) {
      console.log(`❌ users: Error`);
    }
    
    try {
      const customersCount = await prisma.customer.count();
      console.log(`✅ customers: ${customersCount} records`);
    } catch (error) {
      console.log(`❌ customers: Error`);
    }
    
    try {
      const providersCount = await prisma.serviceProvider.count();
      console.log(`✅ service_providers: ${providersCount} records`);
    } catch (error) {
      console.log(`❌ service_providers: Error`);
    }
    
    try {
      const servicesCount = await prisma.service.count();
      console.log(`✅ services: ${servicesCount} records`);
    } catch (error) {
      console.log(`❌ services: Error`);
    }
    
    try {
      const bookingsCount = await prisma.booking.count();
      console.log(`✅ bookings: ${bookingsCount} records`);
    } catch (error) {
      console.log(`❌ bookings: Error`);
    }
    
    console.log('\n📊 Table structure:');
    console.log('users - Base user data (email, password, common fields)');
    console.log('customers - Customer-specific data (favorites, booking stats)');
    console.log('service_providers - Provider-specific data (skills, verification, availability)');
    console.log('services - Service offerings by providers');
    console.log('bookings - Service bookings by customers');
    console.log('payments - Payment records');
    console.log('documents - Provider verification documents');
    console.log('notifications - User notifications');
    console.log('activities - User activity logs');
    
  } catch (error) {
    console.error('❌ Error checking tables:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();
