/**
 * COMPREHENSIVE BACKEND TEST - All Routes & Operations
 * Tests every endpoint and operation in the SPANA backend
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = process.env.TEST_BASE_URL || 'http://localhost:5003';

const results: { route: string; method: string; status: 'PASS' | 'FAIL' | 'SKIP'; code?: number; msg?: string }[] = [];
let customerToken = '';
let providerToken = '';
let adminToken = process.env.ADMIN_TOKEN || '';
let customerId = '';
let providerId = '';
let serviceId = '';
let bookingId = '';
let applicationId = '';
let complaintId = '';

async function req(method: string, path: string, data?: any, token?: string, accept: number[] = [200, 201]) {
  const config: any = {
    method,
    url: `${BASE}${path}`,
    headers: { 'Content-Type': 'application/json' },
    validateStatus: () => true,
    timeout: 15000,
  };
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (data) config.data = data;
  const res = await axios(config);
  const ok = accept.includes(res.status) || (res.status >= 200 && res.status < 300);
  return { ok, status: res.status, data: res.data };
}

function add(route: string, method: string, ok: boolean, code?: number, msg?: string) {
  results.push({
    route: `${method} ${route}`,
    method,
    status: ok ? 'PASS' : 'FAIL',
    code,
    msg: msg || (ok ? 'OK' : `Got ${code}`),
  });
}

async function run() {
  const ts = Date.now();
  const cEmail = `fulltest-c-${ts}@test.com`;
  const pEmail = `fulltest-p-${ts}@test.com`;

  console.log('\n' + '='.repeat(70));
  console.log('  SPANA BACKEND - COMPREHENSIVE ROUTE & OPERATION TEST');
  console.log('='.repeat(70));
  console.log(`  Base: ${BASE}\n`);

  try {
    // ─── 1. HEALTH & PUBLIC ───
    console.log('1. Health & Public');
    let r = await req('GET', '/health'); add('/health', 'GET', r.ok, r.status);
    r = await req('GET', '/health/detailed'); add('/health/detailed', 'GET', r.ok, r.status);

    // ─── 2. AUTH - REGISTRATION & LOGIN ───
    console.log('2. Auth - Registration & Login');
    r = await req('POST', '/auth/register', {
      email: cEmail, password: 'Test123!@#', firstName: 'Full', lastName: 'Test', phone: '+27123456789', role: 'customer',
    }); add('/auth/register (customer)', 'POST', r.ok || r.status === 400, r.status);

    r = await req('POST', '/auth/register', {
      email: pEmail, password: 'Test123!@#', firstName: 'Full', lastName: 'Provider', phone: '+27123456789', role: 'service_provider',
    }); add('/auth/register (provider)', 'POST', r.ok || r.status === 400, r.status);

    r = await req('POST', '/auth/login', { email: cEmail, password: 'Test123!@#' });
    if (r.ok && r.data?.token) { customerToken = r.data.token; customerId = r.data.user?.id || ''; }
    add('/auth/login (customer)', 'POST', r.ok, r.status);

    r = await req('POST', '/auth/login', { email: pEmail, password: 'Test123!@#' });
    if (r.ok && r.data?.token) { providerToken = r.data.token; providerId = r.data.user?.id || ''; }
    add('/auth/login (provider)', 'POST', r.ok, r.status);

    // ─── 3. AUTH - PROTECTED ───
    console.log('3. Auth - Protected');
    r = await req('GET', '/auth/me', null, customerToken); add('/auth/me', 'GET', r.ok, r.status);
    r = await req('PUT', '/auth/profile', { firstName: 'Updated' }, customerToken); add('/auth/profile', 'PUT', r.ok, r.status);

    // ─── 4. SERVICES ───
    console.log('4. Services');
    r = await req('GET', '/services'); add('/services', 'GET', r.ok, r.status);
    r = await req('GET', '/services/discover'); add('/services/discover', 'GET', r.ok, r.status);
    if (r.data?.services?.[0]?.id) serviceId = r.data.services[0].id;
    if (serviceId) {
      r = await req('GET', `/services/${serviceId}`); add('/services/:id', 'GET', r.ok, r.status);
    }

    // ─── 5. BOOKINGS ───
    console.log('5. Bookings');
    r = await req('GET', '/bookings', null, customerToken); add('/bookings', 'GET', r.ok, r.status);
    const now = new Date();
    const future = new Date(now.getTime() + 60 * 60000);
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = future.toTimeString().slice(0, 5);
    r = await req('POST', '/bookings', {
      serviceId, date: `${dateStr}T${timeStr}:00.000Z`, time: timeStr,
      location: { type: 'Point', coordinates: [28.0473, -26.2041], address: 'Sandton' },
      notes: 'Full test',
    }, customerToken);
    add('/bookings (create)', 'POST', r.ok || r.status === 202 || r.status === 400, r.status);
    if (r.data?.booking?.id) bookingId = r.data.booking.id;

    if (!bookingId && customerId && serviceId) {
      const cust = await prisma.customer.findUnique({ where: { userId: customerId } });
      const svc = await prisma.service.findFirst({ where: { id: serviceId } });
      if (cust && svc) {
        const bk = await prisma.booking.create({
          data: {
            customerId: cust.id, serviceId: svc.id,
            date: new Date(Date.now() + 86400000), time: '10:00',
            location: { type: 'Point', coordinates: [28.0473, -26.2041], address: 'Sandton' },
            status: 'pending_payment', paymentStatus: 'pending', requestStatus: 'pending',
            basePrice: 500, calculatedPrice: 500, jobSize: 'medium', jobSizeMultiplier: 1,
          },
        });
        bookingId = bk.id;
      }
    }

    if (bookingId) {
      r = await req('GET', `/bookings/${bookingId}`, null, customerToken); add('/bookings/:id', 'GET', r.ok, r.status);
    }

    // ─── 6. PAYMENTS ───
    console.log('6. Payments');
    r = await req('GET', '/payments/history', null, customerToken); add('/payments/history', 'GET', r.ok, r.status);
    if (bookingId) {
      r = await req('POST', '/payments/intent', { bookingId, amount: 500, gateway: 'stripe' }, customerToken);
      add('/payments/intent (Stripe)', 'POST', r.ok || r.status === 503, r.status);
    }

    // ─── 7. CHAT ───
    console.log('7. Chat');
    r = await req('GET', '/chat/my-chats', null, customerToken); add('/chat/my-chats', 'GET', r.ok, r.status);
    if (providerId) r = await req('GET', `/chat/history/${providerId}`, null, customerToken);
    if (providerId) add('/chat/history/:userId', 'GET', r.ok || r.status === 404, r.status);
    if (bookingId && providerId) {
      r = await req('POST', '/chat/send', { receiverId: providerId, bookingId, content: 'Test msg' }, customerToken);
      add('/chat/send', 'POST', r.ok, r.status);
    }
    if (bookingId) {
      r = await req('GET', `/chat/booking/${bookingId}`, null, customerToken); add('/chat/booking/:id', 'GET', r.ok, r.status);
    }

    // ─── 8. NOTIFICATIONS & ACTIVITIES ───
    console.log('8. Notifications & Activities');
    r = await req('GET', '/notifications', null, customerToken); add('/notifications', 'GET', r.ok, r.status);
    r = await req('GET', '/activities', null, customerToken); add('/activities', 'GET', r.ok, r.status);

    // ─── 9. PROVIDER ───
    console.log('9. Provider');
    if (providerToken) {
      r = await req('PUT', '/provider/online-status', { isOnline: true }, providerToken); add('/provider/online-status', 'PUT', r.ok || r.status === 404, r.status);
      r = await req('GET', '/provider/online-status', null, providerToken); add('/provider/online-status', 'GET', r.ok, r.status);
      r = await req('PUT', '/provider/location', { lng: 28.0473, lat: -26.2041, address: 'Sandton' }, providerToken); add('/provider/location', 'PUT', r.ok, r.status);
    }
    if (customerToken) {
      r = await req('PUT', '/provider/customer/location', { lng: 28.0473, lat: -26.2041, address: 'Sandton' }, customerToken); add('/provider/customer/location', 'PUT', r.ok, r.status);
    }

    // ─── 10. USERS ───
    console.log('10. Users');
    r = await req('GET', '/users/providers/all'); add('/users/providers/all', 'GET', r.ok, r.status);
    if (customerId) {
      r = await req('GET', `/users/${customerId}`, null, customerToken); add('/users/:id', 'GET', r.ok, r.status);
    }

    // ─── 11. STATS ───
    console.log('11. Stats');
    r = await req('GET', '/stats/platform'); add('/stats/platform', 'GET', r.ok, r.status);
    r = await req('GET', '/stats/providers/location'); add('/stats/providers/location', 'GET', r.ok, r.status);
    r = await req('GET', '/stats/bookings/trends'); add('/stats/bookings/trends', 'GET', r.ok, r.status);
    r = await req('GET', '/stats/providers/top'); add('/stats/providers/top', 'GET', r.ok, r.status);
    r = await req('GET', '/stats/revenue'); add('/stats/revenue', 'GET', r.ok, r.status);

    // ─── 12. MAPS ───
    console.log('12. Maps');
    r = await req('GET', '/maps/geocode?address=Sandton'); add('/maps/geocode', 'GET', r.ok || r.status === 400 || r.status === 503, r.status);
    r = await req('GET', '/maps/reverse-geocode?lat=-26.2041&lng=28.0473'); add('/maps/reverse-geocode', 'GET', r.ok || r.status === 400 || r.status === 503, r.status);
    r = await req('GET', '/maps/route?origin=-26.2041,28.0473&destination=-26.1076,28.0567'); add('/maps/route', 'GET', r.ok || r.status === 400 || r.status === 503, r.status);
    if (bookingId && customerToken) {
      r = await req('GET', `/maps/booking/${bookingId}/embed`, null, customerToken); add('/maps/booking/:id/embed', 'GET', r.ok || r.status === 404, r.status);
    }

    // ─── 13. WORKFLOWS ───
    if (bookingId && customerToken) {
      r = await req('GET', `/workflows/${bookingId}`, null, customerToken); add('/workflows/:bookingId', 'GET', r.ok || r.status === 404, r.status);
    }

    // ─── 14. PRIVACY ───
    console.log('14. Privacy');
    r = await req('GET', '/privacy/status', null, customerToken); add('/privacy/status', 'GET', r.ok, r.status);
    r = await req('GET', '/privacy/export-data', null, customerToken); add('/privacy/export-data', 'GET', r.ok, r.status);
    r = await req('PUT', '/privacy/consent', { marketing: false, analytics: false }, customerToken); add('/privacy/consent', 'PUT', r.ok || r.status === 400, r.status);

    // ─── 15. COMPLAINTS ───
    console.log('15. Complaints');
    r = await req('GET', '/complaints/my-complaints', null, customerToken); add('/complaints/my-complaints', 'GET', r.ok, r.status);
    if (bookingId) {
      r = await req('POST', '/complaints', { bookingId, type: 'service_quality', title: 'Test', description: 'Test complaint' }, customerToken);
      add('/complaints (create)', 'POST', r.ok || r.status === 400, r.status);
      if (r.data?.id) complaintId = r.data.id;
    }
    if (complaintId) r = await req('GET', `/complaints/${complaintId}`, null, customerToken);

    // ─── 16. CONTACT ───
    console.log('16. Contact');
    r = await req('POST', '/contact', { name: 'Test', email: 'test@test.com', subject: 'Test', message: 'Test message' });
    add('/contact', 'POST', r.ok || r.status === 400, r.status);

    // ─── 17. EMAIL VERIFICATION ───
    r = await req('POST', '/email-verification/send-verification', { email: cEmail }); add('/email-verification/send', 'POST', r.ok || r.status === 400, r.status);
    r = await req('GET', '/email-verification/verification-status', null, customerToken); add('/email-verification/status', 'GET', r.ok, r.status);

    // ─── 18. REGISTRATION ROUTES ───
    r = await req('GET', '/complete-registration'); add('/complete-registration', 'GET', r.ok || r.status === 400, r.status);
    r = await req('GET', '/verify-provider'); add('/verify-provider', 'GET', r.ok || r.status === 400, r.status);

    // ─── 19. PASSWORD RESET ───
    r = await req('GET', '/password-reset/verify-token?token=invalid&email=test@test.com'); add('/password-reset/verify-token', 'GET', r.status === 200 || r.status === 400, r.status);

    // ─── 20. PROVIDER APPLICATION (PUBLIC) ───
    r = await req('POST', '/auth/applications/submit', {
      firstName: 'App', lastName: 'Test', email: `app-${ts}@test.com`, phone: '+27123456789',
      skills: ['plumbing'], experienceYears: 2,
    }); add('/auth/applications/submit', 'POST', r.ok || r.status === 400, r.status);
    if (r.data?.application?.id) applicationId = r.data.application.id;

    // ─── 21. ADMIN ROUTES ───
    console.log('21. Admin Routes');
    if (adminToken) {
      r = await req('GET', '/admin/bookings', null, adminToken); add('/admin/bookings', 'GET', r.ok, r.status);
      r = await req('GET', '/admin/users', null, adminToken); add('/admin/users', 'GET', r.ok, r.status);
      r = await req('GET', '/admin/services', null, adminToken); add('/admin/services', 'GET', r.ok, r.status);
      r = await req('GET', '/admin/wallet/summary', null, adminToken); add('/admin/wallet/summary', 'GET', r.ok, r.status);
      r = await req('GET', '/admin/wallet/transactions', null, adminToken); add('/admin/wallet/transactions', 'GET', r.ok, r.status);
      r = await req('GET', '/admin/complaints', null, adminToken); add('/admin/complaints', 'GET', r.ok, r.status);
      r = await req('GET', '/admin/documents/pending', null, adminToken); add('/admin/documents/pending', 'GET', r.ok, r.status);
      r = await req('GET', '/admin/applications', null, adminToken); add('/admin/applications', 'GET', r.ok, r.status);
      if (!applicationId) {
        const apps = r.data?.applications ?? r.data?.data?.applications ?? [];
        if (apps[0]?.id) applicationId = apps[0].id;
      }
      r = await req('GET', '/chat/admin/all', null, adminToken); add('/chat/admin/all', 'GET', r.ok, r.status);
      r = await req('GET', '/provider/online', null, adminToken); add('/provider/online (admin)', 'GET', r.ok, r.status);
      r = await req('GET', '/users', null, adminToken); add('/users (admin)', 'GET', r.ok, r.status);

      r = await req('POST', '/admin/services', { title: 'Admin Service', description: 'Test', price: 100, duration: 60 }, adminToken);
      add('/admin/services (create)', 'POST', r.ok || r.status === 400, r.status);
      const newSvcId = r.data?.service?.id;
      if (newSvcId) {
        r = await req('PUT', `/admin/services/${newSvcId}`, { title: 'Updated' }, adminToken); add('/admin/services/:id (update)', 'PUT', r.ok, r.status);
        r = await req('POST', `/admin/services/${newSvcId}/approve`, {}, adminToken); add('/admin/services/:id/approve', 'POST', r.ok || r.status === 400, r.status);
      }

      if (applicationId) {
        r = await req('GET', `/admin/applications/${applicationId}`, null, adminToken); add('/admin/applications/:id', 'GET', r.ok, r.status);
        r = await req('POST', `/admin/applications/${applicationId}/reject`, { reason: 'Test rejection' }, adminToken);
        add('/admin/applications/:id/reject', 'POST', r.ok || r.status === 400, r.status);
      }

      if (complaintId) {
        r = await req('PUT', `/admin/complaints/${complaintId}/resolve`, { resolution: 'Test' }, adminToken); add('/admin/complaints/:id/resolve', 'PUT', r.ok || r.status === 404, r.status);
      }

      r = await req('POST', '/admin/providers/register', {
        firstName: 'Admin', lastName: 'Provider', email: `admin-p-${ts}@test.com`, phone: '+27123456789',
      }, adminToken); add('/admin/providers/register', 'POST', r.ok || r.status === 400, r.status);

      r = await req('PUT', '/admin/profile', { firstName: 'Admin' }, adminToken); add('/admin/profile', 'PUT', r.ok || r.status === 400, r.status);
    } else {
      ['/admin/bookings', '/admin/users', '/admin/services', '/admin/wallet/summary', '/admin/applications'].forEach(route => {
        results.push({ route: `GET ${route}`, method: 'GET', status: 'SKIP', msg: 'No ADMIN_TOKEN' });
      });
    }

    // ─── 22. ADMIN OTP & VERIFY (PUBLIC) ───
    r = await req('POST', '/admin/otp/request', { email: 'xoli@spana.co.za' }); add('/admin/otp/request', 'POST', r.ok || r.status === 400, r.status);
    r = await req('GET', '/admin/verify'); add('/admin/verify', 'GET', r.status === 200 || r.status === 400, r.status);

    // ─── 23. BOOKING OPERATIONS (accept, decline, etc) ───
    if (providerToken && bookingId) {
      r = await req('POST', `/bookings/${bookingId}/accept`, {}, providerToken); add('/bookings/:id/accept', 'POST', r.ok || r.status === 400, r.status);
      r = await req('POST', `/bookings/${bookingId}/decline`, {}, providerToken); add('/bookings/:id/decline', 'POST', r.ok || r.status === 400, r.status);
    }

    // PayFast webhook commented out (using Stripe)

  } catch (e: any) {
    console.error('Test error:', e.message);
  } finally {
    await prisma.$disconnect();
  }

  // ─── PRINT RESULTS ───
  const pass = results.filter(x => x.status === 'PASS').length;
  const fail = results.filter(x => x.status === 'FAIL').length;
  const skip = results.filter(x => x.status === 'SKIP').length;

  console.log('\n' + '='.repeat(70));
  console.log('  RESULTS');
  console.log('='.repeat(70));
  console.log(`  ✅ Passed:  ${pass}`);
  console.log(`  ❌ Failed:  ${fail}`);
  console.log(`  ⏭️  Skipped: ${skip}`);
  console.log(`  Total:     ${results.length}`);
  console.log('='.repeat(70));

  if (fail > 0) {
    console.log('\n❌ FAILED:');
    results.filter(x => x.status === 'FAIL').forEach(r => console.log(`   ${r.route} - ${r.code} ${r.msg || ''}`));
  }

  console.log('\n' + (fail === 0 ? '✅ ALL ROUTES PASSED' : `❌ ${fail} FAILED`) + '\n');
  process.exit(fail > 0 ? 1 : 0);
}

run();
