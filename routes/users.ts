import express from 'express';
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const authorize = require('../middleware/roles');

// Get all users (admin only)
router.get('/', authMiddleware, authorize('admin'), userController.getAllUsers);

// Get user by ID
router.get('/:id', authMiddleware, userController.getUserById);

// Update user profile
router.put('/:id', authMiddleware, userController.updateUser);

// Delete user (admin only)
router.delete('/:id', authMiddleware, authorize('admin'), userController.deleteUser);

// Get all providers
router.get('/providers/all', userController.getAllProviders);

// Get providers by service category
router.get('/providers/:serviceCategory', userController.getProvidersByService);

// Verify provider (admin only)
router.post('/verify', authMiddleware, authorize('admin', 'System_admin'), userController.verifyProvider);

module.exports = router;