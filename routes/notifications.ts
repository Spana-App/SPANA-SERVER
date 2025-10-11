import express from 'express';
const router = express.Router();
const auth = require('../middleware/auth');
const NotificationModel = require('../models/Notification');

// Get my notifications
router.get('/', auth, async (req, res) => {
  try {
  const notifications = await NotificationModel.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark as read
router.post('/:id/read', auth, async (req, res) => {
  try {
  const notification = await NotificationModel.findOne({ _id: req.params.id, userId: req.user.id });
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    notification.status = 'read';
    await notification.save();
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

export {};


