import express from 'express';
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../lib/database').default;

// Get my activities (most recent first)
router.get('/', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const activities = await prisma.activity.findMany({
      where: { userId: req.user.id }
    });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

export {};


