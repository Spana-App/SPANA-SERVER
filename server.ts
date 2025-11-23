require('dotenv').config();
import express from 'express';
import prisma, { pool } from './lib/database';
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const chalk = require('chalk');
const redis = require('redis');
const { promisify } = require('util');
const os = require('os');
const dns = require('dns').promises;
const { verifySmtp } = require('./config/mailer');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const serviceRoutes = require('./routes/services');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');
const activityRoutes = require('./routes/activities');
const uploadRoutes = require('./routes/upload');
const workflowRoutes = require('./routes/workflows');

// Initialize Express app
const app = express();

// Optional monitoring setup (wrapped so it won't crash if prom-client not available)
try {
  const setupMonitoring = require('./monitoring');
  if (typeof setupMonitoring === 'function') setupMonitoring(app);
} catch (e) {
  // ignore if monitoring is not configured
}

// Initialize Redis client (optional)
const USE_REDIS = String(process.env.USE_REDIS || '').toLowerCase() === 'true';
const redisClient = USE_REDIS ? redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined
}) : null;

// Promisify Redis methods (guard when disabled)
const redisGet = redisClient ? promisify(redisClient.get).bind(redisClient) : async () => null;
const redisSet = redisClient ? promisify(redisClient.set).bind(redisClient) : async () => {};
const redisDel = redisClient ? promisify(redisClient.del).bind(redisClient) : async () => {};
const redisExists = redisClient ? promisify(redisClient.exists).bind(redisClient) : async () => 0;

// Redis connection event handlers (only if enabled)
if (redisClient) {
  redisClient.on('connect', () => {
    console.log(chalk.yellow('🔗  Redis client connected'));
  });
  redisClient.on('ready', () => {
    console.log(chalk.green('✅  Redis client ready'));
  });
  redisClient.on('error', (err: any) => {
    console.error(chalk.red('❌  Redis client error:'), err);
  });
  redisClient.on('end', () => {
    console.log(chalk.yellow('⚠️   Redis client disconnected'));
  });
}

// Initialize Socket.io
const initSocket = (server: any) => {
  const socketIo = require('socket.io');
  const io = socketIo(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST']
    }
  });

  io.use((socket: any, next: any) => {
    // Authenticate socket connections using JWT from handshake.auth.token
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next();
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role || null;
      // join personal room
      if (socket.userId) socket.join(socket.userId);
      next();
    } catch (err) {
      console.warn('Socket auth failed:', err && err.message);
      // allow connection but unauthenticated (or you can reject: return next(new Error('Unauthorized')))
      next();
    }
  });

  io.on('connection', (socket: any) => {
    // Ensure every socket has an effective user id (fallback to socket.id for unauthenticated connections)
    socket.userId = socket.userId || socket.id;
    console.log(chalk.cyan(`🔌  User connected: ${socket.id} (userId=${socket.userId})`));
    // Join user to their room for private messages
    socket.join(socket.userId);
    // Join booking room for real-time tracking/chat
    socket.on('join-booking', ({ bookingId }: any) => {
      if (bookingId) {
        socket.join(`booking:${bookingId}`);
      }
    });

    // Chat messages within booking room
    socket.on('booking-chat', async ({ bookingId, message }: any) => {
      if (bookingId && message) {
        // persist chat message asynchronously
        try {
          await prisma.message.create({
            data: {
              bookingId,
              senderId: socket.userId || '',
              content: message,
              receiverId: ''
            }
          });
        } catch (_) {}
        io.to(`booking:${bookingId}`).emit('booking-chat', { from: socket.userId, message, ts: Date.now() });
      }
    });

    // Generic chat message (user-to-user)
    socket.on('chat-message', async ({ toUserId, message }: any) => {
      if (!toUserId || !message) return;
      try {
        await prisma.message.create({
          data: {
            bookingId: null,
            senderId: socket.userId || '',
            content: message,
            receiverId: toUserId
          }
        });
      } catch (_) {}
      io.to(toUserId).emit('chat-message', { from: socket.userId, message, ts: Date.now() });
    });

    // Live location updates broadcast
    socket.on('booking-location', ({ bookingId, role, coordinates }: any) => {
      if (bookingId && Array.isArray(coordinates)) {
        io.to(`booking:${bookingId}`).emit('booking-location', { role, coordinates, ts: Date.now() });
      }
    });

    socket.on('booking-request', (data: any) => {
      console.log(chalk.blue(`📨  Booking request received: ${JSON.stringify(data)}`));
      // Handle real-time booking requests
      socket.to(data.providerId).emit('new-booking', data);
    });
    
    // Call signaling events for WebRTC (offer/answer/ice)
    socket.on('call-offer', ({ toUserId, offer, bookingId }: any) => {
      if (!toUserId || !offer) return;
      io.to(toUserId).emit('call-offer', { from: socket.userId, offer, bookingId });
    });

    socket.on('call-answer', ({ toUserId, answer, bookingId }: any) => {
      if (!toUserId || !answer) return;
      io.to(toUserId).emit('call-answer', { from: socket.userId, answer, bookingId });
    });

    socket.on('call-ice', ({ toUserId, candidate }: any) => {
      if (!toUserId || !candidate) return;
      io.to(toUserId).emit('call-ice', { from: socket.userId, candidate });
    });
    
    socket.on('disconnect', () => {
      console.log(chalk.yellow(`🔌  User disconnected: ${socket.id}`));
    });
  });

  return io;
};

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

