const mongoose = require('mongoose');

const stepSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const workflowSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  steps: { type: [stepSchema], default: [] },
  currentStep: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('ServiceWorkflow', workflowSchema);
export {};
