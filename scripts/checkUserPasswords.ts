/**
 * Check User Passwords
 * Checks which users have passwords set
 */

import prisma from '../lib/database';

async function checkPasswords() {
  console.log('🔍 Checking user passwords...\n');

  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: 'xolin' } },
          { email: { contains: 'eks' } },
          { email: { contains: 'admin' } },
          { role: 'admin' }
        ]
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        password: true,
        createdAt: true
      }
    });

    console.log(`Found ${users.length} users:\n`);

    for (const user of users) {
      const hasPassword = user.password && user.password.length > 0;
      const icon = hasPassword ? '✅' : '❌';
      
      console.log(`${icon} ${user.firstName} ${user.lastName}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Password: ${hasPassword ? 'SET (hash: ' + user.password.substring(0, 10) + '...)' : 'NOT SET'}`);
      console.log(`   Created: ${user.createdAt.toISOString()}\n`);
    }

    const withPassword = users.filter(u => u.password && u.password.length > 0);
    const withoutPassword = users.filter(u => !u.password || u.password.length === 0);

    console.log('📊 Summary:');
    console.log(`   Users with password: ${withPassword.length}`);
    console.log(`   Users without password: ${withoutPassword.length}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkPasswords();