// Custom Redis store for rate limiting
const RedisStore = require('rate-limit-redis');
// Rate limiting with Redis store (disabled by default)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
//   message: 'Too many requests from this IP, please try again later.',
//   // Using Redis for rate limiting storage
//   store: new RedisStore({
//     client: redisClient,
//     expiry: 15 * 60 // 15 minutes in seconds
//   })
// });
// app.use(limiter);

// Custom logging middleware with cache info
app.use((req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? chalk.red : chalk.green;
    const methodColor = 
      req.method === 'GET' ? chalk.blue :
      req.method === 'POST' ? chalk.green :
      req.method === 'PUT' ? chalk.yellow :
      req.method === 'DELETE' ? chalk.red : chalk.white;
    
    const fromCache = res.get('X-Cache') === 'HIT';
    const cacheIndicator = fromCache ? chalk.magenta('[CACHE]') : '';
    
    console.log(
      chalk.gray(new Date().toISOString()),
      methodColor(req.method.padEnd(7)),
      statusColor(res.statusCode),
      chalk.white(req.originalUrl),
      chalk.gray(`${duration}ms`),
      cacheIndicator
    );
  });
  
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection: only connect when running the server directly
// Make it non-blocking so server starts immediately
if (require.main === module) {
  // Test PostgreSQL connection with retry logic (non-blocking)
  const connectWithRetry = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await prisma.$connect();
        console.log(chalk.green('✅  PostgreSQL connected successfully'));
        return;
      } catch (err: any) {
        console.warn(chalk.yellow(`⚠️  PostgreSQL connection attempt ${i + 1}/${retries} failed:`), err.message);
        if (i === retries - 1) {
          console.error(chalk.red('❌  PostgreSQL connection failed after all retries. Server will continue without database.'));
          console.log(chalk.yellow('💡  You can test the API endpoints, but database operations will fail.'));
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced to 1 second
        }
      }
    }
  };
  
  // Don't await - let server start immediately
  connectWithRetry().catch(() => {});
}

// Add caching middleware for GET requests using cache abstraction or Redis if enabled
const { get: cacheGet, set: cacheSet } = require('./cache');
app.use('/services', async (req: any, res: any, next: any) => {
  if (req.method !== 'GET') return next();
  try {
    const cacheKey = `services:${req.originalUrl}`;
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      console.log(chalk.magenta(`💾  Serving from cache: ${cacheKey}`));
      res.set('X-Cache', 'HIT');
      return res.json(typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData);
    }

    res.originalJson = res.json;
    res.json = (data: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        cacheSet(cacheKey, payload, 'EX', 300).catch((err: any) => console.error(chalk.red('❌  Cache error:'), err));
      }
      return res.originalJson(data);
    };

    next();
  } catch (err) {
    console.error(chalk.red('❌  Cache middleware error:'), err);
    next();
  }
});

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/services', serviceRoutes);
app.use('/bookings', bookingRoutes);
app.use('/payments', paymentRoutes);
app.use('/notifications', notificationRoutes);
app.use('/activities', activityRoutes);
app.use('/uploads', uploadRoutes);
app.use('/workflows', workflowRoutes);
app.use('/email-verification', require('./routes/emailVerification'));
app.use('/admin', require('./routes/admin'));
app.use('/password-reset', require('./routes/passwordReset'));
app.use('/privacy', require('./routes/privacy'));
app.use('/complaints', require('./routes/complaints'));
app.use('/stats', require('./routes/stats'));

