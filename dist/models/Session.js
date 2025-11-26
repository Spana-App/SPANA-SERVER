"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require('mongoose');
const sessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    token: { type: String, required: true },
    deviceType: { type: String },
    deviceInfo: { type: String },
    loginTime: { type: Date, default: Date.now },
    logoutTime: { type: Date },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });
module.exports = mongoose.model('Session', sessionSchema);
