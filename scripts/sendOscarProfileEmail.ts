/**
 * Force-sends the profile completion email to Oscar.
 * Run: npx ts-node scripts/sendOscarProfileEmail.ts
 */

import prisma from '../lib/database';
const { sendProfileCompleteEmail } = require('../config/mailer');

async function sendOscarEmail() {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'okpoko15@gmail.com' },
          { email: 'okpoco15@gmail.com' },
          { email: { contains: 'oscar', mode: 'insensitive' } },
          { firstName: { contains: 'oscar', mode: 'insensitive' } }
        ],
        role: 'service_provider'
      },
      include: { serviceProvider: true }
    });

    if (!user) {
      console.error('❌ Oscar not found.');
      process.exit(1);
    }

    console.log('Sending profile completion email to', user.email, '...');
    await sendProfileCompleteEmail(user);
    console.log('✅ Email sent successfully to', user.email);
  } catch (error: any) {
    console.error('❌ Failed to send email:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

sendOscarEmail();
