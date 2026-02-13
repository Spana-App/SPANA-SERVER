/**
 * Payment System Test Script
 * Tests Stripe sandbox integration: create intent, payment history, tracking
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5003';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function log(msg: string, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

async function testEndpoint(method: string, url: string, data?: any, headers?: any): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
  try {
    const config: any = {
      method,
      url: `${BASE_URL}${url}`,
      headers: { 'Content-Type': 'application/json', ...headers },
      timeout: 15000,
      validateStatus: () => true
    };
    if (data) config.data = data;
    const res = await axios(config);
    const ok = res.status >= 200 && res.status < 300;
    return {
      success: ok,
      data: res.data,
      error: ok ? undefined : (res.data?.message || res.data?.error || `HTTP ${res.status}`),
      status: res.status
    };
  } catch (e: any) {
    return { success: false, error: e.message || 'Request failed' };
  }
}

async function runPaymentTests() {
  const ts = Date.now();
  const testEmail = `payment-test-${ts}@test.com`;
  const testPassword = 'Test123!@#';

  let customerToken = '';
  let bookingId = '';
  let serviceId = '';
  let paymentId = '';

  log('\n💳 PAYMENT SYSTEM TEST (Stripe Sandbox)', colors.bright + colors.cyan);
  log('='.repeat(60), colors.cyan);
  log(`Base URL: ${BASE_URL}\n`);

  try {
    // 1. Register test customer, then login (registration doesn't return token)
    log('1. Registering test customer...', colors.yellow);
    await testEndpoint('POST', '/auth/register', {
      email: testEmail,
      password: testPassword,
      firstName: 'Payment',
      lastName: 'Tester',
      phone: '+27123456789',
      role: 'customer'
    });
    log('   Logging in...', colors.yellow);
    const login = await testEndpoint('POST', '/auth/login', { email: testEmail, password: testPassword });
    if (!login.success) {
      log(`   ❌ Login failed: ${login.error}`, colors.red);
      return;
    }
    customerToken = login.data?.token;
    if (!customerToken) {
      log(`   ❌ No token in response`, colors.red);
      return;
    }
    log(`   ✅ Customer token obtained`, colors.green);

    // 2. Get a service and customer
    log('\n2. Fetching available services...', colors.yellow);
    const servicesRes = await testEndpoint('GET', '/services/discover');
    if (!servicesRes.success || !servicesRes.data?.services?.length) {
      const allRes = await testEndpoint('GET', '/services');
      serviceId = allRes.data?.services?.[0]?.id || allRes.data?.[0]?.id;
    } else {
      serviceId = servicesRes.data.services[0].id;
    }
    if (!serviceId) {
      log('   ❌ No services found. Seed services first.', colors.red);
      return;
    }
    log(`   ✅ Service ID: ${serviceId}`, colors.green);

    // 3. Create booking (API or direct DB fallback)
    log('\n3. Creating booking (pending_payment)...', colors.yellow);
    const tomorrow = new Date(Date.now() + 86400000);
    const bookingRes = await testEndpoint('POST', '/bookings', {
      serviceId,
      date: tomorrow.toISOString(),
      time: '10:00',
      location: { type: 'Point', coordinates: [28.0473, -26.2041], address: '123 Test St, Johannesburg' },
      notes: 'Payment test'
    }, { Authorization: `Bearer ${customerToken}` });

    if (!bookingRes.success || !bookingRes.data?.booking?.id) {
      const err = bookingRes.error || bookingRes.data?.message || JSON.stringify(bookingRes.data);
      log(`   API booking failed: ${err}`, colors.yellow);
      log('   Creating booking via DB for test...', colors.yellow);
      const me = await testEndpoint('GET', '/auth/me', null, { Authorization: `Bearer ${customerToken}` });
      const userId = me.data?.id || me.data?._id;
      if (!userId) {
        log(`   ❌ Could not get user ID`, colors.red);
        return;
      }
      const customer = await prisma.customer.findUnique({ where: { userId } });
      if (!customer) {
        log(`   ❌ Customer profile not found`, colors.red);
        return;
      }
      const service = await prisma.service.findFirst({ where: { id: serviceId } });
      if (!service) {
        log(`   ❌ Service not found`, colors.red);
        return;
      }
      const bk = await prisma.booking.create({
        data: {
          customerId: customer.id,
          serviceId: service.id,
          date: tomorrow,
          time: '10:00',
          location: { type: 'Point', coordinates: [28.0473, -26.2041], address: '123 Test St, Johannesburg' },
          notes: 'Payment test',
          status: 'pending_payment',
          paymentStatus: 'pending',
          requestStatus: 'pending',
          basePrice: 650,
          calculatedPrice: 650,
          jobSize: 'medium',
          jobSizeMultiplier: 1
        }
      });
      bookingId = bk.id;
      log(`   ✅ Booking created via DB: ${bookingId}`, colors.green);
    } else {
      bookingId = bookingRes.data.booking.id;
      log(`   ✅ Booking ID: ${bookingId}`, colors.green);
    }
    log(`   Status: pending_payment`, colors.cyan);

    // 4. Create Stripe payment intent
    log('\n4. Creating Stripe payment intent (gateway: stripe)...', colors.yellow);
    const amount = 650;
    const intentRes = await testEndpoint('POST', '/payments/intent', {
      bookingId,
      amount,
      currency: 'ZAR',
      tipAmount: 0,
      gateway: 'stripe'
    }, { Authorization: `Bearer ${customerToken}` });

    if (!intentRes.success) {
      log(`   ❌ Create intent failed: ${intentRes.error}`, colors.red);
      if (intentRes.data?.instructions) log(`   Hint: ${intentRes.data.instructions}`, colors.yellow);
      return;
    }

    const hasClientSecret = !!intentRes.data?.clientSecret;
    const hasPublishableKey = !!intentRes.data?.stripePublishableKey;
    paymentId = intentRes.data?.paymentId;

    log(`   ✅ Payment intent created`, colors.green);
    log(`   Payment ID: ${paymentId}`, colors.cyan);
    log(`   Client secret: ${hasClientSecret ? '✓ (present)' : '✗ (missing)'}`, hasClientSecret ? colors.green : colors.red);
    log(`   Publishable key: ${hasPublishableKey ? '✓' : '✗'}`, hasPublishableKey ? colors.green : colors.yellow);
    log(`   Amount: R${intentRes.data?.amount || amount}`, colors.cyan);

    // 5. Payment history
    log('\n5. Fetching payment history...', colors.yellow);
    const historyRes = await testEndpoint('GET', '/payments/history', null, {
      Authorization: `Bearer ${customerToken}`
    });
    if (historyRes.success) {
      const payments = Array.isArray(historyRes.data) ? historyRes.data : historyRes.data?.payments || [];
      log(`   ✅ Payment history: ${payments.length} payment(s)`, colors.green);
      if (payments.length > 0) {
        const p = payments[0];
        log(`   Latest: R${p.amount} | ${p.paymentMethod} | ${p.status}`, colors.cyan);
      }
    } else {
      log(`   ❌ History failed: ${historyRes.error}`, colors.red);
    }

    // 6. Verify payment record in DB
    log('\n6. Verifying payment in database...', colors.yellow);
    if (paymentId) {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { booking: { select: { status: true, paymentStatus: true } } }
      });
      if (payment) {
        log(`   ✅ Payment record found`, colors.green);
        log(`   Amount: R${payment.amount} | Method: ${payment.paymentMethod} | Status: ${payment.status}`, colors.cyan);
        log(`   Booking: ${payment.booking?.status} / ${payment.booking?.paymentStatus}`, colors.cyan);
      } else {
        log(`   ⚠ Payment not found by ID (may be expected before webhook)`, colors.yellow);
      }
    }

    // 7. Admin wallet (if ADMIN_TOKEN set)
    const adminToken = process.env.ADMIN_TOKEN;
    if (adminToken) {
      log('\n7. Admin wallet summary...', colors.yellow);
      const walletRes = await testEndpoint('GET', '/admin/wallet/summary', null, {
        Authorization: `Bearer ${adminToken}`
      });
      if (walletRes.success) {
        log(`   ✅ Wallet: totalHeld / totalReleased / totalCommission`, colors.green);
        log(`   ${JSON.stringify(walletRes.data)}`, colors.cyan);
      } else {
        log(`   ⚠ Admin wallet: ${walletRes.error}`, colors.yellow);
      }
    } else {
      log('\n7. Admin wallet: skipped (set ADMIN_TOKEN to test)', colors.yellow);
    }

    log('\n' + '='.repeat(60), colors.cyan);
    log('✅ Payment system test complete', colors.green);
    log('\nNext: Use clientSecret with Stripe.js to confirm payment. Webhook will update booking.', colors.cyan);
  } catch (e: any) {
    log(`\n❌ Test error: ${e.message}`, colors.red);
  } finally {
    await prisma.$disconnect();
  }
}

runPaymentTests();
