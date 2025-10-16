// routes/upload.js
import express from 'express';
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');
const prisma = require('../lib/database').default;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Upload profile image
router.post('/profile', auth, imageUpload.single('avatar'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.profileImage = `/uploads/${req.file.filename}`;
    await user.save();
    res.json({ message: 'Profile image uploaded', url: user.profileImage });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload provider documents (pdf/images)
const docUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images or PDF allowed'), false);
    }
  }
});

router.post('/documents', auth, docUpload.array('documents', 5), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'service provider') return res.status(403).json({ message: 'Not authorized' });
    const docs = (req.files || []).map(f => ({ type: 'document', url: `/uploads/${f.filename}`, verified: false }));
    user.documents = [...(user.documents || []), ...docs];
    await user.save();
    res.json({ message: 'Documents uploaded', documents: user.documents });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
// ...existing code...
export {};
// Admin: verify a provider document (toggle verified)
router.post('/documents/:docId/verify', auth, authorize('admin', 'System_admin'), async (req, res) => {
  try {
    const { userId, verified } = req.body;
    const { docId } = req.params;
    if (!userId) return res.status(400).json({ message: 'userId is required' });
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'service provider') return res.status(400).json({ message: 'Target user is not a provider' });

    const doc = (user.documents || []).id(docId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    doc.verified = Boolean(verified);

    // Update identity verification: true if any document verified
    user.isIdentityVerified = user.documents.some(d => d.verified === true);

    await user.save();
    res.json({ message: 'Document verification updated', isIdentityVerified: user.isIdentityVerified, documents: user.documents });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Provider: delete an uploaded document (also remove file from disk)
router.delete('/documents/:docId', auth, async (req, res) => {
  try {
    const { docId } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'service provider') return res.status(403).json({ message: 'Not authorized' });

    const doc = (user.documents || []).id(docId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    // Remove file from disk if exists
    const filePath = doc.url && doc.url.startsWith('/uploads/') ? doc.url.replace('/uploads/', 'uploads/') : null;
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }

    doc.remove();
    // Recompute identity verified flag
    user.isIdentityVerified = user.documents.some(d => d.verified === true);
    await user.save();

    res.json({ message: 'Document removed', isIdentityVerified: user.isIdentityVerified, documents: user.documents });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});