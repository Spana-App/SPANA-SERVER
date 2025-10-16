import prisma from '../lib/database';

exports.createWorkflowForBooking = async (bookingId: any, steps: any[]) => {
  try {
    const existing = await prisma.serviceWorkflow.findFirst({ 
      where: { serviceId: bookingId } 
    });
    if (existing) return existing;
    
    const wf = await prisma.serviceWorkflow.create({ 
      data: { 
        serviceId: bookingId, 
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
    const wf = await prisma.serviceWorkflow.findFirst({ 
      where: { serviceId: bookingId } 
    });
    if (!wf) return res.status(404).json({ message: 'Workflow not found' });
    res.json(wf);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateStep = async (req, res) => {
  try {
    const { bookingId, stepIndex } = req.params;
    const { status, notes, assignee } = req.body;
    const wf = await prisma.serviceWorkflow.findFirst({ 
      where: { serviceId: bookingId } 
    });
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

export {};
