const ServiceWorkflow = require('../models/ServiceWorkflow');
const Booking = require('../models/Booking');

exports.createWorkflowForBooking = async (bookingId: any, steps: any[]) => {
  try {
    const existing = await ServiceWorkflow.findOne({ booking: bookingId });
    if (existing) return existing;
    const wf = await ServiceWorkflow.create({ booking: bookingId, steps, currentStep: 0, status: 'pending' });
    return wf;
  } catch (e) {
    console.error('createWorkflowForBooking error', e);
    throw e;
  }
};

exports.getWorkflow = async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const wf = await ServiceWorkflow.findOne({ booking: bookingId }).populate('steps.assignee', 'firstName lastName email');
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
    const wf = await ServiceWorkflow.findOne({ booking: bookingId });
    if (!wf) return res.status(404).json({ message: 'Workflow not found' });
    if (typeof stepIndex === 'undefined' || !wf.steps[stepIndex]) return res.status(400).json({ message: 'Invalid step index' });
    if (status) wf.steps[stepIndex].status = status;
    if (notes) wf.steps[stepIndex].notes = notes;
    if (assignee) wf.steps[stepIndex].assignee = assignee;
    // update workflow status/currentStep
    const allCompleted = wf.steps.every((s: any) => s.status === 'completed');
    wf.status = allCompleted ? 'completed' : (wf.steps.some((s: any) => s.status === 'in_progress') ? 'in_progress' : wf.status);
    if (wf.steps[stepIndex].status === 'in_progress') wf.currentStep = Number(stepIndex);
    await wf.save();
    res.json(wf);
  } catch (e) {
    console.error('updateStep error', e);
    res.status(500).json({ message: 'Server error' });
  }
};

export {};
