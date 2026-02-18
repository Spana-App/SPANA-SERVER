import prisma from '../lib/database';

exports.createWorkflowForBooking = async (bookingId: any, steps: any[]) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { serviceId: true }
    });
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }
    // One workflow per booking: create new with bookingId (do not reuse by serviceId)
    const existingForBooking = await prisma.serviceWorkflow.findUnique({
      where: { bookingId }
    });
    if (existingForBooking) return existingForBooking;

    const wf = await prisma.serviceWorkflow.create({
      data: {
        serviceId: booking.serviceId,
        bookingId,
        name: 'Booking Workflow',
        description: 'Default workflow for booking',
        steps: steps,
        isActive: true
      }
    });
    return wf;
  } catch (e) {
    console.error('createWorkflowForBooking error', e);
    throw e;
  }
};

exports.getWorkflow = async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { serviceId: true }
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    // Prefer workflow tied to this booking; fallback to service-level workflow
    let wf = await prisma.serviceWorkflow.findUnique({
      where: { bookingId }
    });
    if (!wf) {
      wf = await prisma.serviceWorkflow.findFirst({
        where: { serviceId: booking.serviceId, bookingId: null }
      });
    }
    if (!wf) {
      return res.status(404).json({ message: 'Workflow not found' });
    }
    res.json(wf);
  } catch (e) {
    console.error('Get workflow error', e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateStep = async (req, res) => {
  try {
    const { bookingId, stepIndex } = req.params;
    const { status, notes, assignee } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { serviceId: true }
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    let wf = await prisma.serviceWorkflow.findUnique({ where: { bookingId } });
    if (!wf) {
      wf = await prisma.serviceWorkflow.findFirst({
        where: { serviceId: booking.serviceId, bookingId: null }
      });
    }
    if (!wf) return res.status(404).json({ message: 'Workflow not found' });
    
    // Update the steps array
    const steps = Array.isArray(wf.steps) ? wf.steps as any[] : [];
    if (typeof stepIndex === 'undefined' || !steps[stepIndex]) return res.status(400).json({ message: 'Invalid step index' });
    
    if (status) (steps[stepIndex] as any).status = status;
    if (notes) (steps[stepIndex] as any).notes = notes;
    if (assignee) (steps[stepIndex] as any).assignee = assignee;
    
    // Update workflow status
    const allCompleted = steps.every((s: any) => s.status === 'completed');
    const newStatus = allCompleted ? 'completed' : (steps.some((s: any) => s.status === 'in_progress') ? 'in_progress' : 'pending');
    
    const updatedWf = await prisma.serviceWorkflow.update({
      where: { id: wf.id },
      data: { 
        steps: steps,
        isActive: newStatus !== 'completed'
      }
    });
    
    res.json(updatedWf);
  } catch (e) {
    console.error('updateStep error', e);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to update workflow step by name
exports.updateWorkflowStepByName = async (bookingId: string, stepName: string, status: string, notes?: string) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { serviceId: true }
    });
    if (!booking) return null;
    // Prefer workflow for this booking; fallback to service-level
    let wf = await prisma.serviceWorkflow.findUnique({ where: { bookingId } });
    if (!wf) {
      wf = await prisma.serviceWorkflow.findFirst({
        where: { serviceId: booking.serviceId, bookingId: null }
      });
    }
    if (!wf) return null;
    
    const steps = Array.isArray(wf.steps) ? wf.steps as any[] : [];
    const stepIndex = steps.findIndex((s: any) => s.name === stepName);
    
    if (stepIndex === -1) return null;
    
    if (status) (steps[stepIndex] as any).status = status;
    if (notes) (steps[stepIndex] as any).notes = notes;
    (steps[stepIndex] as any).updatedAt = new Date();
    
    const allCompleted = steps.every((s: any) => s.status === 'completed');
    const newStatus = allCompleted ? 'completed' : (steps.some((s: any) => s.status === 'in_progress') ? 'in_progress' : 'pending');
    
    const updatedWf = await prisma.serviceWorkflow.update({
      where: { id: wf.id },
      data: { 
        steps: steps,
        isActive: newStatus !== 'completed'
      }
    });
    
    return updatedWf;
  } catch (e) {
    console.error('updateWorkflowStepByName error', e);
    return null;
  }
};

export {};
