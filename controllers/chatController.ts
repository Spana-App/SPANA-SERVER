import prisma from '../lib/database';

// Get chat history between two users (with permission checks)
exports.getChatHistory = async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Permission checks
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Admin can chat with anyone
    if (currentUser.role === 'admin') {
      // Admin can see all chats
    }
    // Provider can chat with admin
    else if (currentUser.role === 'service_provider' && targetUser.role === 'admin') {
      // Provider can chat with admin - allowed
    }
    // Customer can chat with provider (bidirectional)
    else if (
      (currentUser.role === 'customer' && targetUser.role === 'service_provider') ||
      (currentUser.role === 'service_provider' && targetUser.role === 'customer')
    ) {
      // Customer-provider chat - allowed
    }
    // Customer cannot chat with admin directly
    else if (currentUser.role === 'customer' && targetUser.role === 'admin') {
      return res.status(403).json({ 
        message: 'Customers cannot chat with admin directly. Please use the complaint system.' 
      });
    }
    // Provider cannot chat with other providers
    else if (currentUser.role === 'service_provider' && targetUser.role === 'service_provider') {
      return res.status(403).json({ message: 'Providers cannot chat with other providers' });
    }
    // Customer cannot chat with other customers
    else if (currentUser.role === 'customer' && targetUser.role === 'customer') {
      return res.status(403).json({ message: 'Customers cannot chat with other customers' });
    }

    // Get chat history
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUser.id, receiverId: userId },
          { senderId: userId, receiverId: currentUser.id }
        ],
        chatType: currentUser.role === 'service_provider' && targetUser.role === 'admin' 
          ? 'admin' 
          : 'direct'
      },
      orderBy: { createdAt: 'asc' },
      take: 100 // Last 100 messages
    });

    // Mark messages as read
    await prisma.message.updateMany({
      where: {
        senderId: userId,
        receiverId: currentUser.id,
        isRead: false
      },
      data: { isRead: true }
    });

    res.json({
      messages,
      chatWith: {
        id: targetUser.id,
        role: targetUser.role
      }
    });
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get booking chat history
exports.getBookingChat = async (req: any, res: any) => {
  try {
    const { bookingId } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Verify user is involved in booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { include: { user: true } },
        service: { include: { provider: { include: { user: true } } } }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const isCustomer = booking.customer.userId === currentUser.id;
    const isProvider = booking.service.provider?.userId === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to view this chat' });
    }

    // Get booking chat messages
    const messages = await prisma.message.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' }
    });

    // Mark messages as read
    await prisma.message.updateMany({
      where: {
        bookingId,
        senderId: { not: currentUser.id },
        isRead: false
      },
      data: { isRead: true }
    });

    res.json({
      bookingId,
      messages,
      participants: {
        customer: {
          id: booking.customer.user.id,
          name: `${booking.customer.user.firstName} ${booking.customer.user.lastName}`,
          phone: booking.customer.user.phone
        },
        provider: booking.service.provider ? {
          id: booking.service.provider.user.id,
          name: `${booking.service.provider.user.firstName} ${booking.service.provider.user.lastName}`,
          phone: booking.service.provider.user.phone
        } : null
      }
    });
  } catch (error) {
    console.error('Get booking chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send message (with permission checks)
exports.sendMessage = async (req: any, res: any) => {
  try {
    const { receiverId, bookingId, content, chatType } = req.body;
    const currentUser = req.user;

    if (!currentUser || !content) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Permission checks
    if (receiverId) {
      const receiver = await prisma.user.findUnique({
        where: { id: receiverId },
        select: { id: true, role: true }
      });

      if (!receiver) {
        return res.status(404).json({ message: 'Receiver not found' });
      }

      // Provider can chat with admin
      if (currentUser.role === 'service_provider' && receiver.role === 'admin') {
        // Allowed - provider to admin
      }
      // Customer-provider bidirectional chat
      else if (
        (currentUser.role === 'customer' && receiver.role === 'service_provider') ||
        (currentUser.role === 'service_provider' && receiver.role === 'customer')
      ) {
        // Allowed
      }
      // Customer cannot chat with admin
      else if (currentUser.role === 'customer' && receiver.role === 'admin') {
        return res.status(403).json({ 
          message: 'Customers cannot chat with admin. Please use the complaint system to report issues.' 
        });
      }
      // Admin can chat with anyone
      else if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: 'Chat not allowed between these users' });
      }
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        senderId: currentUser.id,
        receiverId: receiverId || null,
        bookingId: bookingId || null,
        content,
        chatType: chatType || (bookingId ? 'booking' : (receiverId && currentUser.role === 'service_provider' ? 'admin' : 'direct')),
        isRead: false
      }
    });

    // Emit via socket if available
    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        if (bookingId) {
          io.to(`booking:${bookingId}`).emit('booking-chat', {
            id: message.id,
            from: currentUser.id,
            message: content,
            ts: message.createdAt
          });
        } else if (receiverId) {
          io.to(receiverId).emit('chat-message', {
            id: message.id,
            from: currentUser.id,
            message: content,
            chatType: message.chatType,
            ts: message.createdAt
          });
        }
      }
    } catch (_) {}

    res.status(201).json({ message: 'Message sent', data: message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all chats for current user (chat list)
exports.getMyChats = async (req: any, res: any) => {
  try {
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get all unique chat partners
    const sentMessages = await prisma.message.findMany({
      where: { senderId: currentUser.id },
      select: { receiverId: true, bookingId: true, chatType: true },
      distinct: ['receiverId', 'bookingId']
    });

    const receivedMessages = await prisma.message.findMany({
      where: { receiverId: currentUser.id },
      select: { senderId: true, bookingId: true, chatType: true },
      distinct: ['senderId', 'bookingId']
    });

    // Combine and get latest message for each chat
    const chatPartners = new Map();

    // Process sent messages
    for (const msg of sentMessages) {
      if (msg.bookingId) {
        const key = `booking:${msg.bookingId}`;
        if (!chatPartners.has(key)) {
          const latest = await prisma.message.findFirst({
            where: { bookingId: msg.bookingId },
            orderBy: { createdAt: 'desc' }
          });
          chatPartners.set(key, { type: 'booking', bookingId: msg.bookingId, latest });
        }
      } else if (msg.receiverId) {
        const key = `user:${msg.receiverId}`;
        if (!chatPartners.has(key)) {
          const latest = await prisma.message.findFirst({
            where: {
              OR: [
                { senderId: currentUser.id, receiverId: msg.receiverId },
                { senderId: msg.receiverId, receiverId: currentUser.id }
              ]
            },
            orderBy: { createdAt: 'desc' }
          });
          const user = await prisma.user.findUnique({
            where: { id: msg.receiverId },
            select: { id: true, firstName: true, lastName: true, role: true, profileImage: true }
          });
          chatPartners.set(key, { type: 'direct', userId: msg.receiverId, user, latest });
        }
      }
    }

    // Process received messages
    for (const msg of receivedMessages) {
      if (msg.bookingId) {
        const key = `booking:${msg.bookingId}`;
        if (!chatPartners.has(key)) {
          const latest = await prisma.message.findFirst({
            where: { bookingId: msg.bookingId },
            orderBy: { createdAt: 'desc' }
          });
          chatPartners.set(key, { type: 'booking', bookingId: msg.bookingId, latest });
        }
      } else if (msg.senderId) {
        const key = `user:${msg.senderId}`;
        if (!chatPartners.has(key)) {
          const latest = await prisma.message.findFirst({
            where: {
              OR: [
                { senderId: currentUser.id, receiverId: msg.senderId },
                { senderId: msg.senderId, receiverId: currentUser.id }
              ]
            },
            orderBy: { createdAt: 'desc' }
          });
          const user = await prisma.user.findUnique({
            where: { id: msg.senderId },
            select: { id: true, firstName: true, lastName: true, role: true, profileImage: true }
          });
          chatPartners.set(key, { type: 'direct', userId: msg.senderId, user, latest });
        }
      }
    }

    res.json({
      chats: Array.from(chatPartners.values())
    });
  } catch (error) {
    console.error('Get my chats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Get all chats (oversee everything)
exports.getAllChats = async (req: any, res: any) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }

    const { type, limit = 50 } = req.query;

    const where: any = {};
    if (type) {
      where.chatType = type;
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    });

    // Get user details for sender and receiver
    const userIds = new Set<string>();
    messages.forEach(msg => {
      userIds.add(msg.senderId);
      if (msg.receiverId) userIds.add(msg.receiverId);
    });

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        profileImage: true,
        phone: true
      }
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    const enrichedMessages = messages.map(msg => ({
      ...msg,
      sender: userMap.get(msg.senderId),
      receiver: msg.receiverId ? userMap.get(msg.receiverId) : null
    }));

    res.json({
      messages: enrichedMessages,
      total: messages.length
    });
  } catch (error) {
    console.error('Get all chats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get phone number for calling (with permission checks)
exports.getPhoneNumber = async (req: any, res: any) => {
  try {
    const { userId, bookingId } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let targetUserId = userId;

    // If bookingId provided, get the other party's phone
    if (bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: { include: { user: true } },
          service: { include: { provider: { include: { user: true } } } }
        }
      });

      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      const isCustomer = booking.customer.userId === currentUser.id;
      const isProvider = booking.service.provider?.userId === currentUser.id;

      if (!isCustomer && !isProvider && currentUser.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized' });
      }

      // Get the other party's phone
      if (isCustomer) {
        targetUserId = booking.service.provider?.userId || '';
      } else if (isProvider) {
        targetUserId = booking.customer.userId;
      }
    }

    if (!targetUserId) {
      return res.status(400).json({ message: 'User ID or Booking ID required' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true
      }
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Permission checks
    // Admin can see anyone's phone
    if (currentUser.role === 'admin') {
      return res.json({
        phone: targetUser.phone,
        user: {
          id: targetUser.id,
          name: `${targetUser.firstName} ${targetUser.lastName}`,
          role: targetUser.role
        }
      });
    }

    // Customer can see provider's phone (and vice versa) if they have a booking
    if (bookingId) {
      return res.json({
        phone: targetUser.phone,
        user: {
          id: targetUser.id,
          name: `${targetUser.firstName} ${targetUser.lastName}`,
          role: targetUser.role
        }
      });
    }

    // Provider can see admin's phone
    if (currentUser.role === 'service_provider' && targetUser.role === 'admin') {
      return res.json({
        phone: targetUser.phone,
        user: {
          id: targetUser.id,
          name: `${targetUser.firstName} ${targetUser.lastName}`,
          role: targetUser.role
        }
      });
    }

    // Customer-provider can see each other's phone if they have active bookings
    if (
      (currentUser.role === 'customer' && targetUser.role === 'service_provider') ||
      (currentUser.role === 'service_provider' && targetUser.role === 'customer')
    ) {
      // Check if they have any active bookings
      const activeBooking = await prisma.booking.findFirst({
        where: {
          OR: [
            {
              customer: { userId: currentUser.id },
              service: { provider: { userId: targetUserId } }
            },
            {
              customer: { userId: targetUserId },
              service: { provider: { userId: currentUser.id } }
            }
          ],
          status: { in: ['confirmed', 'in_progress'] }
        }
      });

      if (activeBooking) {
        return res.json({
          phone: targetUser.phone,
          user: {
            id: targetUser.id,
            name: `${targetUser.firstName} ${targetUser.lastName}`,
            role: targetUser.role
          }
        });
      }
    }

    return res.status(403).json({ message: 'Not authorized to view this phone number' });
  } catch (error) {
    console.error('Get phone number error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export {};

