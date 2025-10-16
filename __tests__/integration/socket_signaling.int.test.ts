import http from 'http';
// import mongoose from 'mongoose'; // Removed - using Prisma now
import { MongoMemoryServer } from 'mongodb-memory-server';
// socket.io-client typings export shapes can vary depending on moduleInterop; import dynamically
import * as ClientLib from 'socket.io-client';
const Client: any = (ClientLib as any).io || (ClientLib as any).default || ClientLib;
type ClientSocket = any;

// Increase default Jest timeout for potentially slow in-memory server startup
jest.setTimeout(30000);

let mongod: any;
let app: any;
let server: any;
let url: string;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  jest.resetModules();
  app = require('../../server');
  await mongoose.connect(uri);

  server = http.createServer(app);
  const initSocket = app.initSocket || require('../../server').initSocket;
  const io = initSocket(server);
  // wait until server is actually listening
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const port = (server.address() as any).port;
  url = `http://localhost:${port}`;
});

afterAll(async () => {
  if (server) server.close();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Socket.io signaling', () => {
  test('exchange offer/answer/ice and chat', (done) => {
  // create clients that send an (empty) token so server accepts connection and assigns ids
  const clientA = Client(url, { transports: ['websocket'], auth: { token: '' } });
  const clientB = Client(url, { transports: ['websocket'], auth: { token: '' } });
  // track clients for cleanup
  (global as any).__test_clients = (global as any).__test_clients || [];
  (global as any).__test_clients.push(clientA, clientB);

    let ready = 0;
    clientB.on('connect', () => {
      ready++;
      if (ready === 2) runTest();
    });
    clientA.on('connect', () => {
      ready++;
      if (ready === 2) runTest();
    });

    function runTest() {
      clientB.on('call-offer', (payload: any) => {
        expect(payload.offer).toBeDefined();
        // respond with answer
        clientB.emit('call-answer', { toUserId: payload.from, answer: { type: 'answer' } });
      });

      clientA.on('call-answer', (payload: any) => {
        expect(payload.answer).toBeDefined();
        // exchange ice
        clientA.emit('call-ice', { toUserId: payload.from, candidate: { c: 1 } });
      });

      clientB.on('call-ice', (payload: any) => {
        expect(payload.candidate).toBeDefined();
        // chat test
        clientB.on('chat-message', (msg: any) => {
          expect(msg.message).toBe('hello');
          clientA.disconnect();
          clientB.disconnect();
          done();
        });
        clientA.emit('chat-message', { toUserId: clientB.id, message: 'hello' });
      });

      // start by sending offer from A to B
      clientA.emit('call-offer', { toUserId: clientB.id, offer: { type: 'offer' }, bookingId: null });
    }
  }, 30000);
  afterAll(() => {
    const clients = (global as any).__test_clients || [];
    clients.forEach((c: any) => {
      try { c.disconnect(); } catch (_) {}
    });
    (global as any).__test_clients = [];
  });
});
