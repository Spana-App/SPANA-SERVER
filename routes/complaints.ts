const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const auth = require('../middleware/auth');

// User complaint endpoints
router.post('/', auth, complaintController.createComplaint);
router.get('/my-complaints', auth, complaintController.getMyComplaints);
router.get('/:id', auth, complaintController.getComplaintById);

module.exports = router;
export {};


