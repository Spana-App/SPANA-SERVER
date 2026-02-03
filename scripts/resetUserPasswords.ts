/**
 * Reset User Passwords
 * Resets passwords for specific users to a known value
 */

import prisma from '../lib/database';
import bcrypt from 'bcryptjs';

async function resetPasswords() {
  console.log('🔑 Resetting User Passwords...\n');

  const newPassword = 'Spana@2026';
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  const usersToReset = [
    'xolinxiweni@outlook.com',
    'eksnxiweni@gmail.com',
    'xolinxiweni@gmail.com',
    'xoli@spana.co.za',
    'nhlakanipho@spana.co.za'
  ];

  try {
    for (const email of usersToReset) {
      const user = await prisma.user.findUnique({ where: { email } });
      
      if (user) {
        await prisma.user.update({
          where: { email },
          data: { password: hashedPassword }
        });
        
        console.log(`✅ ${user.firstName} ${user.lastName}`);
        console.log(`   Email: ${email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   New Password: ${newPassword}\n`);
      } else {
        console.log(`⏭️  Skipped: ${email} (not found)\n`);
      }
    }

    console.log('='.repeat(60));
    console.log('✅ Password Reset Complete');
    console.log('='.repeat(60));
    console.log(`\nAll users can now login with password: ${newPassword}`);
    console.log('\n📝 Updated Users:');
    for (const email of usersToReset) {
      console.log(`   - ${email}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetPasswords();
