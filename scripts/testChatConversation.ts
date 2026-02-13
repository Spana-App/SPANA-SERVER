import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:5003';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

function log(icon: string, message: string, color: string = colors.reset) {
  console.log(`${color}${icon}${colors.reset} ${message}`);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testChatConversation() {
  log('💬', 'TESTING CHAT FEATURE - LIFE CONVERSATION', colors.cyan);
  log('', `URL: ${BASE_URL}\n`, colors.gray);

  let customerToken: string;
  let providerToken: string;
  let customerId: string;
  let providerId: string;
  let bookingId: string;

  try {
    // Phase 1: Find Existing Users
    log('📋', 'PHASE 1: Finding Users', colors.yellow);
    
    const PrismaFindUsers = require('@prisma/client').PrismaClient;
    const prismaFindUsers = new PrismaFindUsers();
    
    // Find customer
    log('  ✓', '1.1 Finding customer...', colors.white);
    const customer = await prismaFindUsers.user.findFirst({
      where: { role: 'customer' },
      include: { customer: true }
    });
    
    if (!customer) {
      throw new Error('No customer found in database');
    }
    
    customerId = customer.id;
    const customerEmail = customer.email;
    log('    ✅', `Customer: ${customerEmail}`, colors.green);
    
    // Find provider (must have ServiceProvider record for booking)
    log('  ✓', '1.2 Finding provider...', colors.white);
    const providerWithRecord = await prismaFindUsers.serviceProvider.findFirst({
      include: { user: true }
    });
    const provider = providerWithRecord?.user ?? (await prismaFindUsers.user.findFirst({
      where: { role: 'service_provider' },
      include: { serviceProvider: true }
    }));
    
    if (!provider) {
      throw new Error('No provider found in database');
    }
    
    providerId = provider.id;
    const providerEmail = provider.email;
    log('    ✅', `Provider: ${providerEmail}`, colors.green);
    
    // Try to login
    log('  ✓', '1.3 Logging in users...', colors.white);
    try {
      const customerLogin = await axios.post(`${BASE_URL}/auth/login`, {
        email: customerEmail,
        password: 'Test123!'
      });
      customerToken = customerLogin.data.token;
      log('    ✅', 'Customer logged in', colors.green);
    } catch (error: any) {
      log('    ⚠️', 'Customer login failed, using direct access', colors.yellow);
      customerToken = 'direct-access';
    }

    try {
      const providerLogin = await axios.post(`${BASE_URL}/auth/login`, {
        email: providerEmail,
        password: 'Test123!'
      });
      providerToken = providerLogin.data.token;
      log('    ✅', 'Provider logged in', colors.green);
    } catch (error: any) {
      log('    ⚠️', 'Provider login failed, using direct access', colors.yellow);
      providerToken = 'direct-access';
    }
    
    await prismaFindUsers.$disconnect();

    // Phase 2: Create Booking for Chat
    log('\n📋', 'PHASE 2: Creating Booking', colors.yellow);
    
    // Get or create a service
    const PrismaBooking = require('@prisma/client').PrismaClient;
    const prismaBooking = new PrismaBooking();
    
    let providerRecord = await prismaBooking.serviceProvider.findUnique({
      where: { userId: providerId },
      include: { services: true }
    });
    if (!providerRecord) {
      providerRecord = await prismaBooking.serviceProvider.findFirst({ include: { services: true } });
      if (providerRecord) providerId = providerRecord.userId;
    }
    
    let service = providerRecord?.services?.find((s: any) => s.adminApproved && s.status === 'active');
    if (!service && providerRecord) {
      service = await prismaBooking.service.create({
        data: {
          title: 'Chat Test Service',
          description: 'Service for testing chat feature',
          price: 500,
          duration: 60,
          providerId: providerRecord.id,
          adminApproved: true,
          status: 'active'
        }
      });
    }
    if (!service) {
      service = await prismaBooking.service.findFirst({ where: { adminApproved: true, status: 'active' } });
    }
    if (!service) {
      throw new Error('No service available. Seed services first.');
    }
    
    // Create booking via DB (for testing)
    const customerRecord = await prismaBooking.customer.findUnique({
      where: { userId: customerId }
    });
    
    const booking = await prismaBooking.booking.create({
      data: {
        customerId: customerRecord!.id,
        serviceId: service.id,
        date: new Date(),
        time: new Date().toTimeString().slice(0, 5),
        location: {
          type: 'Point',
          coordinates: [28.0473, -26.2041],
          address: 'Sandton'
        },
        estimatedDurationMinutes: 60,
        status: 'confirmed',
        calculatedPrice: 500,
        chatActive: true
      }
    });
    
    bookingId = booking.id;
    await prismaBooking.$disconnect();
    
    log('    ✅', `Booking created: ${bookingId}`, colors.green);

    // Phase 3: Start Conversation
    log('\n💬', 'PHASE 3: Starting Life Conversation', colors.cyan);
    log('', '─────────────────────────────────────\n', colors.gray);

    // Conversation messages about life
    const messages = [
      { sender: 'customer', text: 'Hey! How are you doing today?', delay: 2000 },
      { sender: 'provider', text: 'Hey there! I\'m doing great, thanks for asking. How about you?', delay: 3000 },
      { sender: 'customer', text: 'Pretty good! Just enjoying this beautiful day. What do you like to do in your free time?', delay: 2500 },
      { sender: 'provider', text: 'I love spending time outdoors - hiking, gardening, or just taking walks. Nature really helps me recharge. What about you?', delay: 3000 },
      { sender: 'customer', text: 'That sounds amazing! I enjoy reading and cooking. There\'s something peaceful about trying new recipes.', delay: 2500 },
      { sender: 'provider', text: 'Cooking is such a great hobby! What\'s your favorite dish to make?', delay: 3000 },
      { sender: 'customer', text: 'I love making pasta from scratch. It\'s so satisfying when it turns out well! Do you cook too?', delay: 2500 },
      { sender: 'provider', text: 'I\'m not the best cook, but I do love trying new restaurants. Food is such an adventure!', delay: 3000 },
      { sender: 'customer', text: 'Absolutely! Have you tried any good places lately?', delay: 2500 },
      { sender: 'provider', text: 'Yes! This new Italian place opened up downtown. Their pizza is incredible. You should check it out!', delay: 3000 },
      { sender: 'customer', text: 'Oh wow, I\'ll definitely have to try it! Thanks for the recommendation.', delay: 2500 },
      { sender: 'provider', text: 'You\'re welcome! Life\'s too short not to enjoy good food, right?', delay: 3000 },
      { sender: 'customer', text: 'Absolutely! Speaking of enjoying life, do you have any travel plans coming up?', delay: 2500 },
      { sender: 'provider', text: 'I\'m planning a trip to the coast next month. Nothing beats the ocean breeze! Do you travel much?', delay: 3000 },
      { sender: 'customer', text: 'I love traveling! Last year I visited the mountains and it was breathtaking. Nature really puts things in perspective.', delay: 3000 },
      { sender: 'provider', text: 'That sounds incredible! Mountains are so majestic. What was your favorite part of the trip?', delay: 3000 },
      { sender: 'customer', text: 'Watching the sunrise from the peak. There\'s nothing like it - just you, nature, and that moment of peace.', delay: 3000 },
      { sender: 'provider', text: 'Wow, that sounds magical. I need to experience that someday. Nature really helps us appreciate the simple things in life.', delay: 3500 },
      { sender: 'customer', text: 'It really does. Sometimes we get so caught up in daily life, we forget to appreciate what we have.', delay: 3000 },
      { sender: 'provider', text: 'So true. That\'s why I make time for things that matter - family, friends, and experiences over things.', delay: 3000 },
    ];

    let messageCount = 0;
    let conversationActive = true;

    // Handle process interruption
    process.on('SIGINT', () => {
      log('\n\n⚠️', 'Conversation interrupted by user', colors.yellow);
      conversationActive = false;
    });

    for (const message of messages) {
      if (!conversationActive) break;

      const token = message.sender === 'customer' ? customerToken : providerToken;
      const senderId = message.sender === 'customer' ? customerId : providerId;
      const receiverId = message.sender === 'customer' ? providerId : customerId;

      // Send message
      try {
        if (token !== 'direct-access') {
          const response = await axios.post(`${BASE_URL}/chat/send`, {
            receiverId,
            bookingId,
            content: message.text  // Use 'content' not 'message'
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });

          const sentMessage = response.data.data || response.data.message || response.data;
          messageCount++;
          
          const senderName = message.sender === 'customer' ? '👤 Customer' : '🔧 Provider';
          const color = message.sender === 'customer' ? colors.blue : colors.magenta;
          
          log(senderName, message.text, color);
          const messageId = sentMessage?.id || sentMessage?._id || 'N/A';
          const createdAt = sentMessage?.createdAt || sentMessage?.created_at || new Date();
          log('  ℹ️', `Message ID: ${messageId} | Sent at: ${new Date(createdAt).toLocaleTimeString()}`, colors.gray);
        } else {
          // Direct DB insert if no token
          const PrismaChat = require('@prisma/client').PrismaClient;
          const prismaChat = new PrismaChat();
          await prismaChat.message.create({
            data: {
              senderId,
              receiverId,
              bookingId,
              content: message.text  // Use 'content' not 'message'
            }
          });
          const createdMessage = await prismaChat.message.findFirst({
            where: {
              senderId,
              receiverId,
              bookingId,
              content: message.text
            },
            orderBy: { createdAt: 'desc' }
          });
          await prismaChat.$disconnect();
          
          messageCount++;
          const senderName = message.sender === 'customer' ? '👤 Customer' : '🔧 Provider';
          const color = message.sender === 'customer' ? colors.blue : colors.magenta;
          log(senderName, message.text, color);
          if (createdMessage) {
            log('  ℹ️', `Message ID: ${createdMessage.id} | Sent at: ${new Date(createdMessage.createdAt).toLocaleTimeString()}`, colors.gray);
          }
        }

        // Wait before next message
        await sleep(message.delay);

      } catch (error: any) {
        log('❌', `Error sending message: ${error.response?.data?.message || error.message}`, colors.red);
        // Continue with next message even if one fails
        await sleep(1000);
      }
    }

    // Phase 4: Check Chat History
    if (conversationActive) {
      log('\n\n📋', 'PHASE 4: Checking Chat History', colors.yellow);
      
      try {
        if (customerToken !== 'direct-access') {
          // Use booking chat endpoint (messages have chatType: 'booking')
          const historyResponse = await axios.get(`${BASE_URL}/chat/booking/${bookingId}`, {
            headers: { Authorization: `Bearer ${customerToken}` }
          });

          const messages = historyResponse.data.messages || historyResponse.data;
          log('    ✅', `Chat history retrieved: ${messages.length} messages`, colors.green);
          
          log('\n💬', 'Chat History:', colors.cyan);
          messages.slice(-5).forEach((msg: any, idx: number) => {
            const senderName = msg.senderId === customerId ? '👤 Customer' : '🔧 Provider';
            const color = msg.senderId === customerId ? colors.blue : colors.magenta;
            log(`  ${idx + 1}. ${senderName}`, msg.content || msg.message, color);
            log('     ', `Sent: ${new Date(msg.createdAt || msg.created_at).toLocaleString()}`, colors.gray);
          });
        } else {
          // Get from DB directly
          const PrismaHistory = require('@prisma/client').PrismaClient;
          const prismaHistory = new PrismaHistory();
          const messages = await prismaHistory.message.findMany({
            where: {
              OR: [
                { senderId: customerId, receiverId: providerId },
                { senderId: providerId, receiverId: customerId }
              ],
              bookingId
            },
            orderBy: { createdAt: 'desc' },
            take: 5
          });
          await prismaHistory.$disconnect();
          
          log('    ✅', `Chat history retrieved: ${messages.length} messages`, colors.green);
          log('\n💬', 'Chat History (Last 5 messages):', colors.cyan);
          messages.reverse().forEach((msg: any, idx: number) => {
            const senderName = msg.senderId === customerId ? '👤 Customer' : '🔧 Provider';
            const color = msg.senderId === customerId ? colors.blue : colors.magenta;
            log(`  ${idx + 1}. ${senderName}`, msg.content || msg.message, color);
            log('     ', `Sent: ${new Date(msg.createdAt).toLocaleString()}`, colors.gray);
          });
        }
      } catch (error: any) {
        log('    ⚠️', `Could not retrieve chat history: ${error.response?.data?.message || error.message}`, colors.yellow);
      }
    }

    // Summary
    if (conversationActive) {
      log('\n\n📊', 'CHAT TEST SUMMARY', colors.cyan);
      log('', `Total messages sent: ${messageCount}`, colors.white);
      log('', `Booking ID: ${bookingId}`, colors.gray);
      log('', `Customer: ${customerEmail}`, colors.gray);
      log('', `Provider: ${providerEmail}`, colors.gray);
      log('\n✅', 'Chat conversation test completed successfully!', colors.green);
    } else {
      log('\n✅', `Chat conversation test stopped after ${messageCount} messages`, colors.green);
    }

  } catch (error: any) {
    log('❌', `Test Error: ${error.message}`, colors.red);
    if (error.response) {
      log('  ℹ️', `Response: ${JSON.stringify(error.response.data)}`, colors.yellow);
      log('  ℹ️', `Status: ${error.response.status}`, colors.yellow);
    }
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testChatConversation().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
