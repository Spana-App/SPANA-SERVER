/**
 * Finds Oscar in the users table and makes his service provider profile 100% complete.
 * Run: npx ts-node scripts/completeOscarProfile.ts
 */

import prisma from '../lib/database';
const { sendProfileCompleteEmail } = require('../config/mailer');

// Oscar's email from register-oscar-provider.js
const OSCAR_EMAIL = 'okpoko15@gmail.com';

async function completeOscarProfile() {
  try {
    console.log('🔧 Finding Oscar and completing his profile...\n');

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: OSCAR_EMAIL },
          { email: { contains: 'oscar', mode: 'insensitive' } },
          { firstName: { contains: 'oscar', mode: 'insensitive' } }
        ],
        role: 'service_provider'
      },
      include: { serviceProvider: { include: { documents: true } } }
    });

    if (!user) {
      console.error('❌ Oscar (service provider) not found in users table.');
      console.log('   Tried email:', OSCAR_EMAIL, 'and name containing "oscar"');
      process.exit(1);
    }

    console.log('   Found:', user.email, `(${user.firstName} ${user.lastName})`);

    // Ensure User has required fields for profile completeness
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        isPhoneVerified: true,
        profileImage: user.profileImage || 'https://api.dicebear.com/7.x/avataaars/svg?seed=oscar',
        location: user.location || {
          type: 'Point',
          coordinates: [28.0473, -26.2041],
          address: 'Johannesburg, South Africa'
        }
      }
    });

    // Get or create ServiceProvider
    let provider = user.serviceProvider;
    let providerId: string;
    if (!provider) {
      const created = await prisma.serviceProvider.create({
        data: {
          userId: user.id,
          skills: ['Plumbing', 'Electrical', 'General Maintenance'],
          experienceYears: 8,
          isOnline: true,
          rating: 4.8,
          totalReviews: 0,
          isVerified: true,
          isIdentityVerified: true,
          isProfileComplete: true,
          applicationStatus: 'active',
          availability: {
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            hours: { start: '08:00', end: '18:00' }
          },
          serviceAreaRadius: 25,
          serviceAreaCenter: { type: 'Point', coordinates: [28.0473, -26.2041] }
        }
      });
      providerId = created.id;
      console.log('   ✅ Created ServiceProvider record');
    } else {
      const updated = await prisma.serviceProvider.update({
        where: { id: provider.id },
        data: {
          skills: provider.skills?.length ? provider.skills : ['Plumbing', 'Electrical', 'General Maintenance'],
          experienceYears: provider.experienceYears > 0 ? provider.experienceYears : 8,
          isVerified: true,
          isIdentityVerified: true,
          isProfileComplete: true,
          applicationStatus: 'active',
          availability: provider.availability || {
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            hours: { start: '08:00', end: '18:00' }
          },
          serviceAreaRadius: provider.serviceAreaRadius > 0 ? provider.serviceAreaRadius : 25,
          serviceAreaCenter: provider.serviceAreaCenter || { type: 'Point', coordinates: [28.0473, -26.2041] }
        }
      });
      providerId = updated.id;
      console.log('   ✅ Updated ServiceProvider (100% complete)');
    }

    // Ensure at least one verified document
    const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
    const verifiedBy = adminUser?.id || user.id;

    const docTypes = ['id_number', 'id_picture', 'profile_picture'] as const;
    for (const docType of docTypes) {
      const existing = await prisma.document.findFirst({
        where: { providerId, type: docType }
      });
      if (!existing) {
        await prisma.document.create({
          data: {
            providerId,
            type: docType,
            url: `https://example.com/uploads/${providerId}/${docType}.jpg`,
            verified: true,
            verifiedBy,
            verifiedAt: new Date(),
            metadata: docType === 'id_number' ? { idNumber: '8001015009087' } : null
          }
        });
      } else if (!existing.verified) {
        await prisma.document.update({
          where: { id: existing.id },
          data: { verified: true, verifiedBy, verifiedAt: new Date() }
        });
      }
    }
    console.log('   ✅ Verified documents in place');

    // Send profile completion email
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { serviceProvider: true }
    });
    if (fullUser) {
      await sendProfileCompleteEmail(fullUser);
      console.log('   ✅ Profile completion email sent to', fullUser.email);
    }

    console.log('\n✅ Oscar\'s profile is now 100% complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

completeOscarProfile();
