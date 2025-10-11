import express from 'express';
const router = express.Router();
const auth = require('../middleware/auth');
const Activity = require('../models/Activity');

// Get my activities (most recent first)
router.get('/', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const activities = await Activity.find({ userId: req.user.id })
      .sort({ timestamp: -1 })
      .limit(limit);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

export {};


