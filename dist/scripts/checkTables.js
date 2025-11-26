"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Script to check database tables
const database_1 = __importDefault(require("../lib/database"));
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
            const usersCount = await database_1.default.user.count();
            console.log(`✅ users: ${usersCount} records`);
        }
        catch (error) {
            console.log(`❌ users: Error`);
        }
        try {
            const customersCount = await database_1.default.customer.count();
            console.log(`✅ customers: ${customersCount} records`);
        }
        catch (error) {
            console.log(`❌ customers: Error`);
        }
        try {
            const providersCount = await database_1.default.serviceProvider.count();
            console.log(`✅ service_providers: ${providersCount} records`);
        }
        catch (error) {
            console.log(`❌ service_providers: Error`);
        }
        try {
            const servicesCount = await database_1.default.service.count();
            console.log(`✅ services: ${servicesCount} records`);
        }
        catch (error) {
            console.log(`❌ services: Error`);
        }
        try {
            const bookingsCount = await database_1.default.booking.count();
            console.log(`✅ bookings: ${bookingsCount} records`);
        }
        catch (error) {
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
    }
    catch (error) {
        console.error('❌ Error checking tables:', error);
    }
    finally {
        await database_1.default.$disconnect();
    }
}
checkTables();
