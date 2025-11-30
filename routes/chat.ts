const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');

// Get chat history with a user
router.get('/history/:userId', auth, chatController.getChatHistory);

// Get booking chat
router.get('/booking/:bookingId', auth, chatController.getBookingChat);

// Get my chats (chat list)
router.get('/my-chats', auth, chatController.getMyChats);

// Send message
router.post('/send', auth, chatController.sendMessage);

// Get phone number for calling
router.get('/phone/:userId', auth, chatController.getPhoneNumber);
router.get('/phone/booking/:bookingId', auth, chatController.getPhoneNumber);

// Admin: Get all chats (oversee everything)
router.get('/admin/all', auth, authorize('admin'), chatController.getAllChats);

module.exports = router;
export {};

