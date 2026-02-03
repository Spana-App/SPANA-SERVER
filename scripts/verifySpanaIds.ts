/**
 * Verification Script: Check SPANA IDs
 * Shows examples of migrated SPANA IDs
 */

import prisma from '../lib/database';

async function verifySpanaIds() {
  console.log('🔍 Verifying SPANA IDs\n');

  try {
    // Check Users
    const users = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    console.log('👤 Sample Users:');
    users.forEach((user, idx) => {
      console.log(`   ${idx + 1}. ${user.firstName} ${user.lastName}`);
      console.log(`      Email: ${user.email}`);
      console.log(`      SPANA ID: ${user.id}`);
      console.log(`      Format: ${user.id.startsWith('SPN-') ? '✅ SPANA Format' : '❌ Old Format'}`);
      console.log('');
    });

    // Check Bookings
    const bookings = await prisma.booking.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        referenceNumber: true,
        status: true
      }
    });

    if (bookings.length > 0) {
      console.log('📅 Sample Bookings:');
      bookings.forEach((booking, idx) => {
        console.log(`   ${idx + 1}. Status: ${booking.status}`);
        console.log(`      SPANA ID: ${booking.referenceNumber || 'NOT SET'}`);
        console.log(`      Internal ID: ${booking.id.substring(0, 20)}...`);
        console.log('');
      });
    }

    // Check Payments
    const payments = await prisma.payment.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        referenceNumber: true,
        amount: true,
        status: true
      }
    });

    if (payments.length > 0) {
      console.log('💳 Sample Payments:');
      payments.forEach((payment, idx) => {
        console.log(`   ${idx + 1}. Amount: R${payment.amount}, Status: ${payment.status}`);
        console.log(`      SPANA ID: ${payment.referenceNumber || 'NOT SET'}`);
        console.log(`      Internal ID: ${payment.id.substring(0, 20)}...`);
        console.log('');
      });
    }

    // Check Messages
    const messages = await prisma.message.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        referenceNumber: true,
        content: true
      }
    });

    if (messages.length > 0) {
      console.log('💬 Sample Messages:');
      messages.forEach((message, idx) => {
        const contentPreview = message.content.substring(0, 30) + '...';
        console.log(`   ${idx + 1}. Content: ${contentPreview}`);
        console.log(`      SPANA ID: ${message.referenceNumber || 'NOT SET'}`);
        console.log(`      Internal ID: ${message.id.substring(0, 20)}...`);
        console.log('');
      });
    }

    // Statistics
    const userStats = await prisma.user.aggregate({
      _count: {
        id: true
      },
      where: {
        id: { startsWith: 'SPN-' }
      }
    });

    const bookingStats = await prisma.booking.aggregate({
      _count: {
        referenceNumber: true
      },
      where: {
        referenceNumber: { not: null }
      }
    });

    const paymentStats = await prisma.payment.aggregate({
      _count: {
        referenceNumber: true
      },
      where: {
        referenceNumber: { not: null }
      }
    });

    const messageStats = await prisma.message.aggregate({
      _count: {
        referenceNumber: true
      },
      where: {
        referenceNumber: { not: null }
      }
    });

    console.log('📊 Statistics:');
    console.log(`   Users with SPANA IDs: ${userStats._count.id}`);
    console.log(`   Bookings with SPANA IDs: ${bookingStats._count.referenceNumber}`);
    console.log(`   Payments with SPANA IDs: ${paymentStats._count.referenceNumber}`);
    console.log(`   Messages with SPANA IDs: ${messageStats._count.referenceNumber}`);

    console.log('\n✅ Verification complete!');

  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifySpanaIds();
