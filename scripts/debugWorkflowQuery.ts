/**
 * Debug script to check workflow queries
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugWorkflowQuery() {
  const bookingId = 'cmlru3rcj00014exgt8itppkf'; // From test
  
  console.log(`\n🔍 Debugging workflow query for bookingId: ${bookingId}\n`);
  
  // Check if workflow exists with this bookingId
  const workflowByBookingId = await prisma.serviceWorkflow.findFirst({
    where: { bookingId: bookingId }
  });
  
  console.log('Query: findFirst({ where: { bookingId: bookingId } })');
  console.log('Result:', workflowByBookingId ? {
    id: workflowByBookingId.id,
    bookingId: workflowByBookingId.bookingId,
    serviceId: workflowByBookingId.serviceId
  } : 'NOT FOUND');
  
  // Check what workflow ID cmlrt4obc00034erw5o07hlpg is
  const mysteryWorkflow = await prisma.serviceWorkflow.findUnique({
    where: { id: 'cmlrt4obc00034erw5o07hlpg' }
  });
  
  console.log('\nMystery workflow (cmlrt4obc00034erw5o07hlpg):');
  console.log(mysteryWorkflow ? {
    id: mysteryWorkflow.id,
    bookingId: mysteryWorkflow.bookingId,
    serviceId: mysteryWorkflow.serviceId,
    name: mysteryWorkflow.name
  } : 'NOT FOUND');
  
  // Get booking to check serviceId
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, serviceId: true }
  });
  
  console.log('\nBooking:', booking);
  
  // Check all workflows for this service
  if (booking) {
    const allServiceWorkflows = await prisma.serviceWorkflow.findMany({
      where: { serviceId: booking.serviceId },
      select: { id: true, bookingId: true, name: true }
    });
    
    console.log(`\nAll workflows for service ${booking.serviceId}:`);
    allServiceWorkflows.forEach(wf => {
      console.log(`  - ${wf.id} | bookingId: ${wf.bookingId || 'NULL'} | name: ${wf.name}`);
    });
  }
  
  await prisma.$disconnect();
}

debugWorkflowQuery();
