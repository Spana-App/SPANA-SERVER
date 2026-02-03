import prisma from '../lib/database';
import bcrypt from 'bcryptjs';
const { generateUserId } = require('../lib/spanaIdGenerator');

const email = 'xoli@spana.co.za';
const password = 'TestPassword123!';
const firstName = 'Xoli';
const lastName = 'Nxiweni';
const phone = '+27123456789';

async function createAdminUser() {
  try {
    console.log('👤 Creating admin user...\n');

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      console.log('⚠️  User already exists!');
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log('\n💡 To update password, use updateAdminPassword script');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('✅ Password hashed');

    // Generate SPANA ID
    const spanaAdminId = await generateUserId();
    console.log(`✅ SPANA ID generated: ${spanaAdminId}`);

    // Create user
    const user = await prisma.user.create({
      data: {
        id: spanaAdminId, // Use SPANA ID as the actual ID
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: 'admin',
        isEmailVerified: false, // Will need email verification
        profileImage: '',
        walletBalance: 0,
        status: 'active'
      }
    });
    console.log(`✅ User created: ${user.id}`);

    // Create admin verification record
    const adminVerification = await prisma.adminVerification.create({
      data: {
        adminEmail: email.toLowerCase(),
        verified: false
      }
    });
    console.log(`✅ Admin verification record created: ${adminVerification.id}`);

    console.log('\n🎉 Admin user created successfully!');
    console.log('\n📧 Next steps:');
    console.log('   1. Login: POST /auth/login');
    console.log('   2. You will receive OTP via email');
    console.log('   3. Verify OTP: POST /admin/otp/verify');
    console.log('   4. You will receive JWT token');

  } catch (error: any) {
    console.error('❌ Error creating admin user:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
