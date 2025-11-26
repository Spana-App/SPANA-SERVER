"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require('mongoose');
const activitySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    actionType: { type: String, enum: ['register', 'login', 'logout', 'service_create', 'booking_create', 'booking_update', 'booking_cancel', 'payment_confirm', 'payment_refund'], required: true },
    contentId: { type: mongoose.Schema.Types.ObjectId },
    contentModel: { type: String },
    details: { type: mongoose.Schema.Types.Mixed },
    device: { type: String },
    location: { type: String },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });
activitySchema.index({ userId: 1, timestamp: -1 });
module.exports = mongoose.model('Activity', activitySchema);
