import request from 'supertest';

// Ensure predictable JWT secret for any code paths
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

// Mock middleware and controllers BEFORE any imports
jest.mock('../middleware/auth', () => jest.fn((req: any, res: any, next: any) => { req.user = { id: 'u1', role: 'service provider' }; next(); }));
jest.mock('../middleware/providerReady', () => jest.fn((req: any, res: any, next: any) => next()));
jest.mock('../middleware/roles', () => {
  return (...args: any[]) => (req: any, res: any, next: any) => next();
});

jest.mock('../controllers/serviceController', () => ({
  getAllServices: async (req: any, res: any) => res.json([{ id: 'svc1', name: 'Test service' }]),
  getServiceById: async (req: any, res: any) => res.json({ id: req.params.id, name: 'Service ' + req.params.id }),
  createService: async (req: any, res: any) => res.status(201).json({ id: 'created', ...req.body }),
  updateService: async (req: any, res: any) => res.json({ id: req.params.id, ...req.body }),
  deleteService: async (req: any, res: any) => res.json({ success: true }),
  getServicesByCategory: async (req: any, res: any) => res.json([{ category: req.params.category }])
}));

jest.mock('../controllers/bookingController', () => ({
  createBooking: async (req: any, res: any) => res.status(201).json({ id: 'b1', ...req.body }),
  acceptBookingRequest: async (req: any, res: any) => res.json({ id: req.params.id, accepted: true }),
  declineBookingRequest: async (req: any, res: any) => res.json({ id: req.params.id, declined: true }),
  getUserBookings: async (req: any, res: any) => res.json([{ id: 'b1' }]),
  getBookingById: async (req: any, res: any) => res.json({ id: req.params.id }),
  updateBookingStatus: async (req: any, res: any) => res.json({ id: req.params.id, status: req.body.status }),
  cancelBooking: async (req: any, res: any) => res.json({ id: req.params.id, cancelled: true }),
  rateBooking: async (req: any, res: any) => res.json({ id: req.params.id, rating: req.body.rating }),
  rateCustomer: async (req: any, res: any) => res.json({ id: req.params.id, customerRating: req.body.customerRating }),
  startBooking: async (req: any, res: any) => res.json({ id: req.params.id, started: true }),
  completeBooking: async (req: any, res: any) => res.json({ id: req.params.id, completed: true }),
  updateLocation: async (req: any, res: any) => res.json({ id: req.params.id, location: req.body })
}));

jest.mock('../controllers/paymentController', () => ({
  createPaymentIntent: async (req: any, res: any) => res.status(201).json({ clientSecret: 'cs_test' }),
  confirmPayment: async (req: any, res: any) => res.json({ confirmed: true }),
  getPaymentHistory: async (req: any, res: any) => res.json([{ id: 'p1' }]),
  refundPayment: async (req: any, res: any) => res.json({ refunded: true })
}));

// For notifications the route uses Notification model directly; mock model
jest.mock('../models/Notification', () => ({
  // return a chainable object where .sort(...) returns a Promise resolving to array
  find: jest.fn().mockImplementation((q: any) => ({
    sort: (_sortObj: any) => Promise.resolve([{ _id: 'n1', userId: q.userId, title: 'N1' }])
  })),
  findOne: jest.fn().mockImplementation(async (q: any) => ({ _id: q._id, userId: q.userId, status: 'unread', save: async function() { this.status = 'read'; return this; } }))
}));

// Activity model used directly in activities route
jest.mock('../models/Activity', () => ({
  // Activity.find(...).sort(...).limit(...) => Promise<array>
  find: jest.fn().mockImplementation((q: any) => ({
    sort: (_s: any) => ({
      limit: (_limit: any) => Promise.resolve([{ id: 'a1', actionType: 'login' }])
    })
  }))
}));

// Mock userController
jest.mock('../controllers/userController', () => ({
  getAllUsers: async (req: any, res: any) => res.json([{ id: 'u1' }]),
  getUserById: async (req: any, res: any) => res.json({ id: req.params.id }),
  updateUser: async (req: any, res: any) => res.json({ id: req.params.id, ...req.body }),
  deleteUser: async (req: any, res: any) => res.json({ deleted: true }),
  getAllProviders: async (req: any, res: any) => res.json([{ id: 'prov1' }]),
  getProvidersByService: async (req: any, res: any) => res.json([{ serviceCategory: req.params.serviceCategory }]),
  verifyProvider: async (req: any, res: any) => res.json({ verified: true })
}));

