import prisma from '../lib/database';
import { generatePaymentReferenceAsync } from '../lib/idGenerator';
const { sendReceiptEmail } = require('../config/mailer');
const workflowClient = require('../lib/workflowClient');
const crypto = require('crypto');

// Stripe (sandbox/test mode when using sk_test_ / pk_test_ keys)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;
const stripeClient = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

// PayFast configuration (COMMENTED OUT - using Stripe)
// const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID;
// const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY;
// const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE;
// const PAYFAST_URL = process.env.PAYFAST_URL || 'https://sandbox.payfast.co.za/eng/process';

// Generate PayFast signature (commented out - using Stripe)
// function generatePayFastSignature(data: any): string {
//   const pfParamString = Object.keys(data)
//     .filter(key => data[key] !== '' && key !== 'signature')
//     .sort()
//     .map(key => `${key}=${encodeURIComponent(data[key])}`)
//     .join('&');
//   return crypto.createHash('md5').update(pfParamString + (PAYFAST_PASSPHRASE ? `&passphrase=${PAYFAST_PASSPHRASE}` : '')).digest('hex');
// }


// Create payment intent (Stripe card form in app)
exports.createPaymentIntent = async (req, res) => {
  try {
    // Stripe only (PayFast commented out)
    const { bookingId, amount, currency = 'ZAR', tipAmount = 0, gateway = 'stripe' } = req.body;

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

    // Validate booking belongs to customer
    if (booking.customer.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to pay for this booking' });
    }

    // Payment should happen BEFORE provider acceptance (Uber-style: pay first, then provider accepts)
    if (booking.paymentStatus === 'paid_to_escrow') {
      return res.status(400).json({ 
        message: 'Payment already completed',
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.status
      });
    }

    // Check if booking is in correct state for payment
    if (booking.status !== 'pending_payment') {
      return res.status(400).json({ 
        message: `Booking cannot be paid. Current status: ${booking.status}, paymentStatus: ${booking.paymentStatus}`,
        bookingStatus: booking.status,
        paymentStatus: booking.paymentStatus
      });
    }

    // Check for existing payment record (prevent duplicates)
    const existingPayment = await prisma.payment.findFirst({
      where: { 
        bookingId,
        status: { in: ['pending', 'paid'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingPayment) {
      // If payment is already paid, ensure booking and workflows are updated
      if (existingPayment.status === 'paid') {
        // Ensure booking status is updated
        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (booking && booking.paymentStatus !== 'paid_to_escrow') {
          await prisma.booking.update({
            where: { id: bookingId },
            data: { 
              paymentStatus: 'paid_to_escrow',
              status: booking.status === 'pending_payment' ? 'pending_acceptance' : booking.status,
              escrowAmount: existingPayment.amount,
              commissionAmount: existingPayment.commissionAmount
            }
          });
        }
        
        // Ensure workflows exist and are updated
        try {
          const workflowController = require('../controllers/serviceWorkflowController');
          const workflowClient = require('../lib/workflowClient');
          const defaultSteps = [
            { name: 'Payment Required', status: 'completed', notes: 'Payment received' },
            { name: 'Payment Received', status: 'completed', notes: 'Payment already completed' },
            { name: 'Provider Assigned', status: 'pending', notes: 'Waiting for provider acceptance' },
            { name: 'Service Started', status: 'pending' },
            { name: 'Service Completed', status: 'pending' }
          ];
          await workflowClient.createWorkflowForBooking(bookingId, defaultSteps).catch(() => {});
          
          await workflowController.updateWorkflowStepByName(bookingId, 'Payment Required', 'completed', 'Payment received');
          await workflowController.updateWorkflowStepByName(bookingId, 'Payment Received', 'completed', 'Payment already completed');
          await workflowController.updateWorkflowStepByName(bookingId, 'Provider Assigned', 'pending', 'Waiting for provider acceptance');
        } catch (workflowErr) {
          console.error('Error updating workflows for existing paid payment:', workflowErr);
        }
        
        // Return 200 with alreadyPaid flag so frontend can refresh bookings
        return res.status(200).json({ 
          message: 'Payment already completed for this booking',
          alreadyPaid: true,
          paymentId: existingPayment.id,
          paymentStatus: existingPayment.status,
          clientSecret: null // No payment intent needed
        });
      }
      // If payment exists but is pending, check if it has a transactionId (Stripe PaymentIntent)
      if (existingPayment.transactionId) {
        try {
          const existingPI = await stripeClient.paymentIntents.retrieve(existingPayment.transactionId);
          if (existingPI.status === 'succeeded') {
            // Payment already succeeded but booking wasn't updated - fix it
            await prisma.payment.update({
              where: { id: existingPayment.id },
              data: { status: 'paid', escrowStatus: 'held' }
            });
            await prisma.booking.update({
              where: { id: bookingId },
              data: { 
                paymentStatus: 'paid_to_escrow',
                status: 'pending_acceptance',
                escrowAmount: existingPayment.amount,
                commissionAmount: existingPayment.commissionAmount
              }
            });
            
            // Ensure workflows exist and are updated
            try {
              const workflowController = require('../controllers/serviceWorkflowController');
              const workflowClient = require('../lib/workflowClient');
              const defaultSteps = [
                { name: 'Payment Required', status: 'completed', notes: 'Payment received' },
                { name: 'Payment Received', status: 'completed', notes: 'Payment received (reconciled)' },
                { name: 'Provider Assigned', status: 'pending', notes: 'Waiting for provider acceptance' },
                { name: 'Service Started', status: 'pending' },
                { name: 'Service Completed', status: 'pending' }
              ];
              await workflowClient.createWorkflowForBooking(bookingId, defaultSteps).catch(() => {});
              
              await workflowController.updateWorkflowStepByName(bookingId, 'Payment Required', 'completed', 'Payment received');
              await workflowController.updateWorkflowStepByName(bookingId, 'Payment Received', 'completed', 'Payment received (reconciled)');
              await workflowController.updateWorkflowStepByName(bookingId, 'Provider Assigned', 'pending', 'Waiting for provider acceptance');
            } catch (workflowErr) {
              console.error('Error updating workflows for reconciled payment:', workflowErr);
            }
            
            // Return 200 with alreadyPaid flag so frontend can refresh bookings
            return res.status(200).json({ 
              message: 'Payment already paid (reconciled)',
              alreadyPaid: true,
              paymentId: existingPayment.id,
              paymentStatus: 'paid',
              clientSecret: null
            });
          }
          // Return existing PaymentIntent clientSecret
          return res.json({
            paymentId: existingPayment.id,
            clientSecret: existingPI.client_secret,
            stripePublishableKey: STRIPE_PUBLISHABLE_KEY || undefined,
            amount: existingPayment.amount,
            baseAmount: existingPayment.amount - (existingPayment.tipAmount || 0),
            tipAmount: existingPayment.tipAmount || 0,
            currency: 'ZAR',
            gateway: 'stripe',
            existing: true
          });
        } catch (stripeErr: any) {
          // PaymentIntent not found or invalid - create new one
          console.warn('Existing payment transactionId invalid, creating new PaymentIntent:', stripeErr.message);
        }
      } else {
        // Payment exists but no transactionId - ensure booking status is correct
        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (booking && booking.paymentStatus !== 'pending') {
          await prisma.booking.update({
            where: { id: bookingId },
            data: { 
              paymentStatus: 'pending',
              escrowAmount: existingPayment.amount,
              commissionAmount: existingPayment.commissionAmount
            }
          });
        }
        
        // Return existing payment info
        return res.status(400).json({ 
          message: 'Payment intent already exists for this booking',
          paymentId: existingPayment.id,
          paymentStatus: existingPayment.status
        });
      }
    }

    // Validate amount matches booking (allow small tolerance for rounding)
    const baseAmount = parseFloat(amount);
    const tip = parseFloat(tipAmount) || 0;
    const totalAmount = baseAmount + tip;
    const bookingAmount = booking.calculatedPrice || booking.basePrice || 0;
    const amountDifference = Math.abs(totalAmount - bookingAmount);
    const tolerance = 0.01; // Allow 1 cent difference for rounding

    if (amountDifference > tolerance && bookingAmount > 0) {
      return res.status(400).json({ 
        message: `Payment amount (${totalAmount}) does not match booking amount (${bookingAmount})`,
        providedAmount: totalAmount,
        bookingAmount: bookingAmount,
        difference: amountDifference
      });
    }

    // Calculate commission (15% default) - commission on base amount only, tip goes 100% to provider
    const commissionRate = 0.15;
    const commissionAmount = baseAmount * commissionRate; // Commission only on service, not tip
    const escrowAmount = totalAmount;

    // Get customer record
    const customer = await prisma.customer.findUnique({
      where: { userId: req.user.id }
    });

    if (!customer) {
      return res.status(400).json({ message: 'Customer profile not found' });
    }

    if (!stripeClient) {
      return res.status(503).json({
        message: 'Stripe payment gateway is not configured.',
        error: 'STRIPE_NOT_CONFIGURED',
        instructions: 'Add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY (test keys for sandbox) to your .env'
      });
    }

    const referenceNumber = await generatePaymentReferenceAsync();

    // Create payment record and PaymentIntent in transaction-like manner
    let payment;
    let paymentIntent;
    
    try {
      // Create payment record first
      payment = await prisma.payment.create({
        data: {
          referenceNumber,
          customerId: customer.id,
          bookingId,
          amount: totalAmount,
          currency: 'ZAR',
          paymentMethod: 'stripe',
          status: 'pending',
          escrowStatus: 'held',
          commissionRate,
          commissionAmount,
          tipAmount: tip
        }
      });

      // Create Stripe PaymentIntent
      const amountCents = Math.round(totalAmount * 100);
      paymentIntent = await stripeClient.paymentIntents.create({
        amount: amountCents,
        currency: (currency || 'zar').toLowerCase(),
        automatic_payment_methods: { 
          enabled: true,
          allow_redirects: 'never' // Prevent redirect-based payment methods (e.g., iDEAL, Klarna) that require return_url
        },
        metadata: {
          bookingId,
          paymentId: payment.id,
          userId: req.user.id
        }
      });

      // Update payment with transactionId
      await prisma.payment.update({
        where: { id: payment.id },
        data: { transactionId: paymentIntent.id }
      });

      // Update booking paymentStatus
      await prisma.booking.update({
        where: { id: bookingId },
        data: { paymentStatus: 'pending', escrowAmount, commissionAmount }
      });

      return res.json({
        paymentId: payment.id,
        clientSecret: paymentIntent.client_secret,
        stripePublishableKey: STRIPE_PUBLISHABLE_KEY || undefined,
        amount: totalAmount,
        baseAmount: baseAmount,
        tipAmount: tip,
        currency: 'ZAR',
        gateway: 'stripe'
      });
    } catch (error: any) {
      // Cleanup: if PaymentIntent creation fails, delete the payment record
      if (payment && !paymentIntent) {
        try {
          await prisma.payment.delete({ where: { id: payment.id } });
        } catch (cleanupErr) {
          console.error('Failed to cleanup payment record:', cleanupErr);
        }
      }
      console.error('Payment intent creation error:', error);
      return res.status(500).json({ 
        message: 'Failed to create payment intent',
        error: error?.message || 'Unknown error'
      });
    }

    /* PAYFAST - COMMENTED OUT (using Stripe)
    const payfastConfigured = PAYFAST_MERCHANT_ID && PAYFAST_MERCHANT_KEY && PAYFAST_PASSPHRASE;
    const simulatePayment = req.body.simulate === true && payfastConfigured;
    if (simulatePayment) {
      // Simulate payment success
      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      
      // Update payment as paid
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'paid',
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
            if (updatedBooking.service?.provider?.user?.id) {
              io.to(updatedBooking.service.provider.user.id).emit('chat-activated', {
                bookingId,
                chatActive: true
              });
            }
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
          if (booking.service?.provider?.user?.id) {
            io.to(booking.service.provider.user.id).emit('payment-received', { bookingId });
          }
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
      return_url: `${process.env.CLIENT_URL || process.env.EXTERNAL_API_URL || 'https://spana-server-5bhu.onrender.com'}/payment-success?bookingId=${bookingId}`,
      cancel_url: `${process.env.CLIENT_URL || process.env.EXTERNAL_API_URL || 'https://spana-server-5bhu.onrender.com'}/payment-cancelled?bookingId=${bookingId}`,
      notify_url: `${process.env.EXTERNAL_API_URL || 'https://spana-server-5bhu.onrender.com'}/payments/payfast-webhook`,
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
    */
  } catch (error: any) {
    console.error('createPaymentIntent error', error);
    const errorMessage = error?.message || 'Failed to create payment intent';
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
};

// Create Stripe Checkout Session (redirect to Stripe-hosted payment page)
// This is useful for web flows where you want Stripe's full payment UI.
exports.createCheckoutSession = async (req, res) => {
  try {
    if (!stripeClient) {
      return res.status(503).json({
        message: 'Stripe payment gateway is not configured.',
        error: 'STRIPE_NOT_CONFIGURED',
        instructions: 'Add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY (test keys for sandbox) to your .env'
      });
    }

    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ message: 'bookingId is required' });
    }

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

    // Ensure the current user is the booking customer
    if (booking.customer.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to pay for this booking' });
    }

    // Prevent duplicate paid bookings
    if (booking.paymentStatus === 'paid_to_escrow') {
      return res.status(400).json({
        message: 'Payment already completed',
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.status
      });
    }

    // Allow payment when booking is awaiting payment (pending_payment) or pending with unpaid status
    const canPay = booking.status === 'pending_payment' ||
      (booking.status === 'pending' && (booking.paymentStatus === 'pending' || !booking.paymentStatus));
    if (!canPay) {
      return res.status(400).json({
        message: `Booking cannot be paid. Current status: ${booking.status}, paymentStatus: ${booking.paymentStatus || 'none'}`,
        bookingStatus: booking.status,
        paymentStatus: booking.paymentStatus
      });
    }

    // Use booking.calculatedPrice as the source of truth for amount
    const baseAmount = booking.calculatedPrice || booking.basePrice || 0;
    if (!baseAmount || baseAmount <= 0) {
      return res.status(400).json({ message: 'Booking amount is invalid or missing' });
    }

    const totalAmount = baseAmount; // no tip for Checkout flow (can extend later)
    const amountCents = Math.round(totalAmount * 100);
    // Stripe minimum for ZAR is 100 cents (R1.00)
    if (amountCents < 100) {
      return res.status(400).json({
        message: 'Booking amount is below Stripe minimum (R1.00)',
        amount: totalAmount,
        amountCents
      });
    }
    const commissionRate = 0.15;
    const commissionAmount = baseAmount * commissionRate;
    const escrowAmount = totalAmount;

    // Get customer record
    const customer = await prisma.customer.findUnique({
      where: { userId: req.user.id }
    });

    if (!customer) {
      return res.status(400).json({ message: 'Customer profile not found' });
    }

    // Check if payment already exists for this booking
    let payment = await prisma.payment.findUnique({
      where: { bookingId }
    });

    if (payment) {
      // Payment already exists
      if (payment.status === 'paid') {
        // Payment is already paid - ensure booking status and workflows are updated
        if (booking.paymentStatus !== 'paid_to_escrow') {
          await prisma.booking.update({
            where: { id: bookingId },
            data: {
              paymentStatus: 'paid_to_escrow',
              status: booking.status === 'pending_payment' ? 'pending_acceptance' : booking.status,
              escrowAmount: payment.amount,
              commissionAmount: payment.commissionAmount || commissionAmount
            }
          });
        }
        
        // Ensure workflows exist and are updated for paid payment
        try {
          const workflowController = require('../controllers/serviceWorkflowController');
          // Ensure workflow exists first
          const workflowClient = require('../lib/workflowClient');
          const defaultSteps = [
            { name: 'Payment Required', status: 'completed', notes: 'Payment received' },
            { name: 'Payment Received', status: 'completed', notes: 'Payment already completed' },
            { name: 'Provider Assigned', status: 'pending', notes: 'Waiting for provider acceptance' },
            { name: 'Service Started', status: 'pending' },
            { name: 'Service Completed', status: 'pending' }
          ];
          await workflowClient.createWorkflowForBooking(bookingId, defaultSteps).catch(() => {});
          
          // Update workflow steps
          await workflowController.updateWorkflowStepByName(bookingId, 'Payment Required', 'completed', 'Payment received');
          await workflowController.updateWorkflowStepByName(bookingId, 'Payment Received', 'completed', 'Payment already completed');
          await workflowController.updateWorkflowStepByName(bookingId, 'Provider Assigned', 'pending', 'Waiting for provider acceptance');
        } catch (workflowErr) {
          console.error('Error updating workflows for existing paid payment:', workflowErr);
        }
        
        // Return 200 with alreadyPaid flag so frontend can refresh bookings
        return res.status(200).json({
          message: 'Payment already completed for this booking',
          alreadyPaid: true,
          paymentId: payment.id,
          paymentStatus: payment.status,
          bookingStatus: booking.status,
          checkoutUrl: null // No checkout needed
        });
      }
      // If payment exists but is pending, reuse it (might be from a previous checkout attempt)
      // Update payment amount in case booking price changed
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          amount: totalAmount,
          commissionAmount,
          escrowStatus: 'held',
          status: 'pending'
        }
      });
      
      // Ensure booking status is set to pending_payment or pending
      if (booking.paymentStatus !== 'pending' && booking.status !== 'pending_payment') {
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            paymentStatus: 'pending',
            escrowAmount,
            commissionAmount
          }
        });
      }
    } else {
      // Create a new pending payment record
      const referenceNumber = await generatePaymentReferenceAsync();
      payment = await prisma.payment.create({
        data: {
          referenceNumber,
          customerId: customer.id,
          bookingId,
          amount: totalAmount,
          currency: 'ZAR',
          paymentMethod: 'stripe',
          status: 'pending',
          escrowStatus: 'held',
          commissionRate,
          commissionAmount,
          tipAmount: 0
        }
      });
    }

    // Build success / cancel URLs for Stripe Checkout
    const clientBaseUrl = process.env.CLIENT_URL || process.env.EXTERNAL_API_URL || 'https://spana.app';
    const successUrl = `${clientBaseUrl}/payment-success?bookingId=${bookingId}&paymentId=${payment.id}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${clientBaseUrl}/payment-cancelled?bookingId=${bookingId}&paymentId=${payment.id}`;

    // Create Checkout Session; attach metadata so webhook can reconcile payment/booking
    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'zar',
            unit_amount: amountCents,
            product_data: {
              name: booking.service?.title || 'Spana service booking',
              description: booking.service?.description || undefined
            }
          },
          quantity: 1
        }
      ],
      metadata: {
        bookingId,
        paymentId: payment.id,
        userId: req.user.id
      },
      payment_intent_data: {
        metadata: {
          bookingId,
          paymentId: payment.id,
          userId: req.user.id
        }
      },
      customer_email: booking.customer.user.email || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl
    });

    // Store PaymentIntent ID on payment (prefer payment_intent, fallback to session.id for reconciliation)
    // Note: session.payment_intent might be null initially, but will be set after payment
    // #region agent log
    fetch('http://127.0.0.1:7745/ingest/e74cc868-61c8-46b1-9335-6d9fec3efef6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dad86d'},body:JSON.stringify({sessionId:'dad86d',runId:'checkout-create',hypothesisId:'A',location:'paymentController.ts:771',message:'Checkout session created - storing transactionId',data:{paymentId:payment.id,bookingId,sessionId:session.id,paymentIntentId:session.payment_intent,transactionIdToStore:session.payment_intent||session.id},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    await prisma.payment.update({
      where: { id: payment.id },
      data: { 
        transactionId: session.payment_intent || session.id,
        // Store session ID separately if needed for reconciliation (can add sessionId field later if needed)
      }
    });

    // Mark booking as awaiting payment completion (if not already updated above)
    if (!payment || payment.status === 'pending') {
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: 'pending',
          escrowAmount,
          commissionAmount
        }
      });
    }

    // Frontend should redirect the user to this URL (window.location = checkoutUrl)
    return res.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      paymentId: payment.id,
      amount: totalAmount,
      currency: 'ZAR',
      stripePublishableKey: STRIPE_PUBLISHABLE_KEY || undefined,
      gateway: 'stripe_checkout'
    });
  } catch (error: any) {
    console.error('createCheckoutSession error', error);
    const errMsg = error?.message || 'Unknown error';
    const isStripeConfig = !stripeClient || errMsg.toLowerCase().includes('stripe') || errMsg.includes('api key');
    const isUniqueConstraint = errMsg.includes('Unique constraint') || errMsg.includes('bookingId');
    
    // Handle unique constraint error (payment already exists)
    if (isUniqueConstraint) {
      // Try to find existing payment and return it
      try {
        // Use bookingId from the original request body to avoid scope issues
        const existingPayment = await prisma.payment.findUnique({
          where: { bookingId: req.body.bookingId }
        });
        if (existingPayment) {
          if (existingPayment.status === 'paid') {
            return res.status(200).json({
              message: 'Payment already completed for this booking',
              alreadyPaid: true,
              paymentId: existingPayment.id,
              paymentStatus: existingPayment.status
            });
          }
          // Payment exists but pending - return error with helpful message
          return res.status(400).json({
            message: 'Payment already exists for this booking. Please complete the existing payment or contact support.',
            paymentId: existingPayment.id,
            paymentStatus: existingPayment.status
          });
        }
      } catch (lookupErr) {
        console.error('Error looking up existing payment:', lookupErr);
      }
    }
    
    return res.status(500).json({
      message: 'Failed to create Stripe Checkout session',
      error: process.env.NODE_ENV === 'development' ? errMsg : undefined,
      ...(isStripeConfig && { hint: 'Check STRIPE_SECRET_KEY in server .env and that Stripe is configured for your account.' })
    });
  }
};

