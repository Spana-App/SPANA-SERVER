"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require('express');
const router = express.Router();
const svc = require('../controllers/serviceWorkflowController');
// GET /workflows/:bookingId
router.get('/:bookingId', svc.getWorkflow);
// PUT /workflows/:bookingId/steps/:stepIndex
router.put('/:bookingId/steps/:stepIndex', svc.updateStep);
module.exports = router;
