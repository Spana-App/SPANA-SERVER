/**
 * Create Admin Token
 * Creates or finds an admin user and generates a valid JWT token
 */

import prisma from '../lib/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateUserId } from '../lib/spanaIdGenerator';

async function createAdminToken() {
  console.log('🔑 Creating admin token...\n');

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
    
    // Try to find existing admin
    let admin = await prisma.user.findFirst({
      where: { role: 'admin' }
    });

    if (admin) {
      console.log(`✅ Found existing admin: ${admin.email}`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   Name: ${admin.firstName} ${admin.lastName}\n`);
    } else {
      // Create new admin
      console.log('📝 No admin found, creating new admin...');
      
      const adminEmail = 'admin@spana.co.za';
      const adminPassword = 'Admin@123456';
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      const spanaAdminId = await generateUserId();
      
      admin = await prisma.user.create({
        data: {
          id: spanaAdminId,
          email: adminEmail,
          password: hashedPassword,
          firstName: 'SPANA',
          lastName: 'Admin',
          phone: '+27000000000',
          role: 'admin',
          isEmailVerified: true,
          profileImage: '',
          walletBalance: 0,
          status: 'active'
        }
      });
      
      console.log(`✅ Admin created successfully!`);
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
      console.log(`   ID: ${admin.id}\n`);
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin.id },
      JWT_SECRET,
      { expiresIn: '365d' } // Long expiry for testing
    );

    console.log('🎫 Admin Token Generated:\n');
    console.log('─'.repeat(80));
    console.log(token);
    console.log('─'.repeat(80));
    console.log('\n📋 Copy and use this token for testing admin endpoints');
    console.log(`\n🔍 Token Details:`);
    console.log(`   User ID: ${admin.id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Expires: 365 days from now`);
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log(`\n✅ Token verified successfully`);
    console.log(`   Decoded ID: ${decoded.id}`);
    
    return token;

  } catch (error: any) {
    console.error('\n❌ Failed to create admin token:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminToken();
