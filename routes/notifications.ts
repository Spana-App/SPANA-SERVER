import express from 'express';
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../lib/database').default;

// Get my notifications
router.get('/', auth, async (req, res) => {
  try {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' }
  });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark as read
router.post('/:id/read', auth, async (req, res) => {
  try {
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.user.id }
  });
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    const updatedNotification = await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'read' }
    });
    res.json(updatedNotification);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

export {};


