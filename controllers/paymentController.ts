import prisma from '../lib/database';
import { generatePaymentReferenceAsync } from '../lib/idGenerator';
const { sendReceiptEmail } = require('../config/mailer');
const workflowClient = require('../lib/workflowClient');
const crypto = require('crypto');

// PayFast configuration
const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID;
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY;
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE;
const PAYFAST_URL = process.env.PAYFAST_URL || 'https://sandbox.payfast.co.za/eng/process';

// Generate PayFast signature
function generatePayFastSignature(data: any): string {
  const pfParamString = Object.keys(data)
    .filter(key => data[key] !== '' && key !== 'signature')
    .sort()
    .map(key => `${key}=${encodeURIComponent(data[key])}`)
    .join('&');
  
  return crypto.createHash('md5').update(pfParamString + (PAYFAST_PASSPHRASE ? `&passphrase=${PAYFAST_PASSPHRASE}` : '')).digest('hex');
}


// Create payment intent (PayFast)
exports.createPaymentIntent = async (req, res) => {
  try {
    const { bookingId, amount, currency = 'ZAR', tipAmount = 0 } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: {
          include: {
            provider: { include: { user: true } }
          }
        },
        customer: { include: { user: true } }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Allow payment when booking is pending_payment (customer pays first, then provider accepts)
    if (booking.status !== 'pending_payment' && booking.paymentStatus === 'paid_to_escrow') {
      return res.status(400).json({ message: 'Payment already processed' });
    }

    // Payment should happen BEFORE provider acceptance (Uber-style: pay first, then provider accepts)
    if (booking.paymentStatus === 'paid_to_escrow') {
      return res.status(400).json({ message: 'Payment already completed' });
    }

    // Calculate commission (15% default) - commission on base amount only, tip goes 100% to provider
    const baseAmount = parseFloat(amount);
    const tip = parseFloat(tipAmount) || 0;
    const totalAmount = baseAmount + tip;
    const commissionRate = 0.15;
    const commissionAmount = baseAmount * commissionRate; // Commission only on service, not tip
    const escrowAmount = totalAmount;

    // Create payment record in escrow
    const customer = await prisma.customer.findUnique({
      where: { userId: req.user.id }
    });

    if (!customer) {
      return res.status(400).json({ message: 'Customer profile not found' });
    }

    const referenceNumber = await generatePaymentReferenceAsync();
    const payment = await prisma.payment.create({
      data: {
        referenceNumber, // SPANA-PY-000001
        customerId: customer.id,
        bookingId,
        amount: totalAmount, // Total includes tip
        currency: 'ZAR',
        paymentMethod: 'payfast',
        status: 'pending',
        escrowStatus: 'held',
        commissionRate,
        commissionAmount,
        tipAmount: tip
      }
    });

    // Check if PayFast is configured
    const payfastConfigured = PAYFAST_MERCHANT_ID && PAYFAST_MERCHANT_KEY && PAYFAST_PASSPHRASE;
    
    // Payment simulation mode DISABLED by default
    // Only works if PayFast is configured AND explicitly requested with simulate=true
    const simulatePayment = req.body.simulate === true && payfastConfigured;
    
    if (simulatePayment) {
      // Simulate payment success
      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      
      // Update payment as completed
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'completed',
          escrowStatus: 'held',
          transactionId: `sim_${payment.id}`,
          payfastPaymentId: `sim_${payment.id}`
        }
      });

      // Generate customer chat token when payment is confirmed
      const { generateChatToken } = require('../lib/chatTokens');
      const customerChatToken = generateChatToken(bookingId, req.user.id, 'customer');
      
      // Update booking - payment completed, waiting for provider acceptance
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: 'paid_to_escrow',
          status: 'pending_acceptance', // Changed from 'confirmed' - provider must accept first
          invoiceNumber: invoiceNumber,
          invoiceSentAt: new Date(),
          customerChatToken, // Generate token when payment confirmed
          chatActive: false // Will be true when provider also accepts
        },
        include: {
          customer: { include: { user: true } },
          service: { include: { provider: { include: { user: true } } } }
        }
      });
      
      // If provider already accepted, activate chat
      if (updatedBooking.providerChatToken) {
        await prisma.booking.update({
          where: { id: bookingId },
          data: { chatActive: true }
        });
        
        // Notify both parties that chat is ready
        try {
          const app = require('../server');
          const io = app.get && app.get('io');
          if (io) {
            io.to(updatedBooking.customer.user.id).emit('chat-token-received', {
              bookingId,
              chatToken: customerChatToken,
              chatActive: true
            });
            io.to(updatedBooking.service.provider.user.id).emit('chat-activated', {
              bookingId,
              chatActive: true
            });
            io.to(`booking:${bookingId}`).emit('chatroom-ready', { bookingId, chatActive: true });
          }
        } catch (_) {}
      }

      // Update Spana wallet
      let wallet = await prisma.spanaWallet.findFirst();
      if (!wallet) {
        wallet = await prisma.spanaWallet.create({
          data: {
            totalHeld: 0,
            totalReleased: 0,
            totalCommission: 0
          }
        });
      }

      await prisma.spanaWallet.update({
        where: { id: wallet.id },
        data: {
          totalHeld: { increment: totalAmount }
        }
      });

      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'deposit',
          amount: totalAmount,
          bookingId,
          paymentId: payment.id,
          description: `Payment received for booking ${bookingId} (simulated)`
        }
      });

      // Send invoice
      try {
        const { sendInvoiceEmail } = require('../config/mailer');
        await sendInvoiceEmail({
          to: booking.customer.user.email,
          name: `${booking.customer.user.firstName} ${booking.customer.user.lastName}`,
          invoiceNumber: invoiceNumber,
          bookingId: bookingId,
          serviceTitle: booking.service.title,
          amount: totalAmount,
          currency: 'ZAR',
          jobSize: booking.jobSize,
          basePrice: booking.basePrice,
          multiplier: booking.jobSizeMultiplier,
          calculatedPrice: booking.calculatedPrice,
          tipAmount: tip,
          date: payment.createdAt,
          transactionId: `sim_${payment.id}`
        });
      } catch (_) {}

      // Update workflow
      try {
        const workflowController = require('../controllers/serviceWorkflowController');
        await workflowController.updateWorkflowStepByName(bookingId, 'Payment Received', 'completed', 'Payment received and invoice sent (simulated)');
      } catch (_) {}

      // Notify parties
      try {
        const app = require('../server');
        const io = app.get && app.get('io');
        if (io) {
          io.to(booking.customer.user.id).emit('payment-received', { bookingId });
          io.to(booking.service.provider.user.id).emit('payment-received', { bookingId });
          io.to(`booking:${bookingId}`).emit('chatroom-active', { bookingId });
        }
      } catch (_) {}

      return res.json({
        paymentId: payment.id,
        simulated: true,
        message: 'Payment simulated successfully',
        invoiceNumber: invoiceNumber,
        amount: totalAmount,
        baseAmount: baseAmount,
        tipAmount: tip,
        currency: 'ZAR'
      });
    }

    // Real PayFast payment flow (only if credentials are configured)
    if (!payfastConfigured) {
      return res.status(503).json({
        message: 'PayFast payment gateway is not configured. Payment simulation is disabled.',
        error: 'PAYFAST_NOT_CONFIGURED',
        instructions: 'To enable PayFast payments, add PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, and PAYFAST_PASSPHRASE to your .env file',
        paymentId: payment.id,
        amount: totalAmount,
        baseAmount: baseAmount,
        tipAmount: tip,
        currency: 'ZAR',
        simulated: false
      });
    }

    const payfastData: any = {
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      return_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment-success?bookingId=${bookingId}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment-cancelled?bookingId=${bookingId}`,
      notify_url: `${process.env.CLIENT_URL || 'http://localhost:5003'}/payments/payfast-webhook`,
      name_first: booking.customer.user.firstName,
      name_last: booking.customer.user.lastName,
      email_address: booking.customer.user.email,
      cell_number: booking.customer.user.phone || '',
      amount: totalAmount.toFixed(2),
      item_name: `Service: ${booking.service.title}`,
      custom_str1: bookingId,
      custom_str2: payment.id
    };

    const signature = generatePayFastSignature(payfastData);
    payfastData.signature = signature;

    // Update booking payment status
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: 'pending',
        escrowAmount,
        commissionAmount
      }
    });

    res.json({
      paymentId: payment.id,
      payfastUrl: `${PAYFAST_URL}?${new URLSearchParams(payfastData).toString()}`,
      amount: totalAmount,
      baseAmount: baseAmount,
      tipAmount: tip,
      currency: 'ZAR',
      configured: true
    });
  } catch (error) {
    console.error('createPaymentIntent error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PayFast webhook handler
exports.payfastWebhook = async (req, res) => {
  try {
    // PayFast sends data as form-encoded or query params
    const data = req.method === 'POST' ? req.body : req.query;

    // Verify signature
    const receivedSignature = data.signature;
    const calculatedSignature = generatePayFastSignature(data);
    
    if (receivedSignature !== calculatedSignature) {
      console.error('PayFast signature mismatch');
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const bookingId = data.custom_str1;
    const paymentId = data.custom_str2;

    if (data.payment_status === 'COMPLETE') {
      // Update payment
      const payment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'completed',
          escrowStatus: 'held',
          transactionId: data.pf_payment_id,
          payfastPaymentId: data.pf_payment_id,
          payfastSignature: data.signature
        }
      });

      // Generate invoice number
      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      // Get booking details for invoice
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          service: true,
          customer: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      });

      // Generate customer chat token when payment is confirmed
      const { generateChatToken } = require('../lib/chatTokens');
      const customer = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { customer: { include: { user: true } } }
      });
      const customerChatToken = customer ? generateChatToken(bookingId, customer.customer.userId, 'customer') : null;
      
      // Update booking with invoice number and chat token - payment completed, waiting for provider acceptance
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: 'paid_to_escrow',
          status: 'pending_acceptance', // Provider must accept after payment
          invoiceNumber: invoiceNumber,
          invoiceSentAt: new Date(),
          customerChatToken, // Generate token when payment confirmed
          chatActive: false // Will be true when provider also accepts
        },
        include: {
          customer: { include: { user: true } },
          service: { include: { provider: { include: { user: true } } } }
        }
      });
      
      // If provider already accepted, activate chat
      if (updatedBooking.providerChatToken && customerChatToken) {
        await prisma.booking.update({
          where: { id: bookingId },
          data: { chatActive: true }
        });
        
        // Notify both parties that chat is ready
        try {
          const app = require('../server');
          const io = app.get && app.get('io');
          if (io) {
            io.to(updatedBooking.customer.user.id).emit('chat-token-received', {
              bookingId,
              chatToken: customerChatToken,
              chatActive: true
            });
            if (updatedBooking.service.provider) {
              io.to(updatedBooking.service.provider.user.id).emit('chat-activated', {
                bookingId,
                chatActive: true
              });
            }
            io.to(`booking:${bookingId}`).emit('chatroom-ready', { bookingId, chatActive: true });
          }
        } catch (_) {}
      }

      // Update workflow: Payment Received
      try {
        const workflowController = require('../controllers/serviceWorkflowController');
        await workflowController.updateWorkflowStepByName(bookingId, 'Payment Received', 'completed', 'Payment received and invoice sent');
      } catch (_) {}

      // Update Spana wallet
      let wallet = await prisma.spanaWallet.findFirst();
      if (!wallet) {
        wallet = await prisma.spanaWallet.create({
          data: {
            totalHeld: 0,
            totalReleased: 0,
            totalCommission: 0
          }
        });
      }

      await prisma.spanaWallet.update({
        where: { id: wallet.id },
        data: {
          totalHeld: { increment: payment.amount }
        }
      });

      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'deposit',
          amount: payment.amount,
          bookingId,
          paymentId,
          description: `Payment received for booking ${bookingId}`
        }
      });

      // Notify parties
      try {
        const app = require('../server');
        const io = app.get && app.get('io');
        if (io) {
          const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
              customer: { include: { user: true } },
              service: { include: { provider: { include: { user: true } } } }
            }
          });

          if (booking) {
            io.to(booking.customer.user.id).emit('payment-received', { bookingId });
            io.to(booking.service.provider.user.id).emit('payment-received', { bookingId });
            // Chatroom is now active
            io.to(`booking:${bookingId}`).emit('chatroom-active', { bookingId });
          }
        }
      } catch (_) {}

      // Send receipts
      try {
        const bookingForEmail = await prisma.booking.findUnique({
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
            },
            customer: {
              include: {
                user: {
                  select: { 
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        });

        // Send invoice to customer
        if (bookingForEmail?.customer?.user?.email) {
          const { sendInvoiceEmail } = require('../config/mailer');
          sendInvoiceEmail({
            to: bookingForEmail.customer.user.email,
            name: `${bookingForEmail.customer.user.firstName || ''} ${bookingForEmail.customer.user.lastName || ''}`.trim() || 'Customer',
            invoiceNumber: invoiceNumber,
            bookingId: bookingId,
            serviceTitle: bookingForEmail.service.title,
            amount: payment.amount,
            currency: 'ZAR',
            jobSize: bookingForEmail.jobSize,
            basePrice: bookingForEmail.basePrice,
            multiplier: bookingForEmail.jobSizeMultiplier,
            calculatedPrice: bookingForEmail.calculatedPrice,
            tipAmount: payment.tipAmount || 0,
            date: payment.createdAt,
            transactionId: payment.payfastPaymentId
          }).catch(() => {});
        }

        // Send receipt to provider
        if (bookingForEmail?.service?.provider?.user?.email) {
          const payload = {
            amount: payment.amount,
            currency: 'ZAR',
            bookingId,
            transactionId: payment.payfastPaymentId,
            createdAt: payment.createdAt
          };
          sendReceiptEmail({ to: bookingForEmail.service.provider.user.email, toRole: 'provider', ...payload }).catch(() => {});
        }
      } catch (_) {}

      await prisma.activity.create({
        data: {
          userId: payment.customerId,
          actionType: 'payment_confirm',
          contentId: payment.id,
          contentModel: 'Payment',
          details: { bookingId }
        }
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('PayFast webhook error', error);
    res.status(500).json({ message: 'Webhook processing error' });
  }
};

// Release funds to provider (called when booking is completed)
exports.releaseFunds = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: true,
        service: {
          include: {
            provider: { include: { user: true } }
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Booking must be completed first' });
    }

    if (booking.payment?.escrowStatus !== 'held') {
      return res.status(400).json({ message: 'Funds already released or not in escrow' });
    }

    // Get SLA penalty from booking
    const slaPenaltyAmount = booking.slaPenaltyAmount || 0;

    // Release escrow funds (tip goes 100% to provider, commission only on base amount, SLA penalty deducted)
    const commissionRate = booking.payment.commissionRate || 0.15;
    const tipAmount = booking.payment.tipAmount || 0;
    const baseAmount = booking.payment.amount - tipAmount;
    const commissionAmount = baseAmount * commissionRate; // Commission only on service, not tip
    
    // Deduct both commission AND SLA penalty from provider payout
    // Ensure provider payout never goes negative (minimum R0)
    const providerPayout = Math.max(0, booking.payment.amount - commissionAmount - slaPenaltyAmount);

    await prisma.payment.update({
      where: { id: booking.payment.id },
      data: {
        escrowStatus: 'released',
        commissionAmount,
        providerPayout,
        status: 'completed'
      }
    });

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: 'released_to_provider',
        commissionAmount,
        providerPayoutAmount: providerPayout
      }
    });

    // Update provider wallet
    if (booking.service.provider.user.id) {
      await prisma.user.update({
        where: { id: booking.service.provider.user.id },
        data: {
          walletBalance: { increment: providerPayout }
        }
      });
    }

    // Update Spana wallet
    let wallet = await prisma.spanaWallet.findFirst();
    if (!wallet) {
      wallet = await prisma.spanaWallet.create({
        data: {
          totalHeld: 0,
          totalReleased: 0,
          totalCommission: 0
        }
      });
    }

    await prisma.spanaWallet.update({
      where: { id: wallet.id },
      data: {
        totalHeld: { decrement: booking.payment.amount },
        totalReleased: { increment: providerPayout },
        totalCommission: { increment: commissionAmount }
        // Note: SLA penalty stays in escrow (customer compensation), not added to platform revenue
      }
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'release',
        amount: providerPayout,
        bookingId,
        paymentId: booking.payment.id,
        description: `Released to provider after service completion${slaPenaltyAmount > 0 ? ` (SLA penalty: R${slaPenaltyAmount.toFixed(2)} deducted)` : ''}`
      }
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'commission',
        amount: commissionAmount,
        bookingId,
        paymentId: booking.payment.id,
        description: `Commission earned`
      }
    });

    // Create transaction record for SLA penalty (if applicable)
    if (slaPenaltyAmount > 0) {
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'sla_penalty',
          amount: slaPenaltyAmount,
          bookingId,
          paymentId: booking.payment.id,
          description: `SLA penalty deducted from provider (held for customer compensation)`
        }
      });
    }

    res.json({ message: 'Funds released to provider successfully' });
  } catch (error) {
    console.error('Release funds error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Legacy confirm payment (kept for backward compatibility, but redirects to PayFast)
exports.confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId, bookingId, amount, paymentMethod } = req.body;

    // Note: Stripe support removed, using PayFast only
    // If you need Stripe, uncomment and configure STRIPE_SECRET_KEY
    const stripeClient: any = null; // Stripe removed, use PayFast
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
            currency: req.body.currency || 'ZAR',
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

    // Check booking status - must be pending_payment
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: {
          include: {
            provider: {
              include: { user: true }
            }
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status !== 'pending_payment') {
      return res.status(400).json({ 
        message: `Booking cannot be paid. Current status: ${booking.status}` 
      });
    }

    // Calculate commission and escrow amounts
    const totalAmount = parseFloat(amount);
    const commissionRate = 0.15;
    const commissionAmount = totalAmount * commissionRate;
    const providerPayout = totalAmount - commissionAmount;

    const referenceNumber = await generatePaymentReferenceAsync();
    const payment = await prisma.payment.create({
      data: {
        referenceNumber, // SPANA-PY-000001
        customerId: customer.id,
        bookingId,
        amount: totalAmount,
        currency: 'ZAR',
        paymentMethod: paymentMethod || 'payfast',
        status: 'completed',
        transactionId: paymentIntentId || ('sim_' + Math.random().toString(36).substr(2, 9)),
        escrowStatus: 'held',
        commissionRate,
        commissionAmount,
        providerPayout
      }
    });

    // Update booking: Payment received, now send to provider
    await prisma.booking.update({
      where: { id: bookingId },
      data: { 
        status: 'pending', // Now waiting for provider acceptance
        paymentStatus: 'paid_to_escrow',
        escrowAmount: totalAmount,
        commissionAmount,
        providerPayoutAmount: providerPayout
      }
    });

    // Notify provider via socket that a paid booking is available
    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io && booking.service.provider.user.id) {
        io.to(booking.service.provider.user.id).emit('new-booking-request', {
          bookingId: booking.id,
          service: booking.service.title,
          customer: `${req.user.firstName} ${req.user.lastName}`,
          date: booking.date,
          time: booking.time,
          location: booking.location,
          amount: totalAmount,
          paymentReceived: true
        });
      }
    } catch (_) {}

    // Update workflow: Payment Received
    try {
      const workflowController = require('../controllers/serviceWorkflowController');
      await workflowController.updateWorkflowStepByName(bookingId, 'Payment Required', 'completed', 'Payment received');
      await workflowController.updateWorkflowStepByName(bookingId, 'Provider Assigned', 'pending', 'Waiting for provider acceptance');
    } catch (_) {}

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
        currency: req.body.currency || 'ZAR',
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
    // Admins can see all payments, customers see only their own
    const where: any = req.user.role === 'admin' 
      ? {} // Admin sees all payments
      : { customerId: req.user.id }; // Customer sees only their payments
    
    const payments = await prisma.payment.findMany({
      where,
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

// Legacy webhook handler (kept for backward compatibility)
exports.webhookHandler = async (req: any, res: any) => {
  try {
    // Note: Stripe support removed, using PayFast only
    // Use /payments/payfast-webhook for PayFast webhooks
    const stripeClient: any = null; // Stripe removed, use PayFast
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
                const referenceNumber = await generatePaymentReferenceAsync();
                payment = await prisma.payment.create({
                  data: {
                    referenceNumber, // SPANA-PY-000001
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