// Mock upload route dependencies for document endpoints (User model used there)
jest.mock('../models/User', () => ({
  findById: jest.fn().mockImplementation(async (id: any) => ({
    _id: id,
    role: 'service provider',
    documents: [],
    save: jest.fn().mockResolvedValue(true)
  }))
}));

async function loadAppWithAllMocks() {
  // Now require the app after setting mocks
  const app = require('../server');
  return app;
}

describe('All routes smoke tests (mocked controllers/models)', () => {
  let app: any;
  beforeAll(async () => {
    app = await loadAppWithAllMocks();
  });

  test('Services: GET /services and GET /services/:id', async () => {
    const res = await request(app).get('/services');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const res2 = await request(app).get('/services/svc123');
    expect(res2.status).toBe(200);
    expect(res2.body).toHaveProperty('id', 'svc123');
  });

  test('Services: create/update/delete', async () => {
    const create = await request(app).post('/services').send({ name: 'X' });
    expect(create.status).toBe(201);
    expect(create.body).toHaveProperty('id', 'created');

    const update = await request(app).put('/services/svc123').send({ name: 'Updated' });
    expect(update.status).toBe(200);
    expect(update.body).toHaveProperty('id', 'svc123');

    const del = await request(app).delete('/services/svc123');
    expect(del.status).toBe(200);
    expect(del.body).toHaveProperty('success', true);
  });

  test('Bookings: create, list, get, status, cancel, rate, start/complete, location', async () => {
    const create = await request(app).post('/bookings').send({ serviceId: 's1' });
    expect(create.status).toBe(201);
    expect(create.body).toHaveProperty('id');

    const list = await request(app).get('/bookings');
    expect(list.status).toBe(200);

    const getb = await request(app).get('/bookings/b1');
    expect(getb.status).toBe(200);

    const status = await request(app).put('/bookings/b1/status').send({ status: 'confirmed' });
    expect(status.status).toBe(200);
    expect(status.body).toHaveProperty('status', 'confirmed');

    const cancel = await request(app).put('/bookings/b1/cancel');
    expect(cancel.status).toBe(200);
    expect(cancel.body).toHaveProperty('cancelled', true);

    const rate = await request(app).post('/bookings/b1/rate').send({ rating: 5 });
    expect(rate.status).toBe(200);
    expect(rate.body).toHaveProperty('rating', 5);

    const start = await request(app).post('/bookings/b1/start');
    expect(start.status).toBe(200);

    const complete = await request(app).post('/bookings/b1/complete');
    expect(complete.status).toBe(200);

    const loc = await request(app).post('/bookings/b1/location').send({ lat: -25, lng: 28 });
    expect(loc.status).toBe(200);
  });

  test('Payments: intent, confirm, history, refund', async () => {
    const intent = await request(app).post('/payments/intent').send({ amount: 100 });
    expect(intent.status).toBe(201);
    expect(intent.body).toHaveProperty('clientSecret');

    const confirm = await request(app).post('/payments/confirm').send({ intentId: 'i1' });
    expect(confirm.status).toBe(200);

    const history = await request(app).get('/payments/history');
    expect(history.status).toBe(200);

    const refund = await request(app).post('/payments/refund').send({ paymentId: 'p1' });
    expect(refund.status).toBe(200);
  });

  test('Notifications: list and mark read', async () => {
    const list = await request(app).get('/notifications');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);

    const mark = await request(app).post('/notifications/n1/read');
    expect(mark.status).toBe(200);
    expect(mark.body).toHaveProperty('status', 'read');
  });

  test('Activities: GET /activities', async () => {
    const res = await request(app).get('/activities');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Users: admin get all, get by id, update, delete, providers endpoints, verify', async () => {
    const all = await request(app).get('/users');
    expect(all.status).toBe(200);

    const getu = await request(app).get('/users/u1');
    expect(getu.status).toBe(200);

    const upd = await request(app).put('/users/u1').send({ firstName: 'New' });
    expect(upd.status).toBe(200);

    const del = await request(app).delete('/users/u1');
    expect(del.status).toBe(200);

    const providers = await request(app).get('/users/providers/all');
    expect(providers.status).toBe(200);

    const byservice = await request(app).get('/users/providers/plumbing');
    expect(byservice.status).toBe(200);

    const verify = await request(app).post('/users/verify').send({ userId: 'u1', verified: true });
    expect(verify.status).toBe(200);
  });
});
