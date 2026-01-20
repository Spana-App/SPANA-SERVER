/**
 * One-off script to force a service provider invite for an existing user.
 * Usage (from backend directory):
 *   npx ts-node scripts/forceInviteProvider.ts eksnxiweni@gmail.com
 */

import prisma from '../lib/database';
import * as crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mailer = require('../config/mailer');

async function main() {
  const emailArg = process.argv[2];
  const email = (emailArg || process.env.FORCE_INVITE_EMAIL || '').toLowerCase();

  if (!email) {
    console.error('❌ No email provided. Usage: npx ts-node scripts/forceInviteProvider.ts user@example.com');
    process.exit(1);
  }

  console.log(`🔍 Forcing provider invite for: ${email}`);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('❌ User not found in database');
    process.exit(1);
  }

  console.log('✅ User found:', user.id, 'current role:', user.role);

  // Ensure role is service_provider
  if (user.role !== 'service_provider') {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'service_provider' },
    });
    console.log('✅ Updated role to service_provider');
  }

  // Ensure ServiceProvider record exists
  let provider = await prisma.serviceProvider.findUnique({
    where: { userId: user.id },
  });

  if (!provider) {
    provider = await prisma.serviceProvider.create({
      data: {
        userId: user.id,
        skills: [],
        experienceYears: 0,
        isOnline: false,
        rating: 0,
        totalReviews: 0,
        isVerified: false,
        isIdentityVerified: false,
        availability: { days: [], hours: { start: '', end: '' } },
        serviceAreaRadius: 0,
        serviceAreaCenter: { type: 'Point', coordinates: [0, 0] },
        isProfileComplete: false,
      },
    });
    console.log('✅ Created ServiceProvider record:', provider.id);
  } else {
    console.log('ℹ️ ServiceProvider record already exists:', provider.id);
  }

  // Create verification token on ServiceProvider
  const verificationToken = crypto.randomBytes(32).toString('hex');
  await prisma.serviceProvider.update({
    where: { id: provider.id },
    data: {
      verificationToken,
      verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  // Build verification link using CLIENT_URL / EXTERNAL_API_URL, fallback to app URL
  const rawClientUrl =
    process.env.CLIENT_URL ||
    process.env.EXTERNAL_API_URL ||
    'https://app.spana.co.za';
  const cleanClientUrl = rawClientUrl.replace(/\/$/, '');
  const link = `${cleanClientUrl}/verify-provider?token=${verificationToken}&uid=${user.id}`;

  console.log('🔗 Invitation / verification link:', link);

  const name = user.firstName || user.email.split('@')[0];
  await mailer.sendEmailVerification({
    to: user.email,
    name,
    link,
  });

  console.log('✅ Invitation email sent via mailer.sendEmailVerification');
}

main()
  .then(() => {
    console.log('🎉 Force invite script completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Force invite script failed:', err);
    process.exit(1);
  });

