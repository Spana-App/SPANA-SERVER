"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require('mongoose');
const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['system', 'reminder', 'promo'], default: 'system' },
    status: { type: String, enum: ['sent', 'read', 'unread'], default: 'sent' }
}, { timestamps: true });
notificationSchema.index({ userId: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', notificationSchema);
