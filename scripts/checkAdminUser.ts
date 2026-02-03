import prisma from '../lib/database';
import bcrypt from 'bcryptjs';

const email = 'xoli@spana.co.za';
const password = 'TestPassword123!';

async function checkAdminUser() {
  try {
    console.log('🔍 Checking admin user...\n');
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        serviceProvider: true,
        customer: true
      }
    });

    if (!user) {
      console.log('❌ User does NOT exist in database');
      console.log('\n💡 To create admin user, you can:');
      console.log('   1. Use admin registration endpoint (if you have another admin)');
      console.log('   2. Manually create via database');
      console.log('   3. Use the createAdminUser script');
      return;
    }

    console.log('✅ User EXISTS in database');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   First Name: ${user.firstName}`);
    console.log(`   Last Name: ${user.lastName}`);
    console.log(`   Email Verified: ${user.isEmailVerified}`);
    console.log(`   Status: ${user.status}`);

    // Check password
    console.log('\n🔐 Checking password...');
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    
    if (isPasswordMatch) {
      console.log('✅ Password is CORRECT');
      console.log('\n📧 Admin login flow:');
      console.log('   1. POST /auth/login with email and password');
      console.log('   2. System will send OTP to your email');
      console.log('   3. POST /admin/otp/verify with email and OTP');
      console.log('   4. You will receive a JWT token');
    } else {
      console.log('❌ Password is INCORRECT');
      console.log('\n💡 Options to fix:');
      console.log('   1. Reset password via database');
      console.log('   2. Use admin profile update endpoint (if you have another admin)');
      console.log('   3. Delete and recreate user');
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      console.log('\n⚠️  WARNING: User role is not "admin"');
      console.log(`   Current role: ${user.role}`);
      console.log('   You may need to update the role to "admin"');
    }

    // Check admin verification
    const adminVerification = await prisma.adminVerification.findFirst({
      where: { adminEmail: email.toLowerCase() }
    });

    if (adminVerification) {
      console.log('\n📋 Admin Verification Status:');
      console.log(`   Verified: ${adminVerification.verified}`);
      console.log(`   Created: ${adminVerification.createdAt}`);
    } else {
      console.log('\n⚠️  No AdminVerification record found');
    }

  } catch (error: any) {
    console.error('❌ Error checking admin user:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminUser();
