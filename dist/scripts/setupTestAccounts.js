"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../lib/database"));
const bcrypt = require('bcryptjs');
async function setupTestAccounts() {
    try {
        console.log('🔧 Setting up test accounts...\n');
        // 1. Update service provider password
        console.log('1. Updating service provider password...');
        const providerEmail = 'asiphilexoli@gmail.com';
        const providerUser = await database_1.default.user.findUnique({
            where: { email: providerEmail },
            include: { serviceProvider: true }
        });
        if (!providerUser) {
            console.log(`   ❌ User ${providerEmail} not found. Creating...`);
            const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
            const newUser = await database_1.default.user.create({
                data: {
                    email: providerEmail,
                    password: hashedPassword,
                    firstName: 'Asiphile',
                    lastName: 'Xoli',
                    phone: '+27123456789',
                    role: 'service_provider',
                    isEmailVerified: true
                }
            });
            await database_1.default.serviceProvider.create({
                data: {
                    userId: newUser.id,
                    skills: [],
                    experienceYears: 0,
                    isOnline: false,
                    rating: 0,
                    totalReviews: 0,
                    isVerified: true,
                    isIdentityVerified: true,
                    availability: { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], hours: { start: '08:00', end: '18:00' } },
                    serviceAreaRadius: 15,
                    serviceAreaCenter: { type: 'Point', coordinates: [28.0473, -26.2041] },
                    isProfileComplete: true
                }
            });
            console.log(`   ✅ Created service provider account: ${providerEmail}`);
        }
        else {
            // Update password
            const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
            await database_1.default.user.update({
                where: { id: providerUser.id },
                data: { password: hashedPassword }
            });
            // Ensure service provider record exists and is verified
            if (!providerUser.serviceProvider) {
                await database_1.default.serviceProvider.create({
                    data: {
                        userId: providerUser.id,
                        skills: [],
                        experienceYears: 0,
                        isOnline: false,
                        rating: 0,
                        totalReviews: 0,
                        isVerified: true,
                        isIdentityVerified: true,
                        availability: { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], hours: { start: '08:00', end: '18:00' } },
                        serviceAreaRadius: 15,
                        serviceAreaCenter: { type: 'Point', coordinates: [28.0473, -26.2041] },
                        isProfileComplete: true
                    }
                });
                console.log(`   ✅ Created service provider record for ${providerEmail}`);
            }
            else {
                // Update to verified
                await database_1.default.serviceProvider.update({
                    where: { id: providerUser.serviceProvider.id },
                    data: {
                        isVerified: true,
                        isIdentityVerified: true,
                        isProfileComplete: true
                    }
                });
                console.log(`   ✅ Updated service provider record for ${providerEmail}`);
            }
            // Ensure user is verified
            await database_1.default.user.update({
                where: { id: providerUser.id },
                data: {
                    isEmailVerified: true,
                    role: 'service_provider'
                }
            });
            console.log(`   ✅ Updated password for ${providerEmail}`);
        }
        // 2. Setup/verify client account
        console.log('\n2. Setting up client account...');
        const clientEmail = 'xolilenxiweni2022@gmail.com';
        const clientUser = await database_1.default.user.findUnique({
            where: { email: clientEmail },
            include: { customer: true }
        });
        if (!clientUser) {
            console.log(`   ❌ User ${clientEmail} not found. Creating...`);
            const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
            const newUser = await database_1.default.user.create({
                data: {
                    email: clientEmail,
                    password: hashedPassword,
                    firstName: 'Xoli',
                    lastName: 'Nxiweni',
                    phone: '+27123456790',
                    role: 'customer',
                    isEmailVerified: true
                }
            });
            await database_1.default.customer.create({
                data: {
                    userId: newUser.id,
                    favouriteProviders: [],
                    totalBookings: 0,
                    ratingGivenAvg: 0
                }
            });
            console.log(`   ✅ Created client account: ${clientEmail}`);
        }
        else {
            // Ensure customer record exists
            if (!clientUser.customer) {
                await database_1.default.customer.create({
                    data: {
                        userId: clientUser.id,
                        favouriteProviders: [],
                        totalBookings: 0,
                        ratingGivenAvg: 0
                    }
                });
                console.log(`   ✅ Created customer record for ${clientEmail}`);
            }
            // Ensure user is verified
            await database_1.default.user.update({
                where: { id: clientUser.id },
                data: {
                    isEmailVerified: true,
                    role: 'customer'
                }
            });
            console.log(`   ✅ Client account ${clientEmail} is ready`);
        }
        console.log('\n✅ All test accounts setup complete!');
        console.log('\n📋 Account Details:');
        console.log(`   Service Provider: ${providerEmail} / TestPassword123!`);
        console.log(`   Client: ${clientEmail} / TestPassword123!`);
    }
    catch (error) {
        console.error('❌ Error setting up accounts:', error);
        process.exit(1);
    }
    finally {
        await database_1.default.$disconnect();
    }
}
setupTestAccounts();
