"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require('mongoose');
const recommendationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    modelName: { type: String },
    recommendation: { type: mongoose.Schema.Types.Mixed, required: true },
    confidence: { type: Number, min: 0, max: 100 },
    generatedAt: { type: Date, default: Date.now }
}, { timestamps: true });
recommendationSchema.index({ userId: 1, generatedAt: -1 });
module.exports = mongoose.model('Recommendation', recommendationSchema);
