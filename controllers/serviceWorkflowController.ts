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
    // Use findFirst since bookingId is nullable unique
    const existingForBooking = await prisma.serviceWorkflow.findFirst({
      where: { bookingId: bookingId }
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
    if (!bookingId) {
      return res.status(400).json({ message: 'Booking ID is required' });
    }
    
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { serviceId: true }
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Prefer workflow tied to this booking; fallback to service-level workflow
    // Query for booking-specific workflow FIRST (bookingId matches exactly)
    // Since bookingId is @unique, use findFirst with exact match
    // IMPORTANT: Only query for bookingId match - don't fallback unless absolutely necessary
    
    console.log(`[getWorkflow] Looking for workflow with bookingId: ${bookingId}, serviceId: ${booking.serviceId}`);
    // #region agent log
    fetch('http://127.0.0.1:7745/ingest/e74cc868-61c8-46b1-9335-6d9fec3efef6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dad86d'},body:JSON.stringify({sessionId:'dad86d',runId:'get-workflow',hypothesisId:'D',location:'serviceWorkflowController.ts:56',message:'Querying workflow by bookingId',data:{bookingId,serviceId:booking.serviceId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    
    // Query for booking-specific workflow using findFirst with explicit bookingId match
    // Note: Using findFirst instead of findUnique because Prisma may have issues with nullable unique fields
    let wf = await prisma.serviceWorkflow.findFirst({
      where: { 
        bookingId: bookingId // Exact match for this bookingId
      }
    });
    
    console.log(`[getWorkflow] Query result:`, wf ? { id: wf.id, bookingId: wf.bookingId } : 'NOT FOUND');
    // #region agent log
    fetch('http://127.0.0.1:7745/ingest/e74cc868-61c8-46b1-9335-6d9fec3efef6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dad86d'},body:JSON.stringify({sessionId:'dad86d',runId:'get-workflow',hypothesisId:'D',location:'serviceWorkflowController.ts:68',message:'Workflow query result',data:{found:!!wf,workflowId:wf?.id,workflowBookingId:wf?.bookingId,expectedBookingId:bookingId,match:wf?.bookingId===bookingId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    
    // Only fallback to service-level workflow if NO booking-specific workflow found
    // This should rarely happen now that we've cleaned up NULL workflows
    if (!wf) {
      console.warn(`[getWorkflow] No booking-specific workflow found for bookingId: ${bookingId}, falling back to service-level workflow`);
      wf = await prisma.serviceWorkflow.findFirst({
        where: { 
          AND: [
            { serviceId: booking.serviceId },
            { bookingId: null } // Service-level workflow (bookingId is null)
          ]
        },
        orderBy: {
          createdAt: 'desc' // Get most recent service-level workflow
        }
      });
      console.log(`[getWorkflow] Fallback result:`, wf ? { id: wf.id, bookingId: wf.bookingId } : 'NOT FOUND');
    }
    
    if (!wf) {
      return res.status(404).json({ message: 'Workflow not found' });
    }
    
    console.log(`[getWorkflow] Returning workflow:`, { id: wf.id, bookingId: wf.bookingId, serviceId: wf.serviceId });
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
    // Use findFirst since bookingId is nullable unique
    let wf = await prisma.serviceWorkflow.findFirst({ 
      where: { bookingId: bookingId } 
    });
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
    // Use findFirst since bookingId is nullable unique
    let wf = await prisma.serviceWorkflow.findFirst({ 
      where: { bookingId: bookingId } 
    });
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
