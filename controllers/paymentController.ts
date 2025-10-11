const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Activity = require('../models/Activity');
const mongoose = require('mongoose');
const { sendReceiptEmail } = require('../config/mailer');
const workflowClient = require('../lib/workflowClient');

// Stripe integration: use STRIPE_SECRET_KEY when provided, otherwise fall back to simulated behavior
let stripeClient: any = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    const Stripe = require('stripe');
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });
  } catch (err) {
    console.warn('Stripe not available:', err && err.message);
    stripeClient = null;
  }
}

// Create payment intent
exports.createPaymentIntent = async (req, res) => {
  try {
    const { bookingId, amount, currency = 'usd', paymentMethod } = req.body;

    if (stripeClient) {
      // Create a Stripe PaymentIntent
      const pi = await stripeClient.paymentIntents.create({
        amount: Math.round(Number(amount) * 100),
        currency: currency.toLowerCase(),
        metadata: { bookingId, userId: req.user.id },
      });
      return res.json({ id: pi.id, client_secret: pi.client_secret, amount, currency });
    }

    // Fallback simulated intent
    const paymentIntent = {
      id: 'simulated_pi_' + Math.random().toString(36).substr(2, 9),
      client_secret: 'simulated_client_secret_' + Math.random().toString(36).substr(2, 9),
      amount,
      currency,
      paymentMethod
    };

    res.json(paymentIntent);
  } catch (error) {
    console.error('createPaymentIntent error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Confirm payment
exports.confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId, bookingId, amount, paymentMethod } = req.body;

    // If Stripe is enabled, capture or verify the intent
    if (stripeClient && paymentIntentId) {
      try {
        const pi = await stripeClient.paymentIntents.capture(paymentIntentId);
        // Create local payment record using Stripe transaction id
        const payment = new Payment({
          user: req.user.id,
          booking: bookingId,
          amount,
          paymentMethod: paymentMethod || 'stripe',
          status: 'completed',
          transactionId: pi.id
        });
        await payment.save();
        await Booking.findByIdAndUpdate(bookingId, { status: 'confirmed' });
        try {
          await Activity.create({ userId: req.user.id, actionType: 'payment_confirm', contentId: payment._id, contentModel: 'Payment', details: { bookingId } });
        } catch (_) {}

        // Send receipts (fire-and-forget)
        try {
          const booking = await Booking.findById(bookingId).populate({ path: 'service', select: 'provider' });
          const provider = await User.findById(booking.service.provider).select('email');
          const customer = await User.findById(req.user.id).select('email');
          const payload = { amount, currency: req.body.currency || 'USD', bookingId, transactionId: paymentIntentId, createdAt: payment.createdAt };
          if (customer && customer.email) sendReceiptEmail({ to: customer.email, toRole: 'customer', ...payload }).catch(() => {});
          if (provider && provider.email) sendReceiptEmail({ to: provider.email, toRole: 'provider', ...payload }).catch(() => {});
        } catch (_) {}

        return res.json({ message: 'Payment confirmed', payment });
      } catch (stripeErr) {
        console.error('Stripe capture error', stripeErr);
        return res.status(400).json({ message: 'Stripe capture failed', error: stripeErr && stripeErr.message });
      }
    }

    // Fallback: create payment record locally without Stripe
    const payment = new Payment({
      user: req.user.id,
      booking: bookingId,
      amount,
      paymentMethod: paymentMethod || 'manual',
      status: 'completed',
      transactionId: paymentIntentId || ('sim_' + Math.random().toString(36).substr(2, 9))
    });

    await payment.save();
    await Booking.findByIdAndUpdate(bookingId, { status: 'confirmed' });
    try {
      await Activity.create({ userId: req.user.id, actionType: 'payment_confirm', contentId: payment._id, contentModel: 'Payment', details: { bookingId } });
    } catch (_) {}

    // Send receipts (fire-and-forget)
    try {
      const booking = await Booking.findById(bookingId).populate({ path: 'service', select: 'provider' });
      const provider = await User.findById(booking.service.provider).select('email');
      const customer = await User.findById(req.user.id).select('email');
      const payload = { amount, currency: req.body.currency || 'USD', bookingId, transactionId: payment.transactionId, createdAt: payment.createdAt };
      if (customer && customer.email) sendReceiptEmail({ to: customer.email, toRole: 'customer', ...payload }).catch(() => {});
      if (provider && provider.email) sendReceiptEmail({ to: provider.email, toRole: 'provider', ...payload }).catch(() => {});
    } catch (_) {}

    res.json({ message: 'Payment confirmed', payment });
  } catch (error) {
    console.error('confirmPayment error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get payment history for user
exports.getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user.id })
      .populate({ path: 'booking', populate: { path: 'service', select: 'title provider' } })
      .populate('user', 'firstName lastName');
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Refund payment
exports.refundPayment = async (req, res) => {
  try {
    const { paymentId } = req.body;

    const payment = await Payment.findById(paymentId);
    payment.status = 'refunded';
    await payment.save();

    // Update booking status to cancelled
    await Booking.findByIdAndUpdate(payment.booking, { status: 'cancelled' });

    // Log activity
    try {
      await Activity.create({ userId: req.user.id, actionType: 'payment_refund', contentId: payment._id, contentModel: 'Payment', details: { bookingId: payment.booking } });
    } catch (_) {}

    res.json({ message: 'Payment refunded', payment });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export {};

// Optional webhook handler for Stripe events (raw body expected)
exports.webhookHandler = async (req: any, res: any) => {
  try {
    // If Stripe configured, verify signature and handle events
    if (stripeClient && process.env.STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature'];
      let event;
      try {
        event = stripeClient.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.error('Stripe webhook signature verification failed:', err && err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle common events
      if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object;
        try {
          const bookingId = (pi.metadata && pi.metadata.bookingId) || null;
          // Try to find an existing payment by transactionId or bookingId
          let payment = null;
          if (pi.id) payment = await Payment.findOne({ transactionId: pi.id });
          if (!payment && bookingId) payment = await Payment.findOne({ booking: bookingId });

          if (!payment) {
            // Create a new payment record
            const userId = (pi.metadata && pi.metadata.userId) || null;
            payment = new Payment({
              user: userId,
              booking: bookingId,
              amount: (pi.amount && pi.amount / 100) || 0,
              currency: (pi.currency || 'usd').toUpperCase(),
              paymentMethod: 'card',
              status: 'completed',
              transactionId: pi.id
            });
            await payment.save();
          } else {
            // Update existing payment
            payment.status = 'completed';
            payment.transactionId = pi.id;
            await payment.save();
          }

          // Mark booking as confirmed if bookingId present
          if (bookingId) {
            await Booking.findByIdAndUpdate(bookingId, { status: 'confirmed' });
            try {
              await Activity.create({ userId: payment.user || null, actionType: 'payment_confirm', contentId: payment._id, contentModel: 'Payment', details: { bookingId } });
            } catch (_) {}

              // create default workflow for the booking
              try {
                const defaultSteps = [
                  { name: 'Provider assigned', status: 'pending' },
                  { name: 'Service in progress', status: 'pending' },
                  { name: 'Service completed', status: 'pending' }
                ];
                await workflowClient.createWorkflowForBooking(bookingId, defaultSteps).catch(() => {});
              } catch (_) {}

            // Emit socket event to notify parties
            try {
              const app = require('../server');
              const io = app.get && app.get('io');
              if (io) {
                io.to(String(payment.user)).emit('payment-updated', payment);
                const booking = await Booking.findById(bookingId).populate({ path: 'service', select: 'provider' });
                if (booking && booking.service && booking.service.provider) io.to(String(booking.service.provider)).emit('payment-updated', payment);
              }
            } catch (_) {}
          }

          // Send receipts
          try {
            const booking = bookingId ? await Booking.findById(bookingId).populate({ path: 'service', select: 'provider' }) : null;
            const provider = booking ? await User.findById(booking.service.provider).select('email') : null;
            const customer = payment.user ? await User.findById(payment.user).select('email') : null;
            const payload = { amount: payment.amount, currency: payment.currency || 'USD', bookingId, transactionId: payment.transactionId, createdAt: payment.createdAt };
            if (customer && customer.email) sendReceiptEmail({ to: customer.email, toRole: 'customer', ...payload }).catch(() => {});
            if (provider && provider.email) sendReceiptEmail({ to: provider.email, toRole: 'provider', ...payload }).catch(() => {});
          } catch (_) {}
        } catch (reconErr) {
          console.error('Webhook reconcile error', reconErr);
        }
      }
    }
    // If Stripe is not configured (tests/local), attempt to parse JSON body and handle events similarly
    if (!stripeClient) {
      let event: any = req.body;
      try {
        if (Buffer.isBuffer(event)) event = JSON.parse(event.toString('utf8'));
      } catch (e) {
        // ignore parse error
      }

      try {
            if (event && event.type === 'payment_intent.succeeded') {
              const pi = event.data && event.data.object ? event.data.object : event;
              // helper to get a raw native DB handle
              const getRawDb = async () => {
                if (mongoose && mongoose.connection && mongoose.connection.db) return { db: mongoose.connection.db, client: null };
                if (mongoose && (mongoose as any).connections) {
                  const conn = (mongoose as any).connections.find((c: any) => c && c.readyState === 1 && c.db);
                  if (conn && conn.db) return { db: conn.db, client: null };
                }
                // fallback: connect a new MongoClient to the MONGODB_URI (test env should have it)
                const uri = process.env.MONGODB_URI || '';
                if (!uri) return { db: null, client: null };
                try {
                  const { MongoClient } = require('mongodb');
                  const client = new MongoClient(uri);
                  await client.connect();
                  return { db: client.db(), client };
                } catch (e) {
                  return { db: null, client: null };
                }
              };
              const { db: rawDbHandle, client: fallbackClient } = await getRawDb();
              if (!rawDbHandle) throw new Error('No raw DB handle available for webhook fallback');
              const paymentsCol = rawDbHandle.collection('payments');
              const bookingsCol = rawDbHandle.collection('bookings');
              const servicesCol = rawDbHandle.collection('services');
          const bookingId = (pi.metadata && pi.metadata.bookingId) || null;
          const userId = (pi.metadata && pi.metadata.userId) || null;

          // Use the active mongoose connection's native DB collections (raw driver)
          // (handled below via getRawDb())

          const paymentDoc: any = {
            user: userId || null,
            // if bookingId looks like an ObjectId, store it as one so Mongoose queries by ObjectId will match
            booking: null,
            amount: (pi.amount && (pi.amount / 100)) || 0,
            currency: (pi.currency || 'usd').toUpperCase(),
            paymentMethod: 'card',
            status: 'completed',
            transactionId: pi.id,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          try {
            const ObjectId = mongoose.Types.ObjectId;
            if (bookingId && ObjectId.isValid(bookingId)) paymentDoc.booking = new ObjectId(bookingId);
            else paymentDoc.booking = bookingId || null;
          } catch (_) {
            paymentDoc.booking = bookingId || null;
          }

          // paymentDoc may have booking as string id; convert if needed when inserting
          await paymentsCol.insertOne(paymentDoc as any);

          if (bookingId) {
            const ObjectId = mongoose.Types.ObjectId;
            try {
              await bookingsCol.updateOne({ _id: new ObjectId(bookingId) }, { $set: { status: 'confirmed', updatedAt: new Date() } });
            } catch (_) {
              // ignore invalid id formats
            }
            // create workflow using controller helper (best-effort)
            try {
              const defaultSteps = [
                { name: 'Provider assigned', status: 'pending' },
                { name: 'Service in progress', status: 'pending' },
                { name: 'Service completed', status: 'pending' }
              ];
              await workflowClient.createWorkflowForBooking(bookingId, defaultSteps).catch(() => {});
            } catch (_) {}
          }

          // Emit socket events if io available
          try {
            const app = require('../server');
            const io = app.get && app.get('io');
            if (io) {
              if (userId) io.to(String(userId)).emit('payment-updated', paymentDoc);
              if (bookingId) {
                const booking = await bookingsCol.findOne({ _id: new (mongoose as any).Types.ObjectId(bookingId) });
                if (booking && booking.service) {
                  // attempt to notify provider room if service.provider present
                  const svc = await servicesCol.findOne({ _id: booking.service });
                  if (svc && svc.provider) io.to(String(svc.provider)).emit('payment-updated', paymentDoc);
                }
              }
            }
          } catch (_) {}
          // close fallback client if we opened one
          try { if (fallbackClient && typeof fallbackClient.close === 'function') await fallbackClient.close(); } catch (_) {}
        }
      } catch (reconErr) {
        console.error('Webhook reconcile (fallback) error', reconErr);
      }
    }

    // Accept the webhook
    res.json({ received: true });
  } catch (e) {
    console.error('webhookHandler error', e);
    res.status(500).json({ ok: false });
  }
};