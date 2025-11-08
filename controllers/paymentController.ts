import prisma from '../lib/database';
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
        // Get customer ID from user
        const customer = await prisma.customer.findUnique({
          where: { userId: req.user.id }
        });

        if (!customer) {
          return res.status(400).json({ message: 'Customer profile not found' });
        }

        const payment = await prisma.payment.create({
          data: {
            customerId: customer.id,
            bookingId,
            amount: parseFloat(amount),
            paymentMethod: paymentMethod || 'stripe',
            status: 'completed',
            transactionId: pi.id
          }
        });

        // Update booking status to confirmed
        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: 'confirmed' }
        });

        try {
          await prisma.activity.create({
            data: {
              userId: req.user.id,
              actionType: 'payment_confirm',
              contentId: payment.id,
              contentModel: 'Payment',
              details: { bookingId }
            }
          });
        } catch (_) {}

        // Send receipts (fire-and-forget)
        try {
          const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
              service: {
                include: {
                  provider: {
                    include: {
                      user: {
                        select: { email: true }
                      }
                    }
                  }
                }
              }
            }
          });

          const customer = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { email: true }
          });

          const payload = {
            amount,
            currency: req.body.currency || 'USD',
            bookingId,
            transactionId: paymentIntentId,
            createdAt: payment.createdAt
          };

          if (customer?.email) sendReceiptEmail({ to: customer.email, toRole: 'customer', ...payload }).catch(() => {});
          if (booking?.service?.provider?.user?.email) sendReceiptEmail({ to: booking.service.provider.user.email, toRole: 'provider', ...payload }).catch(() => {});
        } catch (_) {}

        return res.json({ message: 'Payment confirmed', payment });
      } catch (stripeErr) {
        console.error('Stripe capture error', stripeErr);
        return res.status(400).json({ message: 'Stripe capture failed', error: stripeErr && stripeErr.message });
      }
    }

    // Fallback: create payment record locally without Stripe
    // Get customer ID from user
    const customer = await prisma.customer.findUnique({
      where: { userId: req.user.id }
    });

    if (!customer) {
      return res.status(400).json({ message: 'Customer profile not found' });
    }

    const payment = await prisma.payment.create({
      data: {
        customerId: customer.id,
        bookingId,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod || 'manual',
        status: 'completed',
        transactionId: paymentIntentId || ('sim_' + Math.random().toString(36).substr(2, 9))
      }
    });

    // Update booking status to confirmed
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'confirmed' }
    });

    try {
      await prisma.activity.create({
        data: {
          userId: req.user.id,
          actionType: 'payment_confirm',
          contentId: payment.id,
          contentModel: 'Payment',
          details: { bookingId }
        }
      });
    } catch (_) {}

    // Send receipts (fire-and-forget)
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          service: {
            include: {
              provider: {
                include: {
                  user: {
                    select: { email: true }
                  }
                }
              }
            }
          }
        }
      });

      const customer = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { email: true }
      });

      const payload = {
        amount,
        currency: req.body.currency || 'USD',
        bookingId,
        transactionId: payment.transactionId,
        createdAt: payment.createdAt
      };

      if (customer?.email) sendReceiptEmail({ to: customer.email, toRole: 'customer', ...payload }).catch(() => {});
      if (booking?.service?.provider?.user?.email) sendReceiptEmail({ to: booking.service.provider.user.email, toRole: 'provider', ...payload }).catch(() => {});
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
    const payments = await prisma.payment.findMany({
      where: { customerId: req.user.id },
      include: {
        booking: {
          include: {
            service: {
              include: {
                provider: {
                  include: {
                    user: {
                      select: {
                        firstName: true,
                        lastName: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        customer: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Refund payment
exports.refundPayment = async (req, res) => {
  try {
    const { paymentId } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Update payment status to refunded
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'refunded' }
    });

    // Update booking status to cancelled
    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: 'cancelled' }
    });

    // Log activity
    try {
      await prisma.activity.create({
        data: {
          userId: req.user.id,
          actionType: 'payment_refund',
          contentId: payment.id,
          contentModel: 'Payment',
          details: { bookingId: payment.bookingId }
        }
      });
    } catch (_) {}

    res.json({ message: 'Payment refunded', payment: updatedPayment });
  } catch (error) {
    console.error('refundPayment error', error);
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
          if (pi.id) payment = await prisma.payment.findFirst({ where: { transactionId: pi.id } });
          if (!payment && bookingId) payment = await prisma.payment.findFirst({ where: { bookingId } });

          if (!payment) {
            // Create a new payment record
            const userId = (pi.metadata && pi.metadata.userId) || null;
            
            if (userId) {
              // Get customer ID from user
              const customer = await prisma.customer.findUnique({
                where: { userId }
              });

              if (customer) {
                payment = await prisma.payment.create({
                  data: {
                    customerId: customer.id,
                    bookingId,
                    amount: (pi.amount && pi.amount / 100) || 0,
                    currency: (pi.currency || 'usd').toUpperCase(),
                    paymentMethod: 'card',
                    status: 'completed',
                    transactionId: pi.id
                  }
                });
              }
            }
          } else {
            // Update existing payment
            payment = await prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: 'completed',
                transactionId: pi.id
              }
            });
          }

          // Mark booking as confirmed if bookingId present
          if (bookingId) {
            await prisma.booking.update({
              where: { id: bookingId },
              data: { status: 'confirmed' }
            });

            try {
              await prisma.activity.create({
                data: {
                  userId: payment.customerId || null,
                  actionType: 'payment_confirm',
                  contentId: payment.id,
                  contentModel: 'Payment',
                  details: { bookingId }
                }
              });
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
                io.to(String(payment.customerId)).emit('payment-updated', payment);
                const booking = await prisma.booking.findUnique({
                  where: { id: bookingId },
                  include: {
                    service: {
                      include: {
                        provider: {
                          include: {
                            user: {
                              select: { id: true }
                            }
                          }
                        }
                      }
                    }
                  }
                });
                if (booking?.service?.provider?.user?.id) io.to(String(booking.service.provider.user.id)).emit('payment-updated', payment);
              }
            } catch (_) {}
          }

          // Send receipts
          try {
            const booking = bookingId ? await prisma.booking.findUnique({
              where: { id: bookingId },
              include: {
                service: {
                  include: {
                    provider: {
                      include: {
                        user: {
                          select: { email: true }
                        }
                      }
                    }
                  }
                }
              }
            }) : null;

            const customer = payment.customerId ? await prisma.user.findUnique({
              where: { id: payment.customerId },
              select: { email: true }
            }) : null;

            const payload = {
              amount: payment.amount,
              currency: payment.currency || 'USD',
              bookingId,
              transactionId: payment.transactionId,
              createdAt: payment.createdAt
            };

            if (customer?.email) sendReceiptEmail({ to: customer.email, toRole: 'customer', ...payload }).catch(() => {});
            if (booking?.service?.provider?.user?.email) sendReceiptEmail({ to: booking.service.provider.user.email, toRole: 'provider', ...payload }).catch(() => {});
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
          const bookingId = (pi.metadata && pi.metadata.bookingId) || null;
          const userId = (pi.metadata && pi.metadata.userId) || null;

          // For now, just log the webhook event since we're using Prisma and don't need Mongoose fallback
          console.log('Webhook received (non-Stripe):', { bookingId, userId, amount: pi.amount });

          // TODO: Implement Prisma-based webhook handling if needed
          // For basic functionality, we'll skip the complex Mongoose fallback
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