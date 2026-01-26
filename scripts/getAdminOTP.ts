/**
 * Helper script to get the latest OTP from database for testing
 * Usage: npx ts-node scripts/getAdminOTP.ts [email]
 */

import prisma from '../lib/database';

const adminEmail = process.argv[2] || 'xoli@spana.co.za';

async function getLatestOTP() {
  try {
    console.log(`🔍 Looking for OTP for: ${adminEmail}\n`);

    const otpRecord = await prisma.adminOTP.findFirst({
      where: {
        adminEmail: adminEmail.toLowerCase(),
        used: false,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (otpRecord) {
      console.log('✅ Found valid OTP:');
      console.log(`   OTP: ${otpRecord.otp}`);
      console.log(`   Created: ${otpRecord.createdAt}`);
      console.log(`   Expires: ${otpRecord.expiresAt}`);
      console.log(`   Used: ${otpRecord.used}`);
      console.log(`\n💡 Use this OTP to verify:\n`);
      console.log(`   POST ${process.env.EXTERNAL_API_URL || 'http://localhost:5003'}/admin/otp/verify`);
      console.log(`   Body: { "email": "${adminEmail}", "otp": "${otpRecord.otp}" }`);
    } else {
      console.log('❌ No valid OTP found');
      console.log('\n💡 Request a new OTP:');
      console.log(`   POST ${process.env.EXTERNAL_API_URL || 'http://localhost:5003'}/admin/otp/request`);
      console.log(`   Body: { "email": "${adminEmail}" }`);
    }

    await prisma.$disconnect();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

getLatestOTP();
