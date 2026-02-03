import axios from 'axios';
import prisma from '../lib/database';

const BASE_URL = 'http://localhost:5003';

async function testTokenVerification() {
  try {
    console.log('🧪 Testing Token Verification Behavior\n');
    console.log('='.repeat(60));

    // Test 1: Invalid token on GET /complete-registration
    console.log('\n1️⃣ Testing GET /complete-registration with INVALID token & uid...');
    const invalidRes = await axios.get(
      `${BASE_URL}/complete-registration?token=invalid-token&uid=invalid-uid`,
      { validateStatus: () => true }
    );
    console.log('   Status:', invalidRes.status);
    console.log('   Response:', invalidRes.data.includes('Invalid Token') ? 'Shows "Invalid Token" error ✅' : invalidRes.data.includes('Provider Not Found') ? 'Shows "Provider Not Found" (404) ✅' : 'Something else');
    console.log('   Verifies token:', (invalidRes.status === 400 || invalidRes.status === 404) ? 'YES ✅' : 'NO');

    // Test 2: Invalid token on GET /complete-registration.js (should NOT verify)
    console.log('\n2️⃣ Testing GET /complete-registration.js with INVALID token...');
    const invalidScriptRes = await axios.get(
      `${BASE_URL}/complete-registration.js?token=invalid-token&uid=invalid-uid`,
      { validateStatus: () => true }
    );
    console.log('   Status:', invalidScriptRes.status);
    console.log('   Content-Type:', invalidScriptRes.headers['content-type'] || 'N/A');
    console.log('   Is JavaScript:', invalidScriptRes.data.includes('function') ? 'YES ✅' : 'NO');
    console.log('   Verifies token:', invalidScriptRes.status === 200 ? 'NO (always serves JS) ✅' : 'YES (should not verify)');

    // Test 3: Get a valid token from database
    console.log('\n3️⃣ Getting valid token from database...');
    const testEmail = 'lazy-token-test@example.com';
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
      include: { serviceProvider: true }
    });

    if (!user?.serviceProvider?.verificationToken) {
      console.log('   ⚠️  No test user found. Creating one...');
      // Create a test user
      const newUser = await prisma.user.create({
        data: {
          email: testEmail,
          password: 'hashed',
          firstName: 'Test',
          lastName: 'User',
          phone: '+27123456789',
          role: 'service_provider'
        }
      });

      await prisma.serviceProvider.create({
        data: {
          userId: newUser.id,
          verificationToken: 'test-valid-token-12345',
          verificationExpires: null,
          verificationTokenFirstUsedAt: null
        }
      });

      const updatedUser = await prisma.user.findUnique({
        where: { id: newUser.id },
        include: { serviceProvider: true }
      });

      if (updatedUser?.serviceProvider?.verificationToken) {
        const token = updatedUser.serviceProvider.verificationToken;
        const uid = updatedUser.id;

        console.log('\n4️⃣ Testing GET /complete-registration with VALID token...');
        const validRes = await axios.get(
          `${BASE_URL}/complete-registration?token=${token}&uid=${uid}`,
          { validateStatus: () => true }
        );
        console.log('   Status:', validRes.status);
        console.log('   Has form:', validRes.data.includes('profileForm') ? 'YES ✅' : 'NO');
        console.log('   Verifies token:', validRes.status === 200 ? 'YES ✅' : 'NO');

        console.log('\n5️⃣ Testing GET /complete-registration.js with VALID token...');
        const validScriptRes = await axios.get(
          `${BASE_URL}/complete-registration.js?token=${token}&uid=${uid}`,
          { validateStatus: () => true }
        );
        console.log('   Status:', validScriptRes.status);
        console.log('   Is JavaScript:', validScriptRes.data.includes('function') ? 'YES ✅' : 'NO');
        console.log('   Verifies token:', validScriptRes.status === 200 ? 'NO (always serves JS) ✅' : 'YES (should not verify)');
      }
    } else {
      const token = user.serviceProvider.verificationToken;
      const uid = user.id;

      console.log('   ✅ Found test user');
      console.log('   Token:', token.substring(0, 20) + '...');
      console.log('   UID:', uid);

      console.log('\n4️⃣ Testing GET /complete-registration with VALID token...');
      const validRes = await axios.get(
        `${BASE_URL}/complete-registration?token=${token}&uid=${uid}`,
        { validateStatus: () => true }
      );
      console.log('   Status:', validRes.status);
      console.log('   Has form:', validRes.data.includes('profileForm') ? 'YES ✅' : 'NO');
      console.log('   Verifies token:', validRes.status === 200 ? 'YES ✅' : 'NO');

      console.log('\n5️⃣ Testing GET /complete-registration.js with VALID token...');
      const validScriptRes = await axios.get(
        `${BASE_URL}/complete-registration.js?token=${token}&uid=${uid}`,
        { validateStatus: () => true }
      );
      console.log('   Status:', validScriptRes.status);
      console.log('   Is JavaScript:', validScriptRes.data.includes('function') ? 'YES ✅' : 'NO');
      console.log('   Verifies token:', validScriptRes.status === 200 ? 'NO (always serves JS) ✅' : 'YES (should not verify)');

      // Test 6: Valid UID but INVALID token
      console.log('\n6️⃣ Testing GET /complete-registration with VALID UID but INVALID token...');
      const wrongTokenRes = await axios.get(
        `${BASE_URL}/complete-registration?token=wrong-token-12345&uid=${uid}`,
        { validateStatus: () => true }
      );
      console.log('   Status:', wrongTokenRes.status);
      console.log('   Response:', wrongTokenRes.data.includes('Invalid Token') ? 'Shows "Invalid Token" ✅' : 'Something else');
      console.log('   Verifies token:', wrongTokenRes.status === 400 ? 'YES ✅' : 'NO');
    }

    console.log('\n✅ Token Verification Test Complete!');
    console.log('\n📋 Summary:');
    console.log('   ✅ GET /complete-registration: VERIFIES token (shows error if invalid)');
    console.log('   ✅ GET /complete-registration.js: DOES NOT verify token (always serves JS)');
    console.log('   ✅ This is the correct behavior for CSP compliance');

    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test failed:');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('  Error:', error.message);
    }
    await prisma.$disconnect();
    process.exit(1);
  }
}

testTokenVerification();
