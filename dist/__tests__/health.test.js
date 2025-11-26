"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
// Import app (server.ts exports app via module.exports)
const app = require('../server');
describe('Health endpoints', () => {
    test('GET /health returns 200 and basic fields', async () => {
        const res = await (0, supertest_1.default)(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).toHaveProperty('database');
    }, 10000);
    test('GET /health/detailed returns 200 and detailed fields', async () => {
        const res = await (0, supertest_1.default)(app).get('/health/detailed');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status');
        expect(res.body).toHaveProperty('uptime');
        expect(res.body).toHaveProperty('database');
        expect(res.body).toHaveProperty('smtp');
    }, 15000);
});
