/**
 * Cleanup Script: Delete workflows without bookingId
 * Keeps only booking-specific workflows (where bookingId is set)
 * Deletes service-level workflows (where bookingId is null)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

function log(msg: string, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

async function cleanupWorkflows() {
  try {
    log('\n🧹 CLEANUP: Removing workflows without bookingId', colors.bright + colors.cyan);
    log('='.repeat(70), colors.cyan);

    // Find all workflows without bookingId (service-level workflows)
    const workflowsWithoutBookingId = await prisma.serviceWorkflow.findMany({
      where: {
        bookingId: null
      },
      select: {
        id: true,
        name: true,
        serviceId: true,
        bookingId: true,
        createdAt: true
      }
    });

    log(`\nFound ${workflowsWithoutBookingId.length} workflows without bookingId`, colors.yellow);

    if (workflowsWithoutBookingId.length === 0) {
      log('✅ No workflows to delete. All workflows have bookingId.', colors.green);
      return;
    }

    // Show what will be deleted
    log('\nWorkflows to be deleted:', colors.yellow);
    workflowsWithoutBookingId.forEach((wf, index) => {
      log(`  ${index + 1}. ID: ${wf.id} | Name: ${wf.name} | Service: ${wf.serviceId} | Created: ${wf.createdAt}`, colors.cyan);
    });

    // Count workflows with bookingId (these will be kept)
    const workflowsWithBookingId = await prisma.serviceWorkflow.count({
      where: {
        bookingId: { not: null }
      }
    });

    log(`\n✅ Will keep ${workflowsWithBookingId} workflows with bookingId`, colors.green);

    // Delete workflows without bookingId
    const deleteResult = await prisma.serviceWorkflow.deleteMany({
      where: {
        bookingId: null
      }
    });

    log(`\n✅ Deleted ${deleteResult.count} workflows without bookingId`, colors.green);

    // Verify cleanup
    const remainingWithoutBookingId = await prisma.serviceWorkflow.count({
      where: {
        bookingId: null
      }
    });

    const remainingWithBookingId = await prisma.serviceWorkflow.count({
      where: {
        bookingId: { not: null }
      }
    });

    log('\n' + '='.repeat(70), colors.cyan);
    log('📊 CLEANUP SUMMARY', colors.bright + colors.cyan);
    log(`✅ Workflows with bookingId (kept): ${remainingWithBookingId}`, colors.green);
    log(`❌ Workflows without bookingId (deleted): ${deleteResult.count}`, colors.red);
    log(`⚠️  Remaining workflows without bookingId: ${remainingWithoutBookingId}`, 
         remainingWithoutBookingId > 0 ? colors.yellow : colors.green);

    if (remainingWithoutBookingId === 0) {
      log('\n✅ Cleanup complete! All workflows now have bookingId.', colors.bright + colors.green);
    } else {
      log(`\n⚠️  Warning: ${remainingWithoutBookingId} workflows still without bookingId.`, colors.yellow);
    }

  } catch (error: any) {
    log(`\n❌ Error during cleanup: ${error.message}`, colors.red);
    console.error(error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run cleanup
cleanupWorkflows()
  .then(() => {
    log('\n✅ Cleanup script completed successfully', colors.green);
    process.exit(0);
  })
  .catch((error) => {
    log(`\n❌ Cleanup script failed: ${error.message}`, colors.red);
    process.exit(1);
  });
