import prisma from '../lib/database';
import bcrypt from 'bcryptjs';

const email = 'xoli@spana.co.za';
const newPassword = 'TestPassword123!';

async function updateAdminPassword() {
  try {
    console.log('🔐 Updating admin password...\n');

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      console.log('❌ User not found!');
      console.log('💡 Use createAdminUser script to create the user first');
      return;
    }

    console.log(`✅ User found: ${user.id}`);
    console.log(`   Current role: ${user.role}`);

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    console.log('✅ New password hashed');

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    console.log('✅ Password updated successfully!');
    console.log('\n📧 You can now login:');
    console.log('   1. POST /auth/login with email and new password');
    console.log('   2. You will receive OTP via email');
    console.log('   3. Verify OTP: POST /admin/otp/verify');

  } catch (error: any) {
    console.error('❌ Error updating password:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminPassword();