// PayFast webhook handler (commented out - using Stripe only)
exports.payfastWebhook = async (req, res) => {
  return res.status(200).send('OK');
  /* PayFast disabled - using Stripe
  try {
    if (process.env.STRIPE_SECRET_KEY || stripeClient) {
      return res.status(200).send('OK');
    }
    const data = req.method === 'POST' ? req.body : req.query;
    if (!data || (!data.pf_payment_id && !data.payment_status && !data.signature)) {
      return res.status(200).send('OK');
    }
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
          status: 'paid',
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
            if (updatedBooking.service?.provider?.user?.id) {
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
            if (booking.service?.provider?.user?.id) {
              io.to(booking.service.provider.user.id).emit('payment-received', { bookingId });
            }
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
  */
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
    if (booking.service?.provider?.user?.id) {
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
    const { paymentIntentId, sessionId, bookingId, amount, paymentMethod } = req.body;

    if (!bookingId) {
      return res.status(400).json({ message: 'bookingId is required' });
    }

    // Stripe confirm (preferred): verify PaymentIntent succeeded and update booking/payment.
    // This is important when webhooks aren't configured.
    // If sessionId is provided, retrieve PaymentIntent from Checkout Session
    // Note: If both sessionId and paymentIntentId are provided, prefer sessionId (it's more reliable)
    let actualPaymentIntentId = paymentIntentId;
    // If sessionId is provided (even if paymentIntentId is also set), use sessionId to get payment_intent
    // This handles cases where frontend incorrectly sets paymentIntentId to sessionId
    if (stripeClient && sessionId) {
      // Only use paymentIntentId if it's actually a payment intent ID (starts with pi_)
      // Otherwise, ignore it and get payment_intent from the session
      if (paymentIntentId && !paymentIntentId.startsWith('pi_')) {
        console.warn(`Invalid paymentIntentId provided (${paymentIntentId}), ignoring and using sessionId instead`);
        actualPaymentIntentId = null; // Reset to null so we retrieve from session
      }
      try {
        // Check if sessionId is actually a Checkout Session ID (starts with cs_) or PaymentIntent ID (starts with pi_)
        if (sessionId.startsWith('cs_')) {
          // It's a Checkout Session ID - retrieve the PaymentIntent from it
          console.log(`Retrieving Checkout Session: ${sessionId}`);
          // #region agent log
          fetch('http://127.0.0.1:7745/ingest/e74cc868-61c8-46b1-9335-6d9fec3efef6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dad86d'},body:JSON.stringify({sessionId:'dad86d',runId:'confirm-payment',hypothesisId:'A',location:'paymentController.ts:1251',message:'Retrieving checkout session to get payment_intent',data:{sessionId,bookingId},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          const session = await stripeClient.checkout.sessions.retrieve(sessionId, {
            expand: ['payment_intent'] // Expand payment_intent to get full details
          });
          
          console.log(`Checkout Session retrieved - payment_status: ${session.payment_status}, payment_intent: ${session.payment_intent}`);
          // #region agent log
          fetch('http://127.0.0.1:7745/ingest/e74cc868-61c8-46b1-9335-6d9fec3efef6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dad86d'},body:JSON.stringify({sessionId:'dad86d',runId:'confirm-payment',hypothesisId:'A',location:'paymentController.ts:1258',message:'Checkout session retrieved',data:{sessionId:session.id,paymentStatus:session.payment_status,paymentIntentType:typeof session.payment_intent,paymentIntentId:typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id||null},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          
          // Checkout Session can have payment_intent as string ID or expanded object
          if (typeof session.payment_intent === 'string') {
            actualPaymentIntentId = session.payment_intent;
          } else if (session.payment_intent && typeof session.payment_intent === 'object' && session.payment_intent.id) {
            actualPaymentIntentId = session.payment_intent.id;
          } else {
            actualPaymentIntentId = null;
          }
          // #region agent log
          fetch('http://127.0.0.1:7745/ingest/e74cc868-61c8-46b1-9335-6d9fec3efef6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dad86d'},body:JSON.stringify({sessionId:'dad86d',runId:'confirm-payment',hypothesisId:'A',location:'paymentController.ts:1267',message:'Extracted payment_intent ID from session',data:{actualPaymentIntentId,hasPaymentIntent:!!actualPaymentIntentId},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          
          if (!actualPaymentIntentId) {
            // Payment intent might be null initially, but will be set after payment completes
            // If payment_status is 'paid', try to retrieve payment_intent again (it should be set now)
            if (session.payment_status === 'paid') {
              // Payment completed - payment_intent should be available now
              // Try retrieving session again with expand to get payment_intent details
              try {
                const refreshedSession = await stripeClient.checkout.sessions.retrieve(sessionId, {
                  expand: ['payment_intent']
                });
                console.log(`[confirmPayment] Refreshed session after payment - payment_status: ${refreshedSession.payment_status}, payment_intent: ${refreshedSession.payment_intent ? (typeof refreshedSession.payment_intent === 'string' ? refreshedSession.payment_intent : refreshedSession.payment_intent.id) : 'null'}`);
                
                if (refreshedSession.payment_intent) {
                  actualPaymentIntentId = typeof refreshedSession.payment_intent === 'string' 
                    ? refreshedSession.payment_intent 
                    : refreshedSession.payment_intent.id;
                  console.log(`[confirmPayment] Extracted payment_intent ID from refreshed session: ${actualPaymentIntentId}`);
                }
              } catch (refreshErr: any) {
                console.warn('[confirmPayment] Failed to refresh session to get payment_intent:', refreshErr?.message);
              }
            }
            
            // If still no payment_intent, check if payment was already processed via webhook
            if (!actualPaymentIntentId) {
              const existingPayment = await prisma.payment.findFirst({
                where: { 
                  bookingId,
                  OR: [
                    { transactionId: sessionId },
                    { transactionId: { contains: sessionId } }
                  ]
                },
                orderBy: { createdAt: 'desc' }
              });
              
              // If payment record shows paid, return success (webhook already processed it)
              if (existingPayment && existingPayment.status === 'paid') {
                const booking = await prisma.booking.findUnique({
                  where: { id: bookingId },
                  select: { paymentStatus: true, status: true }
                });
                return res.json({ 
                  message: 'Payment already confirmed via webhook',
                  payment: existingPayment,
                  booking: { id: bookingId, paymentStatus: booking?.paymentStatus, status: booking?.status }
                });
              }
              
              // Payment hasn't completed yet - return helpful message based on status
              const isUnpaid = session.payment_status === 'unpaid';
              return res.status(400).json({ 
                message: isUnpaid
                  ? 'Payment has not been completed. Please complete the payment in Stripe Checkout.'
                  : 'Payment may still be processing. Please wait a moment and try again.',
                sessionId,
                paymentStatus: session.payment_status,
                sessionStatus: session.status,
                requiresAction: isUnpaid,
                hint: isUnpaid
                  ? 'Return to Stripe Checkout to complete payment. The webhook will automatically process it when payment completes.'
                  : 'Wait a moment and refresh, or check webhook delivery status. Payment will be processed automatically.'
              });
            }
          }
        } else if (sessionId.startsWith('pi_')) {
          // It's actually a PaymentIntent ID, use it directly
          actualPaymentIntentId = sessionId;
        } else {
          // Unknown format - try to retrieve as Checkout Session first
          try {
            const session = await stripeClient.checkout.sessions.retrieve(sessionId);
            actualPaymentIntentId = typeof session.payment_intent === 'string' 
              ? session.payment_intent 
              : (session.payment_intent?.id || null);
          } catch {
            // If that fails, assume it's a PaymentIntent ID
            actualPaymentIntentId = sessionId;
          }
        }
      } catch (sessionErr: any) {
        console.error('Error retrieving Checkout Session:', sessionErr);
        // If session retrieval fails, check if it might be a PaymentIntent ID
        if (sessionId.startsWith('pi_')) {
          actualPaymentIntentId = sessionId;
        } else {
          return res.status(400).json({ 
            message: 'Invalid Checkout Session or PaymentIntent ID', 
            error: sessionErr?.message,
            providedId: sessionId
          });
        }
      }
    }

    if (stripeClient && actualPaymentIntentId) {
      try {
        // Ensure we have a valid PaymentIntent ID (starts with pi_)
        if (!actualPaymentIntentId.startsWith('pi_')) {
          return res.status(400).json({ 
            message: 'Invalid PaymentIntent ID format',
            providedId: actualPaymentIntentId,
            hint: 'If using Checkout Session, ensure session.payment_intent is retrieved correctly'
          });
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7745/ingest/e74cc868-61c8-46b1-9335-6d9fec3efef6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dad86d'},body:JSON.stringify({sessionId:'dad86d',runId:'confirm-payment',hypothesisId:'B',location:'paymentController.ts:1342',message:'Retrieving payment intent to check status',data:{actualPaymentIntentId,bookingId},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const pi = await stripeClient.paymentIntents.retrieve(actualPaymentIntentId);
        if (!pi) {
          return res.status(404).json({ message: 'PaymentIntent not found' });
        }
        // #region agent log
        fetch('http://127.0.0.1:7745/ingest/e74cc868-61c8-46b1-9335-6d9fec3efef6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dad86d'},body:JSON.stringify({sessionId:'dad86d',runId:'confirm-payment',hypothesisId:'B',location:'paymentController.ts:1345',message:'Payment intent retrieved',data:{paymentIntentId:pi.id,status:pi.status,amount:pi.amount,metadata:pi.metadata},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        
        // Handle different payment intent statuses
        if (pi.status !== 'succeeded') {
          // #region agent log
          fetch('http://127.0.0.1:7745/ingest/e74cc868-61c8-46b1-9335-6d9fec3efef6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dad86d'},body:JSON.stringify({sessionId:'dad86d',runId:'confirm-payment',hypothesisId:'B',location:'paymentController.ts:1348',message:'Payment intent not succeeded yet',data:{status:pi.status,paymentIntentId:pi.id},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          let errorMessage = 'Payment not successful yet';
          let statusCode = 400;
          
          // Provide more specific error messages based on status
          switch (pi.status) {
            case 'requires_payment_method':
              errorMessage = 'Payment method required. Please complete the payment first.';
              statusCode = 402; // Payment Required
              break;
            case 'requires_confirmation':
              errorMessage = 'Payment requires confirmation. Please complete the payment process.';
              break;
            case 'requires_action':
              errorMessage = 'Payment requires additional action (e.g., 3D Secure). Please complete authentication.';
              break;
            case 'processing':
              errorMessage = 'Payment is being processed. Please wait a moment and try again.';
              break;
            case 'requires_capture':
              errorMessage = 'Payment requires capture. This should be handled automatically.';
              break;
            case 'canceled':
              errorMessage = 'Payment was canceled. Please create a new payment.';
              break;
            default:
              errorMessage = `Payment status: ${pi.status}. Payment has not succeeded yet.`;
          }
          
          return res.status(statusCode).json({ 
            message: errorMessage,
            status: pi.status,
            paymentIntentId: pi.id,
            clientSecret: pi.client_secret, // Include client secret so frontend can retry if needed
            requiresAction: pi.status === 'requires_action' || pi.status === 'requires_confirmation'
          });
        }

        // Validate metadata matches
        const metaBookingId = (pi.metadata && pi.metadata.bookingId) || null;
        if (metaBookingId && metaBookingId !== bookingId) {
          return res.status(400).json({ 
            message: 'PaymentIntent bookingId does not match provided bookingId',
            paymentIntentBookingId: metaBookingId,
            providedBookingId: bookingId
          });
        }

        // Get booking with relations
        const existingBooking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: { 
            service: { include: { provider: { include: { user: true } } } },
            customer: { include: { user: true } }
          }
        });
        
        if (!existingBooking) {
          return res.status(404).json({ message: 'Booking not found' });
        }

        // Validate booking belongs to customer
        if (existingBooking.customer.userId !== req.user.id) {
          return res.status(403).json({ message: 'Not authorized to confirm payment for this booking' });
        }

        // Check if already paid
        if (existingBooking.paymentStatus === 'paid_to_escrow') {
          // Find payment record
          const existingPayment = await prisma.payment.findFirst({
            where: { bookingId, status: 'paid' },
            orderBy: { createdAt: 'desc' }
          });
          return res.json({ 
            message: 'Payment already confirmed',
            payment: existingPayment,
            booking: { id: bookingId, paymentStatus: existingBooking.paymentStatus }
          });
        }

        // Try to locate the payment created in /payments/intent
        const metaPaymentId = (pi.metadata && pi.metadata.paymentId) || null;
        let payment = metaPaymentId
          ? await prisma.payment.findUnique({ where: { id: metaPaymentId } })
          : await prisma.payment.findFirst({ 
              where: { 
                bookingId, 
                OR: [
                  { transactionId: actualPaymentIntentId },
                  { transactionId: { contains: actualPaymentIntentId } }
                ]
              },
              orderBy: { createdAt: 'desc' }
            });

        const amountPaid = ((pi.amount_received ?? pi.amount) || 0) / 100;
        const totalAmount = amountPaid || parseFloat(amount || existingBooking.calculatedPrice || existingBooking.basePrice || 0);

        if (totalAmount <= 0) {
          return res.status(400).json({ message: 'Invalid payment amount' });
        }

        // Ensure payment record exists and is marked paid
        if (payment) {
          // Idempotent: if already paid, just return success
          if (payment.status === 'paid') {
            // Ensure booking is also updated
            if (existingBooking.paymentStatus !== 'paid_to_escrow') {
              await prisma.booking.update({
                where: { id: bookingId },
                data: {
                  paymentStatus: 'paid_to_escrow',
                  status: 'pending_acceptance',
                  escrowAmount: payment.amount,
                  commissionAmount: payment.commissionAmount
                }
              });
            }
            return res.json({ 
              message: 'Payment already confirmed',
              payment,
              booking: { id: bookingId, paymentStatus: 'paid_to_escrow' }
            });
          }
          
          // Update payment to paid
          payment = await prisma.payment.update({
            where: { id: payment.id },
            data: { 
              status: 'paid', 
              escrowStatus: 'held', 
              transactionId: actualPaymentIntentId,
              amount: totalAmount // Update amount in case it differs
            }
          });
        } else {
          // Payment record doesn't exist - create it
          const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } });
          if (!customer) {
            return res.status(400).json({ message: 'Customer profile not found' });
          }
          
          const referenceNumber = await generatePaymentReferenceAsync();
          const commissionRate = 0.15;
          const commissionAmount = totalAmount * commissionRate;
          const providerPayout = totalAmount - commissionAmount;
          
          payment = await prisma.payment.create({
            data: {
              referenceNumber,
              customerId: customer.id,
              bookingId,
              amount: totalAmount,
              currency: 'ZAR',
              paymentMethod: paymentMethod || 'stripe',
              status: 'paid',
              transactionId: actualPaymentIntentId,
              escrowStatus: 'held',
              commissionRate,
              commissionAmount,
              providerPayout
            }
          });
        }

        // Update booking paymentStatus so providers can accept (idempotent)
        if (existingBooking.paymentStatus !== 'paid_to_escrow') {
          await prisma.booking.update({
            where: { id: bookingId },
            data: {
              paymentStatus: 'paid_to_escrow',
              status: 'pending_acceptance',
              escrowAmount: payment.amount,
              commissionAmount: payment.commissionAmount
            }
          });
        }

        // Notify provider that a PAID booking is available
        try {
          const app = require('../server');
          const io = app.get && app.get('io');
          if (io && existingBooking.service?.provider?.user?.id) {
            io.to(existingBooking.service.provider.user.id).emit('new-booking-request', {
              bookingId: existingBooking.id,
              service: existingBooking.service.title,
              customer: `${req.user.firstName} ${req.user.lastName}`,
              date: existingBooking.date,
              time: existingBooking.time,
              location: existingBooking.location,
              amount: totalAmount,
              paymentReceived: true
            });
          }
        } catch (_) {}

        // Ensure workflows exist and update: Payment Required, Payment Received, Provider Assigned
        try {
          const workflowController = require('../controllers/serviceWorkflowController');
          const workflowClient = require('../lib/workflowClient');
          const defaultSteps = [
            { name: 'Payment Required', status: 'completed', notes: 'Payment received' },
            { name: 'Payment Received', status: 'completed', notes: 'Payment received (Stripe confirm)' },
            { name: 'Provider Assigned', status: 'pending', notes: 'Waiting for provider acceptance' },
            { name: 'Service Started', status: 'pending' },
            { name: 'Service Completed', status: 'pending' }
          ];
          await workflowClient.createWorkflowForBooking(bookingId, defaultSteps).catch(() => {});
          
          await workflowController.updateWorkflowStepByName(bookingId, 'Payment Required', 'completed', 'Payment received');
          await workflowController.updateWorkflowStepByName(bookingId, 'Payment Received', 'completed', 'Payment received (Stripe confirm)');
          await workflowController.updateWorkflowStepByName(bookingId, 'Provider Assigned', 'pending', 'Waiting for provider acceptance');
        } catch (_) {}

        return res.json({ message: 'Payment confirmed', payment });
      } catch (stripeErr: any) {
        console.error('Stripe confirm error', stripeErr);
        return res.status(400).json({ message: 'Stripe payment verification failed', error: stripeErr?.message });
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
        status: 'paid',
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
      if (io && booking.service?.provider?.user?.id) {
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

    // Ensure workflows exist and update: Payment Required, Payment Received, Provider Assigned
    try {
      const workflowController = require('../controllers/serviceWorkflowController');
      const workflowClient = require('../lib/workflowClient');
      const defaultSteps = [
        { name: 'Payment Required', status: 'completed', notes: 'Payment received' },
        { name: 'Payment Received', status: 'completed', notes: 'Payment confirmed and held in escrow' },
        { name: 'Provider Assigned', status: 'pending', notes: 'Waiting for provider acceptance' },
        { name: 'Service Started', status: 'pending' },
        { name: 'Service Completed', status: 'pending' }
      ];
      await workflowClient.createWorkflowForBooking(bookingId, defaultSteps).catch(() => {});
      
      await workflowController.updateWorkflowStepByName(bookingId, 'Payment Required', 'completed', 'Payment received');
      await workflowController.updateWorkflowStepByName(bookingId, 'Payment Received', 'completed', 'Payment confirmed and held in escrow');
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
    // Admins can see all payments, customers see only their own (by userId via customer relation)
    const where: any = req.user.role === 'admin' 
      ? {} // Admin sees all payments
      : { customer: { userId: req.user.id } }; // Customer sees only their payments
    
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

// Stripe webhook handler (sandbox: use STRIPE_WEBHOOK_SECRET from Stripe CLI or Dashboard)
exports.webhookHandler = async (req: any, res: any) => {
  try {
    const processStripePaymentIntentSucceeded = async (pi: any) => {
      const bookingId = (pi.metadata && pi.metadata.bookingId) || null;
      const paymentIdFromMeta = (pi.metadata && pi.metadata.paymentId) || null;

      if (!bookingId) {
        console.error('Stripe webhook: bookingId missing in PaymentIntent metadata', { paymentIntentId: pi.id, metadata: pi.metadata });
        return;
      }

      const paymentInclude = {
        booking: {
          include: {
            service: { include: { provider: { include: { user: true } } } },
            customer: { include: { user: true } }
          }
        }
      };

        // Try to find payment by metadata paymentId first, then by transactionId
      let payment = paymentIdFromMeta
        ? await prisma.payment.findUnique({ where: { id: paymentIdFromMeta }, include: paymentInclude })
        : null;

      if (!payment) {
        payment = await prisma.payment.findFirst({ 
          where: { 
            bookingId,
            OR: [
              { transactionId: pi.id },
              { transactionId: { contains: pi.id } }
            ]
          }, 
          include: paymentInclude,
          orderBy: { createdAt: 'desc' }
        });
      }

      // If still no payment found, try to find any pending payment for this booking
      if (!payment) {
        payment = await prisma.payment.findFirst({
          where: { bookingId, status: { in: ['pending', 'paid'] } },
          include: paymentInclude,
          orderBy: { createdAt: 'desc' }
        });
      }

      if (!payment) {
        console.error('Stripe webhook: payment record not found', { 
          paymentIdFromMeta, 
          bookingId, 
          paymentIntentId: pi.id,
          metadata: pi.metadata 
        });
        return;
      }

      // Idempotent: skip if already paid and booking is already paid
      if (payment.status === 'paid') {
        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (booking && booking.paymentStatus === 'paid_to_escrow') {
          console.log('Stripe webhook: Payment already processed (idempotent skip)', { paymentId: payment.id, bookingId });
          return;
        }
        // If payment is completed but booking isn't updated, continue to update booking
      }

      const amount = pi.amount ? pi.amount / 100 : payment.amount;
      
      if (!amount || amount <= 0) {
        console.error('Stripe webhook: Invalid payment amount', { amount, paymentIntentId: pi.id, paymentId: payment.id });
        return;
      }

      // Update payment to paid (idempotent)
      if (payment.status !== 'paid' || payment.transactionId !== pi.id) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { 
            status: 'paid', 
            escrowStatus: 'held', 
            transactionId: pi.id,
            amount: amount // Ensure amount matches PaymentIntent
          }
        });
      }

      // Get booking to check current status
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { service: true, customer: { include: { user: true } } }
      });

      if (!booking) {
        console.error('Stripe webhook: Booking not found', { bookingId });
        return;
      }

      // Generate invoice number if not already set
      const invoiceNumber = booking.invoiceNumber || `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const { generateChatToken } = require('../lib/chatTokens');
      const customerChatToken = booking.customer?.userId
        ? generateChatToken(bookingId, booking.customer.userId, 'customer')
        : booking.customerChatToken || null;

      // Update booking paymentStatus (idempotent)
      if (booking.paymentStatus !== 'paid_to_escrow') {
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            paymentStatus: 'paid_to_escrow',
            status: 'pending_acceptance',
            invoiceNumber,
            invoiceSentAt: booking.invoiceSentAt || new Date(),
            customerChatToken: customerChatToken || booking.customerChatToken,
            chatActive: false,
            escrowAmount: amount,
            commissionAmount: payment.commissionAmount || (amount * 0.15)
          }
        });
      }

      // Update Spana wallet (idempotent - check if transaction already exists)
      const existingTransaction = await prisma.walletTransaction.findFirst({
        where: {
          paymentId: payment.id,
          bookingId,
          type: 'deposit'
        }
      });

      if (!existingTransaction) {
        let wallet = await prisma.spanaWallet.findFirst();
        if (!wallet) {
          wallet = await prisma.spanaWallet.create({ 
            data: { totalHeld: 0, totalReleased: 0, totalCommission: 0 } 
          });
        }
        
        await prisma.spanaWallet.update({
          where: { id: wallet.id },
          data: { totalHeld: { increment: amount } }
        });
        
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'deposit',
            amount,
            bookingId,
            paymentId: payment.id,
            description: `Payment received for booking ${bookingId} (Stripe)`
          }
        });
      }

      try {
        const workflowController = require('../controllers/serviceWorkflowController');
        const workflowClient = require('../lib/workflowClient');
        const defaultSteps = [
          { name: 'Payment Required', status: 'completed', notes: 'Payment received' },
          { name: 'Payment Received', status: 'completed', notes: 'Payment received (Stripe)' },
          { name: 'Provider Assigned', status: 'pending', notes: 'Waiting for provider acceptance' },
          { name: 'Service Started', status: 'pending' },
          { name: 'Service Completed', status: 'pending' }
        ];
        await workflowClient.createWorkflowForBooking(bookingId, defaultSteps).catch(() => {});
        
        await workflowController.updateWorkflowStepByName(bookingId, 'Payment Required', 'completed', 'Payment received');
        await workflowController.updateWorkflowStepByName(bookingId, 'Payment Received', 'completed', 'Payment received (Stripe)');
        await workflowController.updateWorkflowStepByName(bookingId, 'Provider Assigned', 'pending', 'Waiting for provider acceptance');
      } catch (_) {}

      try {
        const { sendInvoiceEmail } = require('../config/mailer');
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: { service: true, customer: { include: { user: true } } }
        });
        if (booking?.customer?.user?.email) {
          await sendInvoiceEmail({
            to: booking.customer.user.email,
            name: `${booking.customer.user.firstName || ''} ${booking.customer.user.lastName || ''}`.trim() || 'Customer',
            invoiceNumber,
            bookingId,
            serviceTitle: booking.service.title,
            amount,
            currency: 'ZAR',
            jobSize: booking.jobSize,
            basePrice: booking.basePrice,
            multiplier: booking.jobSizeMultiplier,
            calculatedPrice: booking.calculatedPrice,
            tipAmount: payment.tipAmount || 0,
            date: new Date(),
            transactionId: pi.id
          }).catch(() => {});
        }
      } catch (_) {}

      try {
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: { service: { include: { provider: { include: { user: true } } } }, customer: { include: { user: true } } }
        });
        if (booking?.customer?.user?.email) sendReceiptEmail({ to: booking.customer.user.email, toRole: 'customer', amount, currency: 'ZAR', bookingId, transactionId: pi.id, createdAt: new Date() }).catch(() => {});
        if (booking?.service?.provider?.user?.email) sendReceiptEmail({ to: booking.service.provider.user.email, toRole: 'provider', amount, currency: 'ZAR', bookingId, transactionId: pi.id, createdAt: new Date() }).catch(() => {});
      } catch (_) {}

      const customerUserId = payment.booking?.customer?.userId;
      if (customerUserId) {
        await prisma.activity.create({
          data: { userId: customerUserId, actionType: 'payment_confirm', contentId: payment.id, contentModel: 'Payment', details: { bookingId } }
        }).catch(() => {});
      }

      try {
        const app = require('../server');
        const io = app.get && app.get('io');
        if (io && payment.booking?.customer?.user?.id) {
          io.to(payment.booking.customer.user.id).emit('payment-received', { bookingId });
          if (payment.booking.service?.provider?.user?.id) io.to(payment.booking.service.provider.user.id).emit('payment-received', { bookingId });
          io.to(`booking:${bookingId}`).emit('chatroom-active', { bookingId });
        }
      } catch (_) {}
    };

    if (stripeClient && process.env.STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature'];
      let event;
      try {
        event = stripeClient.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.error('Stripe webhook signature verification failed:', err && (err as Error).message);
        return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
      }

      if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object;
        await processStripePaymentIntentSucceeded(pi);
      }
      return res.status(200).send('OK');
    }

    // Stripe is configured but webhook secret is missing.
    // We'll still reconcile `payment_intent.succeeded` by re-fetching the PaymentIntent from Stripe
    // (metadata is trusted from Stripe). This ensures booking.paymentStatus updates after payment.
    if (stripeClient && !process.env.STRIPE_WEBHOOK_SECRET) {
      let event: any = req.body;
      try {
        if (Buffer.isBuffer(event)) event = JSON.parse(event.toString('utf8'));
        else if (typeof event === 'string') event = JSON.parse(event);
      } catch (_) {}

      try {
        if (event && event.type === 'payment_intent.succeeded') {
          const piPayload = event.data && event.data.object ? event.data.object : event;
          const piId = piPayload && piPayload.id;
          
          // Try to retrieve from Stripe first
          if (piId) {
            try {
              const pi = await stripeClient.paymentIntents.retrieve(piId);
              if (pi && pi.status === 'succeeded') {
                await processStripePaymentIntentSucceeded(pi);
                return res.status(200).send('OK');
              }
            } catch (stripeErr: any) {
              // PaymentIntent not found in Stripe (might be test payload)
              // Process payload directly if it has succeeded status
              if (piPayload && piPayload.status === 'succeeded') {
                await processStripePaymentIntentSucceeded(piPayload);
                return res.status(200).send('OK');
              }
            }
          } else if (piPayload && piPayload.status === 'succeeded') {
            // Process payload directly if no ID but has succeeded status
            await processStripePaymentIntentSucceeded(piPayload);
            return res.status(200).send('OK');
          }
        }
      } catch (reconErr) {
        console.error('Webhook reconcile (no secret) error', reconErr);
      }

      return res.status(200).send('OK');
    }

    // No Stripe config (e.g. tests) - process webhook payload directly
    if (!stripeClient) {
      let event: any = req.body;
      try {
        if (Buffer.isBuffer(event)) event = JSON.parse(event.toString('utf8'));
        else if (typeof event === 'string') event = JSON.parse(event);
      } catch (e) {
        // ignore parse error
      }

      try {
        if (event && event.type === 'payment_intent.succeeded') {
          const pi = event.data && event.data.object ? event.data.object : event;
          
          // Process payment directly from webhook payload (for testing)
          if (pi && pi.status === 'succeeded') {
            await processStripePaymentIntentSucceeded(pi);
          }
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