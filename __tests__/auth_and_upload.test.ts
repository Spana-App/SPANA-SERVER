import request from 'supertest';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = 'testsecret';
process.env.JWT_SECRET = JWT_SECRET;

// Helper to load the app with fresh module cache and custom mocks
async function loadAppWithMocks(setupMocks: () => void) {
  // reset module registry so mocks apply cleanly
  jest.resetModules();
  setupMocks();
  // require server after mocks are in place
  const app = require('../server');
  return app;
}

describe('Auth and Upload flows (mocked DB)', () => {
  test('Register flow - POST /auth/register', async () => {
    await jest.isolateModulesAsync(async () => {
      // Setup mocks
      jest.doMock('../models/User', () => {
        function User(this: any, data: any) {
          Object.assign(this, data);
        }
        // simulate save on prototype
        User.prototype.save = jest.fn().mockImplementation(async function (this: any) {
          this._id = 'mockedUserId';
          return this;
        });
        User.prototype.toObject = function(this: any) {
          // return a plain object copy like mongoose does
          const obj: any = {};
          Object.keys(this).forEach(k => { obj[k] = (this as any)[k]; });
          return obj;
        };
        User.findOne = jest.fn().mockResolvedValue(null);
        return User;
      });

      const app = await loadAppWithMocks(() => {});

      const payload = {
        email: 'alice@example.com',
        password: 'password123',
        firstName: 'Alice',
        lastName: 'Tester',
        phone: '+27123456789'
      };

      const res = await request(app).post('/auth/register').send(payload).set('Accept', 'application/json');
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message', 'User created successfully');
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', payload.email);
    });
  }, 20000);

  test('Login flow - POST /auth/login', async () => {
    await jest.isolateModulesAsync(async () => {
      // Mock User.findOne to return a user with comparePassword
      jest.doMock('../models/User', () => {
        function User(this: any, data: any) { Object.assign(this, data); }
        User.findOne = jest.fn().mockImplementation(async (query: any) => {
          if (query && query.email === 'bob@example.com') {
            // simulate mongoose doc with comparePassword and toObject
            return {
              _id: 'bobId',
              email: 'bob@example.com',
              password: 'hashed',
              firstName: 'Bob',
              lastName: 'Builder',
              phone: '+27100000000',
              role: 'customer',
              comparePassword: async (pwd: string) => pwd === 'secret123',
              toObject: () => ({ _id: 'bobId', email: 'bob@example.com', firstName: 'Bob', lastName: 'Builder', phone: '+27100000000', role: 'customer' })
            };
          }
          return null;
        });
        User.findById = jest.fn();
        return User;
      });

      const app = await loadAppWithMocks(() => {});

      const resFail = await request(app).post('/auth/login').send({ email: 'bob@example.com', password: 'wrong' });
      expect(resFail.status).toBe(400);
      expect(resFail.body).toHaveProperty('message', 'Invalid credentials');

      const res = await request(app).post('/auth/login').send({ email: 'bob@example.com', password: 'secret123' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Login successful');
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', 'bob@example.com');
    });
  }, 20000);

  test('GET /auth/me returns current user (auth middleware mocked)', async () => {
    await jest.isolateModulesAsync(async () => {
      // Mock auth middleware to inject req.user and mock User.findById.select
      jest.doMock('../middleware/auth', () => {
        return jest.fn((req: any, res: any, next: any) => {
          req.user = { id: 'meId' };
          next();
        });
      });

      jest.doMock('../models/User', () => {
        function User(this: any, data: any) { Object.assign(this, data); }
        User.findById = jest.fn().mockImplementation(async (id: any) => {
          // return a mongoose-like document with toObject
          return {
            _id: id,
            email: 'me@example.com',
            firstName: 'Me',
            lastName: 'Self',
            phone: '+27111111111',
            role: 'customer',
            toObject: () => ({ _id: id, email: 'me@example.com', firstName: 'Me', lastName: 'Self', phone: '+27111111111', role: 'customer' })
          };
        });
        return User;
      });

      const app = await loadAppWithMocks(() => {});

      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email', 'me@example.com');
      expect(res.body).toHaveProperty('role');
    });
  }, 20000);

  test('Upload profile image (POST /uploads/profile) with auth mocked', async () => {
    await jest.isolateModulesAsync(async () => {
      // Mock auth middleware
      jest.doMock('../middleware/auth', () => {
        return jest.fn((req: any, res: any, next: any) => {
          req.user = { id: 'uploaderId' };
          next();
        });
      });

      // Mock User.findById to return a user doc that can be saved
      jest.doMock('../models/User', () => {
        function User(this: any, data: any) { Object.assign(this, data); }
        User.findById = jest.fn().mockImplementation(async (id: any) => {
          return {
            _id: id,
            email: 'upload@example.com',
            role: 'customer',
            save: jest.fn().mockImplementation(async function () { return this; })
          };
        });
        return User;
      });

      const app = await loadAppWithMocks(() => {});

      const fileBuffer = Buffer.from('fake-image-content');
      const res = await request(app)
        .post('/uploads/profile')
        .attach('avatar', fileBuffer, { filename: 'avatar.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Profile image uploaded');
      expect(res.body).toHaveProperty('url');

      // cleanup created file from uploads folder if any
      if (res.body.url && res.body.url.startsWith('/uploads/')) {
        const filepath = path.join(process.cwd(), res.body.url.replace('/uploads/', 'uploads/'));
        try { fs.unlinkSync(filepath); } catch (_) {}
      }
    });
  }, 30000);
});
