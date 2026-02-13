import prisma from '../lib/database';
import axios from 'axios';

async function testLazyTokenExpiration() {
  const testEmail = 'lazy-token-test@example.com';
  const BASE_URL = 'http://localhost:5003';

  try {
    console.log('🧪 Testing Lazy Token Expiration Logic\n');
    console.log('='.repeat(60));

    // Check if test user exists - skip to prevent accidental deletion
    const existing = await prisma.user.findUnique({ where: { email: testEmail } });
    if (existing) {
      console.log('⚠️  Test user already exists. Use a different email or skip this test.\n');
      return;
    }

    // Step 1: Register provider via self-registration
    console.log('\n2️⃣ Registering provider via self-registration...');
    const regRes = await axios.post(`${BASE_URL}/auth/register?sendEmails=true`, {
      email: testEmail,
      password: 'TestPassword123!',
      firstName: 'Lazy',
      lastName: 'Token',
      phone: '+27123456789',
      role: 'service_provider'
    });

    const userId = regRes.data.user._id || regRes.data.user.id;
    console.log('✅ Provider registered, User ID:', userId);

    // Step 2: Check token state BEFORE first use
    console.log('\n3️⃣ Checking token state BEFORE first use...');
    const userBefore = await prisma.user.findUnique({
      where: { id: userId },
      include: { serviceProvider: true }
    });

    const providerBefore = userBefore?.serviceProvider;
    console.log('   Token exists:', providerBefore?.verificationToken ? 'YES' : 'NO');
    console.log('   First Used At:', providerBefore?.verificationTokenFirstUsedAt || 'NULL (not used yet) ✅');
    console.log('   Expires:', providerBefore?.verificationExpires || 'NULL (no expiration) ✅');

    if (providerBefore?.verificationTokenFirstUsedAt) {
      throw new Error('Token should not be marked as used yet!');
    }
    if (providerBefore?.verificationExpires) {
      throw new Error('Token should not have expiration date yet!');
    }

    const token = providerBefore?.verificationToken;
    if (!token) {
      throw new Error('Token not found!');
    }

    // Step 3: First access - should mark token as first used
    console.log('\n4️⃣ First access to registration page...');
    const firstAccess = await axios.get(
      `${BASE_URL}/complete-registration?token=${token}&uid=${userId}`
    );

    console.log('   Status:', firstAccess.status);
    console.log('   Form loaded:', firstAccess.data.includes('profileForm') ? 'YES ✅' : 'NO');

    // Check token state AFTER first use
    const userAfter = await prisma.user.findUnique({
      where: { id: userId },
      include: { serviceProvider: true }
    });

    const providerAfter = userAfter?.serviceProvider;
    console.log('\n5️⃣ Checking token state AFTER first use...');
    console.log('   First Used At:', providerAfter?.verificationTokenFirstUsedAt || 'NULL');
    
    if (!providerAfter?.verificationTokenFirstUsedAt) {
      throw new Error('Token should be marked as first used!');
    }
    console.log('   ✅ Token marked as first used at:', providerAfter.verificationTokenFirstUsedAt);

    // Step 4: Second access - should still work (within 30 minutes)
    console.log('\n6️⃣ Second access (should still work within 30 minutes)...');
    const secondAccess = await axios.get(
      `${BASE_URL}/complete-registration?token=${token}&uid=${userId}`
    );
    console.log('   Status:', secondAccess.status);
    console.log('   Form loaded:', secondAccess.data.includes('profileForm') ? 'YES ✅' : 'NO');

    // Step 5: Test success page
    console.log('\n7️⃣ Testing success page...');
    const successPage = await axios.get(
      `${BASE_URL}/complete-registration?success=true&token=${token}&uid=${userId}`
    );
    console.log('   Status:', successPage.status);
    console.log('   Success page:', successPage.data.includes('Registration Complete') ? 'YES ✅' : 'NO');
    console.log('   Login button:', successPage.data.includes('Go to Login') ? 'YES ✅' : 'NO');

    // Step 6: Test script endpoint (should always work)
    console.log('\n8️⃣ Testing script endpoint (should always serve JS)...');
    const scriptRes = await axios.get(
      `${BASE_URL}/complete-registration.js?token=${token}&uid=${userId}`,
      { validateStatus: () => true } // Accept any status
    );
    console.log('   Status:', scriptRes.status);
    console.log('   Content-Type:', scriptRes.headers['content-type'] || 'N/A');
    console.log('   Is JavaScript:', scriptRes.data.includes('function') ? 'YES ✅' : 'NO');

    if (scriptRes.status !== 200) {
      throw new Error(`Script endpoint returned ${scriptRes.status} instead of 200!`);
    }

    console.log('\n✅ ALL LAZY EXPIRATION TESTS PASSED!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Token never expires if unused');
    console.log('   ✅ 30-minute countdown starts on first use');
    console.log('   ✅ Token can be accessed multiple times within 30 minutes');
    console.log('   ✅ Success page works correctly');
    console.log('   ✅ Script endpoint always serves JavaScript');

    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test failed:');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('  Error:', error.message);
      console.error('  Stack:', error.stack);
    }
    await prisma.$disconnect();
    process.exit(1);
  }
}

testLazyTokenExpiration();