// Health check endpoint with Redis status
app.get('/health', async (req: any, res: any) => {
  let dbStatus = 'disconnected';
  let poolStatus = 'disconnected';
  
  try {
    // Test Prisma connection
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'disconnected';
  }

  try {
    // Test PostgreSQL pool connection
    const result = await pool.query('SELECT NOW()');
    poolStatus = 'connected';
  } catch (err) {
    poolStatus = 'disconnected';
  }

  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: dbStatus,
    postgresPool: poolStatus,
    poolStats: {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    },
    redis: USE_REDIS ? (redisClient && (redisClient as any).connected ? 'connected' : 'disconnected') : 'disabled'
  } as any;
  
  console.log(chalk.cyan('🔍  Health check requested'));
  res.status(200).json(healthCheck);
});

// Detailed health check endpoint
app.get('/health/detailed', async (req: any, res: any) => {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'disconnected';
  }

  const healthCheck: any = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    loadAverage: os.loadavg(),
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    database: dbStatus,
    redis: USE_REDIS ? (redisClient && (redisClient as any).connected ? 'connected' : 'disconnected') : 'disabled',
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION || 'unknown'
  };

  if (dbStatus !== 'connected') {
    healthCheck.status = 'ERROR';
    healthCheck.database = 'disconnected';
    console.log(chalk.red('❌  Detailed health check failed - DB disconnected'));
    return res.status(503).json(healthCheck);
  }

  if (USE_REDIS && (!redisClient || !(redisClient as any).connected)) {
    healthCheck.status = 'DEGRADED';
    healthCheck.redis = 'disconnected';
    console.log(chalk.yellow('⚠️   Detailed health check degraded - Redis disconnected'));
  } else {
    console.log(chalk.green('✅  Detailed health check passed'));
  }

  // SMTP
  // SMTP / Mail provider
  const mailProvider = (process.env.MAIL_PROVIDER || 'smtp').toLowerCase();
  const mailEnabled = String(process.env.MAIL_ENABLED || 'true').toLowerCase() === 'true';
  if (!mailEnabled || mailProvider === 'none' || mailProvider === 'disabled') {
    healthCheck.smtp = 'disabled';
  } else {
    try {
      const smtp = await verifySmtp();
      healthCheck.smtp = smtp.ok ? 'connected' : 'disconnected';
      if (!smtp.ok) {
        healthCheck.smtpError = smtp.error;
        if (healthCheck.status === 'OK') healthCheck.status = 'DEGRADED';
        console.log(chalk.red('❌  SMTP verify failed:'), smtp.error);
      }
    } catch (e: any) {
      healthCheck.smtp = 'disconnected';
      healthCheck.smtpError = e && e.message ? e.message : String(e);
      if (healthCheck.status === 'OK') healthCheck.status = 'DEGRADED';
      console.log(chalk.red('❌  SMTP verify failed:'), healthCheck.smtpError);
    }
  }
  
  // return detailed health info
  res.status(200).json(healthCheck);
});

const PORT = process.env.PORT || 5003;

