/**
 * Creates oscarpoko as a service provider with 100% complete profile
 * and sends him a profile completion email.
 *
 * Run: npx ts-node scripts/createOscarpoko.ts
 */

import prisma from '../lib/database';
const bcrypt = require('bcryptjs');
const { sendProfileCompleteEmail } = require('../config/mailer');

const OSCARPOKO_EMAIL = 'oscarpoko@example.com';
const OSCARPOKO_PASSWORD = 'Oscarpoko123!';

async function createOscarpoko() {
  try {
    console.log('🔧 Creating oscarpoko as service provider with 100% complete profile...\n');

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email: OSCARPOKO_EMAIL },
      include: { serviceProvider: { include: { documents: true } } }
    });

    const hashedPassword = await bcrypt.hash(OSCARPOKO_PASSWORD, 12);

    if (!user) {
      // Create User
      user = await prisma.user.create({
        data: {
          email: OSCARPOKO_EMAIL,
          password: hashedPassword,
          firstName: 'Oscar',
          lastName: 'Poko',
          phone: '+27123456780',
          role: 'service_provider',
          isEmailVerified: true,
          isPhoneVerified: true,
          status: 'active',
          profileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=oscarpoko',
          location: {
            type: 'Point',
            coordinates: [28.0473, -26.2041],
            address: 'Johannesburg, South Africa'
          }
        }
      });
      console.log('   ✅ Created User:', user.email);
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          firstName: 'Oscar',
          lastName: 'Poko',
          phone: '+27123456780',
          role: 'service_provider',
          isEmailVerified: true,
          isPhoneVerified: true,
          profileImage: user.profileImage || 'https://api.dicebear.com/7.x/avataaars/svg?seed=oscarpoko',
          location: user.location || {
            type: 'Point',
            coordinates: [28.0473, -26.2041],
            address: 'Johannesburg, South Africa'
          }
        }
      });
      console.log('   ✅ Updated User:', user.email);
    }

    // Create or update ServiceProvider with 100% complete profile
    let provider = await prisma.serviceProvider.findUnique({
      where: { userId: user.id },
      include: { documents: true }
    });

    const providerData = {
      skills: ['Plumbing', 'Electrical', 'General Maintenance'],
      experienceYears: 8,
      isOnline: true,
      rating: 4.8,
      totalReviews: 42,
      isVerified: true,
      isIdentityVerified: true,
      isProfileComplete: true,
      applicationStatus: 'active',
      availability: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        hours: { start: '08:00', end: '18:00' }
      },
      serviceAreaRadius: 25,
      serviceAreaCenter: {
        type: 'Point',
        coordinates: [28.0473, -26.2041]
      }
    };

    if (!provider) {
      provider = await prisma.serviceProvider.create({
        data: {
          userId: user.id,
          ...providerData
        },
        include: { documents: true }
      });
      console.log('   ✅ Created ServiceProvider record');
    } else {
      provider = await prisma.serviceProvider.update({
        where: { id: provider.id },
        data: providerData,
        include: { documents: true }
      });
      console.log('   ✅ Updated ServiceProvider record (100% complete)');
    }

    // Ensure at least one verified document (required for profile completeness)
    const documentTypes = ['id_number', 'id_picture', 'profile_picture'] as const;
    const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
    const verifiedBy = adminUser?.id || user.id;

    for (const docType of documentTypes) {
      const existing = await prisma.document.findFirst({
        where: { providerId: provider.id, type: docType }
      });

      if (!existing) {
        await prisma.document.create({
          data: {
            providerId: provider.id,
            type: docType,
            url: `https://example.com/uploads/${provider.id}/${docType}.jpg`,
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

    // Ensure user has profile image
    if (!user.profileImage) {
      await prisma.user.update({
        where: { id: user.id },
        data: { profileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=oscarpoko' }
      });
    }

    // Send profile completion email
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { serviceProvider: true }
    });

    if (fullUser) {
      await sendProfileCompleteEmail(fullUser);
      console.log('   ✅ Profile completion email sent to', fullUser.email);
    }

    console.log('\n✅ oscarpoko ready!');
    console.log('\n📋 Account Details:');
    console.log(`   Email: ${OSCARPOKO_EMAIL}`);
    console.log(`   Password: ${OSCARPOKO_PASSWORD}`);
    console.log(`   Profile: 100% complete`);
    console.log(`   Skills: ${providerData.skills.join(', ')}`);
    console.log(`   Experience: ${providerData.experienceYears} years`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createOscarpoko();
