"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');
// Admin verification
router.get('/verify', adminController.verifyAdmin);
router.post('/resend-verification', adminController.resendVerificationEmail);
// Admin OTP authentication
router.post('/otp/request', adminController.requestOTP);
router.post('/otp/verify', adminController.verifyOTP);
// Document verification
router.get('/documents/pending', auth, authorize('admin'), adminController.getPendingDocuments);
router.put('/documents/:docId/verify', auth, authorize('admin'), adminController.verifyDocument);
// Wallet management
router.get('/wallet/transactions', auth, authorize('admin'), adminController.getWalletTransactions);
router.get('/wallet/summary', auth, authorize('admin'), adminController.getWalletSummary);
// Admin dashboard data
router.get('/bookings', auth, authorize('admin'), adminController.getAllBookings);
router.get('/users', auth, authorize('admin'), adminController.getAllUsers);
router.get('/services', auth, authorize('admin'), adminController.getAllServices);
// Service CRUD operations
router.post('/services', auth, authorize('admin'), adminController.createService);
router.put('/services/:id', auth, authorize('admin'), adminController.updateService);
router.post('/services/:id/approve', auth, authorize('admin'), adminController.approveService);
router.post('/services/:id/assign', auth, authorize('admin'), adminController.assignServiceToProvider);
router.post('/services/:id/unassign', auth, authorize('admin'), adminController.unassignServiceFromProvider);
router.delete('/services/:id', auth, authorize('admin'), adminController.deleteService);
// Provider performance
router.get('/providers/:providerId/performance', auth, authorize('admin'), adminController.getProviderPerformance);
// Complaints management
router.get('/complaints', auth, authorize('admin'), adminController.getAllComplaints);
router.put('/complaints/:id/resolve', auth, authorize('admin'), adminController.resolveComplaint);
// Service Provider Registration (Admin only - creates provider with minimal info)
// Provider will complete profile and set their own password
router.post('/providers/register', auth, authorize('admin'), adminController.registerServiceProvider);
// Admin Registration (Admin only - creates another admin via CMS)
// Admin gets auto-generated password sent via email
router.post('/admins/register', auth, authorize('admin'), adminController.registerAdmin);
// Admin Profile Management (Admin updates their own profile/password)
router.put('/profile', auth, authorize('admin'), adminController.updateAdminProfile);
// Service Provider Applications
// Get all applications (with optional status filter and pagination)
router.get('/applications', auth, authorize('admin'), adminController.getAllApplications);
// Get single application by ID
router.get('/applications/:applicationId', auth, authorize('admin'), adminController.getApplicationById);
// Verify application and create provider account (auto-populated from application)
router.post('/applications/:applicationId/verify', auth, authorize('admin'), adminController.verifyApplicationAndCreateProvider);
// Reject application
router.post('/applications/:applicationId/reject', auth, authorize('admin'), adminController.rejectApplication);
module.exports = router;
