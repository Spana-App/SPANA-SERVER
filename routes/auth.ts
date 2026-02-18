import express from 'express';
import { body } from 'express-validator';
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').not().isEmpty().trim(),
  body('lastName').not().isEmpty().trim(),
  body('phone').optional({ values: 'null' }).trim()
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
];

// Import multer for file uploads
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for profile image uploads
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: any, file: any, cb: any) => {
    cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.get('/me', auth, authController.getMe); // Get current user's full profile
router.put('/profile', auth, authController.updateProfile); // Update profile (supports partial updates)
router.patch('/profile', auth, authController.updateProfile); // Partial profile update (alias for PUT)
router.post('/profile/image', auth, imageUpload.single('image'), authController.uploadProfileImage); // Upload profile image

// Public endpoint for service provider applications
router.post('/applications/submit', authController.submitApplication);

module.exports = router;
export {};


