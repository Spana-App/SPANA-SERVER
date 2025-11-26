"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
// import mongoose from 'mongoose'; // Removed - using Prisma now
const mongodb_memory_server_1 = require("mongodb-memory-server");
// socket.io-client typings export shapes can vary depending on moduleInterop; import dynamically
const ClientLib = __importStar(require("socket.io-client"));
const Client = ClientLib.io || ClientLib.default || ClientLib;
// Increase default Jest timeout for potentially slow in-memory server startup
jest.setTimeout(30000);
let mongod;
let app;
let server;
let url;
beforeAll(async () => {
    mongod = await mongodb_memory_server_1.MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri;
    jest.resetModules();
    app = require('../../server');
    // MongoDB connection removed - using Prisma now
    server = http_1.default.createServer(app);
    const initSocket = app.initSocket || require('../../server').initSocket;
    const io = initSocket(server);
    // wait until server is actually listening
    await new Promise((resolve) => server.listen(0, () => resolve()));
    const port = server.address().port;
    url = `http://localhost:${port}`;
});
afterAll(async () => {
    if (server)
        server.close();
    // MongoDB disconnect removed - using Prisma now
    if (mongod)
        await mongod.stop();
});
describe('Socket.io signaling', () => {
    test('exchange offer/answer/ice and chat', (done) => {
        // create clients that send an (empty) token so server accepts connection and assigns ids
        const clientA = Client(url, { transports: ['websocket'], auth: { token: '' } });
        const clientB = Client(url, { transports: ['websocket'], auth: { token: '' } });
        // track clients for cleanup
        global.__test_clients = global.__test_clients || [];
        global.__test_clients.push(clientA, clientB);
        let ready = 0;
        clientB.on('connect', () => {
            ready++;
            if (ready === 2)
                runTest();
        });
        clientA.on('connect', () => {
            ready++;
            if (ready === 2)
                runTest();
        });
        function runTest() {
            clientB.on('call-offer', (payload) => {
                expect(payload.offer).toBeDefined();
                // respond with answer
                clientB.emit('call-answer', { toUserId: payload.from, answer: { type: 'answer' } });
            });
            clientA.on('call-answer', (payload) => {
                expect(payload.answer).toBeDefined();
                // exchange ice
                clientA.emit('call-ice', { toUserId: payload.from, candidate: { c: 1 } });
            });
            clientB.on('call-ice', (payload) => {
                expect(payload.candidate).toBeDefined();
                // chat test
                clientB.on('chat-message', (msg) => {
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
        const clients = global.__test_clients || [];
        clients.forEach((c) => {
            try {
                c.disconnect();
            }
            catch (_) { }
        });
        global.__test_clients = [];
    });
});
