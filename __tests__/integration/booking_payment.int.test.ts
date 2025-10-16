// import mongoose from 'mongoose'; // Removed - using Prisma now
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

let mongod: any;
let app: any;

// increase timeout for setup
jest.setTimeout(30000);
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('spana_test');
  process.env.MONGODB_URI = uri;
  // ensure stripe disabled for test
  process.env.STRIPE_SECRET_KEY = '';
  process.env.STRIPE_WEBHOOK_SECRET = '';

  // reset modules and connect mongoose before requiring app so models register against a connected mongoose
  jest.resetModules();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000, socketTimeoutMS: 45000, directConnection: true, family: 4 } as any);

  // robust wait for ready state
  const maxWait = 30000;
  const start = Date.now();
  while (mongoose.connection.readyState !== 1 && Date.now() - start < maxWait) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 200));
  }
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Failed to connect mongoose in beforeAll');
  }

  app = require('../../server');
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Integration: booking -> payment (in-memory MongoDB)', () => {
  test('create provider, service, customer, booking, confirm payment via webhook', async () => {
    console.log('DEBUG: mongoose readyState=', mongoose.connection.readyState);
    try {
      console.log('DEBUG: mongod uri=', (mongod && mongod.getUri) ? mongod.getUri() : 'no-mongod');
      // attempt to print mongoose client topology
      // @ts-ignore
      const client = mongoose.connection.client || (mongoose as any).client || null;
      console.log('DEBUG: mongoose.client=', client && client.s ? client.s.topology && client.s.topology.description : client && client.topology);
    } catch (e) {
      console.log('DEBUG: error printing client info', e);
    }
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Mongoose not connected in test');
    }
    // Quick direct DB write check to ensure the in-memory MongoDB accepts writes
    try {
      const coll = await mongoose.connection.db.createCollection('direct_check_users');
      await coll.insertOne({ ok: true, ts: new Date() });
      const docs = await coll.find({}).toArray();
      console.log('DEBUG: direct insert docs count=', docs.length);
    } catch (e) {
      console.error('DEBUG: direct insert failed', e);
    }

    // Use Mongoose models to prepare test data (preferred for clarity)
    const User = require('../../models/User');
    const Service = require('../../models/Service');
    const Booking = require('../../models/Booking');
    const Payment = require('../../models/Payment');

    const rawDb = mongoose.connection.db;
    let provider: any;
    let customer: any;
    let service: any;
    let booking: any;
    // Prefer Mongoose models but fall back to raw native inserts if buffering occurs
    try {
      provider = await User.create({ email: 'prov@example.com', password: 'pass123', firstName: 'Prov', lastName: 'ider', phone: '000', role: 'service provider', isVerified: true, isEmailVerified: true, isPhoneVerified: true, isIdentityVerified: true, skills: ['clean'] });
      customer = await User.create({ email: 'cust@example.com', password: 'pass123', firstName: 'Cust', lastName: 'O', phone: '111', role: 'customer' });
      service = await Service.create({ title: 'Cleaning', description: 'Clean', category: 'home', price: 50, duration: 60, provider: provider._id });
      booking = await Booking.create({ customer: customer._id, service: service._id, date: new Date(), time: '10:00', location: { type: 'Point', coordinates: [28, -25] }, status: 'pending' });
    } catch (err: any) {
      console.warn('Mongoose create failed, falling back to raw inserts:', err && err.message ? err.message : err);
      const ObjectId = mongoose.Types.ObjectId;
      const providerDoc = { _id: new ObjectId(), email: 'prov@example.com', password: 'pass123', firstName: 'Prov', lastName: 'ider', phone: '000', role: 'service provider', isVerified: true, isEmailVerified: true, isPhoneVerified: true, isIdentityVerified: true, skills: ['clean'], createdAt: new Date(), updatedAt: new Date() };
      const customerDoc = { _id: new ObjectId(), email: 'cust@example.com', password: 'pass123', firstName: 'Cust', lastName: 'O', phone: '111', role: 'customer', createdAt: new Date(), updatedAt: new Date() };
      await rawDb.collection('users').insertOne(providerDoc);
      await rawDb.collection('users').insertOne(customerDoc);
      const serviceDoc = { _id: new ObjectId(), title: 'Cleaning', description: 'Clean', category: 'home', price: 50, duration: 60, provider: providerDoc._id, createdAt: new Date(), updatedAt: new Date() };
      await rawDb.collection('services').insertOne(serviceDoc);
      const bookingDoc = { _id: new ObjectId(), customer: customerDoc._id, service: serviceDoc._id, date: new Date(), time: '10:00', location: { type: 'Point', coordinates: [28, -25] }, status: 'pending', createdAt: new Date(), updatedAt: new Date() };
      await rawDb.collection('bookings').insertOne(bookingDoc);
      // assign fallback objects to variables used downstream
      provider = providerDoc;
      customer = customerDoc;
      service = serviceDoc;
      booking = bookingDoc;
    }

    // Simulate webhook call: build a fake Stripe payment_intent.succeeded event body using our booking/customer ids
    const fakeEvent = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          amount: 5000,
          currency: 'usd',
          metadata: { bookingId: String(booking._id), userId: String(customer._id) }
        }
      }
    };

    const res = await request(app).post('/payments/webhook').send(fakeEvent).set('Content-Type', 'application/json');
    expect(res.status).toBe(200);

  // Ensure payment record created using native DB to avoid intermittent mongoose buffering
  const rawDbCheck = mongoose.connection.db;
  const payments = await rawDbCheck.collection('payments').find({ transactionId: 'pi_test_123' }).toArray();
  expect(payments.length).toBeGreaterThanOrEqual(1);
  const p = payments[0];
  expect(p.status).toBe('completed');

  // Booking should be updated to confirmed (native check)
  const bookingIdVal = booking && booking._id ? booking._id : null;
  const updatedBooking = await rawDbCheck.collection('bookings').findOne({ _id: bookingIdVal });
  expect(updatedBooking && updatedBooking.status).toBe('confirmed');
  }, 40000);
});