// Ensure the server binds to 0.0.0.0 for Render and other cloud platforms
// Render always sets PORT, so if PORT is set, bind to 0.0.0.0
const HOST = process.env.PORT ? '0.0.0.0' : (process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost');

let server: any = null;
if (require.main === module) {
  try {
    server = app.listen(PORT, HOST, () => {
      console.log(chalk.green(`🚀  Server is running on ${HOST}:${PORT}`));
      console.log(chalk.blue(`📊  Environment: ${chalk.bold(process.env.NODE_ENV || 'development')}`));
      console.log(chalk.cyan(`🔗  Health check available at: ${chalk.underline(`http://${HOST}:${PORT}/health`)}`));
      console.log(chalk.yellow(`🌐  Server bound to: ${HOST}:${PORT}`));

    // Initialize Socket.io
    const io = initSocket(server);
    app.set('io', io); // Make io accessible in routes

    // Startup diagnostics (truly non-blocking, deferred)
    // Run after a short delay to not block server startup
    setTimeout(() => {
      (async () => {
        try {
          const version = process.env.APP_VERSION || 'unknown';
          const redisStatus = USE_REDIS ? (redisClient && (redisClient as any).connected ? 'connected' : 'disconnected') : 'disabled';
          
          // Check database status (with timeout to not block)
          let dbState = 'checking...';
          try {
            const dbCheck = await Promise.race([
              prisma.$queryRaw`SELECT 1`.then(() => 'connected'),
              new Promise(resolve => setTimeout(() => resolve('timeout'), 2000))
            ]);
            dbState = dbCheck === 'connected' ? 'connected' : 'timeout';
          } catch (err) {
            dbState = 'disconnected';
          }
          
          const mem = process.memoryUsage();
          const load = os.loadavg();

          console.log(chalk.white('\n──────────────── Startup Diagnostics ────────────────'));
          console.log(' App version:   ', version);
          console.log(' Node:          ', process.version);
          console.log(' Env:           ', process.env.NODE_ENV);
          console.log(' PostgreSQL:    ', dbState);
          console.log(' Redis:         ', redisStatus);
          console.log(' Memory (MB):   ', `rss=${(mem.rss/1048576).toFixed(1)} heapUsed=${(mem.heapUsed/1048576).toFixed(1)}`);
          console.log(' Load avg:      ', load.map(n => n.toFixed(2)).join(', '));
          console.log(' Routes:        ', ['/auth','/users','/services','/bookings','/payments','/notifications','/activities','/uploads','/email-verification'].join(' '));

          const mailProvider = (process.env.MAIL_PROVIDER || 'smtp').toLowerCase();
          const mailEnabled = String(process.env.MAIL_ENABLED || 'true').toLowerCase() === 'true';
          if (!mailEnabled || mailProvider === 'none' || mailProvider === 'disabled') {
            console.log(' SMTP:          ', 'disabled');
          } else {
            // SMTP verification is slow - do it async without blocking
            require('./config/mailer').verifySmtp().then((smtp: any) => {
              console.log(' SMTP:          ', smtp.ok ? chalk.green(`connected (${mailProvider})`) : chalk.yellow(`checking...`));
            }).catch(() => {
              console.log(' SMTP:          ', chalk.yellow('checking...'));
            });
          }

          // Skip DNS lookup - it's slow and not critical for startup
          console.log('────────────────────────────────────────────────────\n');
        } catch (e: any) {
          // Silently fail - don't block startup
        }
      })();
    }, 500); // Run diagnostics after 500ms, server is already ready
  });
  
  server.on('error', (err: any) => {
    console.error(chalk.red('❌  Server listen error:'), err);
    if (err.code === 'EADDRINUSE') {
      console.error(chalk.red(`❌  Port ${PORT} is already in use`));
    }
    process.exit(1);
  });
  } catch (err: any) {
    console.error(chalk.red('❌  Failed to start server:'), err);
    process.exit(1);
  }
}

// Handle server errors (only if server was started)
// Note: Error handling for listen is now in the try-catch above

// Global error observers (to aid diagnostics)
process.on('unhandledRejection', (reason: any) => {
  console.error(chalk.red('🚨 Unhandled Promise Rejection:'), reason);
});
process.on('uncaughtException', (err: any) => {
  console.error(chalk.red('🚨 Uncaught Exception:'), err);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log(chalk.yellow('\n⚠️   Received shutdown signal, shutting down gracefully'));
  
  try {
    if (server && typeof server.close === 'function') {
      server.close(() => {
        console.log(chalk.green('✅  HTTP server closed'));
      });
    }

    if (prisma) {
      await prisma.$disconnect();
      console.log(chalk.green('✅  Prisma connection closed'));
    }

    if (pool) {
      await pool.end();
      console.log(chalk.green('✅  PostgreSQL pool closed'));
    }

    if (redisClient) {
      if (typeof (redisClient as any).quit === 'function') {
        (redisClient as any).quit(() => {
          console.log(chalk.green('✅  Redis client closed'));
          process.exit(0);
        });
        return;
      }
    }

    process.exit(0);
  } catch (err: any) {
    console.error(chalk.red('❌  Error during shutdown:'), err);
    process.exit(1);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Make Redis client available app-wide
app.set('redisClient', redisClient);
app.set('redisGet', redisGet);
app.set('redisSet', redisSet);
app.set('redisDel', redisDel);
app.set('redisExists', redisExists);

module.exports = app;
// Also export initSocket helper so tests can attach a socket.io server to the app when needed
try {
  module.exports.initSocket = initSocket;
} catch (_) {}


