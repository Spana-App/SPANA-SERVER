/**
 * Script to mark a booking as completed (for testing)
 * Run: npx ts-node scripts/completeBooking.ts <bookingId>
 */

import prisma from '../lib/database';

const bookingId = process.argv[2];

if (!bookingId) {
  console.error('❌ Please provide a booking ID');
  console.log('Usage: npx ts-node scripts/completeBooking.ts <bookingId>');
  process.exit(1);
}

async function completeBooking() {
  try {
    console.log(`🔧 Completing booking: ${bookingId}\n`);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        customer: {
          include: {
            user: true,
          },
        },
        payment: true,
      },
    });

    if (!booking) {
      console.error('❌ Booking not found');
      process.exit(1);
    }

    console.log(`✅ Found booking: ${booking.referenceNumber}`);
    console.log(`   Current status: ${booking.status}`);
    console.log(`   Request status: ${booking.requestStatus}`);
    console.log(`   Payment status: ${booking.paymentStatus}`);

    if (booking.status === 'completed') {
      console.log('⚠️  Booking is already completed');
      process.exit(0);
    }

    // Update booking to completed
    const completedAt = new Date();
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'completed',
        completedAt: completedAt,
        actualDurationMinutes: booking.estimatedDurationMinutes || 60,
        chatActive: false,
        chatTerminatedAt: new Date(),
      },
    });

    // Update workflow
    try {
      const workflowController = require('../controllers/serviceWorkflowController');
      await workflowController.updateWorkflowStepByName(bookingId, 'Service In Progress', 'completed', 'Service work completed');
      await workflowController.updateWorkflowStepByName(bookingId, 'Service Completed', 'completed', 'Service completed successfully');
    } catch (err) {
      console.log('⚠️  Could not update workflow:', err);
    }

    // Release escrow if payment exists
    if (booking.payment && booking.payment.escrowStatus === 'held') {
      try {
        const { releaseEscrowFunds } = require('../controllers/paymentController');
        await releaseEscrowFunds(booking.payment.id, bookingId);
        console.log('✅ Released escrow funds to provider');
      } catch (err) {
        console.log('⚠️  Could not release escrow:', err);
      }
    }

    console.log(`\n✅ Booking completed successfully!`);
    console.log(`   New status: ${updatedBooking.status}`);
    console.log(`   Completed at: ${completedAt.toLocaleString()}`);
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

completeBooking();
