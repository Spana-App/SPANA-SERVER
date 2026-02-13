import prisma from '../lib/database';
import axios from 'axios';

async function testCompleteRegistration() {
  const testEmail = 'eksnxiweni@gmail.com';
  
  try {
    // Check if test user exists - skip to prevent accidental deletion
    const existing = await prisma.user.findUnique({ where: { email: testEmail } });
    if (existing) {
      console.log('⚠️  Test user already exists. Use a different email or skip this test.\n');
      return;
    }

    // Step 1: Register provider
    console.log('\n📧 Step 1: Registering provider...');
    const BASE_URL = process.env.BASE_URL || 'http://localhost:5003';
    const regRes = await axios.post(`${BASE_URL}/auth/register?sendEmails=true`, {
      email: testEmail,
      password: 'Provider123!',
      firstName: 'Eks',
      lastName: 'Nxiweni',
      phone: '+27123456789',
      role: 'service_provider',
      sendEmails: true
    });
    console.log('✅ Registered, User ID:', regRes.data.user._id);

    // Step 2: Get token
    console.log('\n🔍 Step 2: Fetching verification token...');
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
      include: { serviceProvider: true }
    });
    if (!user || !user.serviceProvider) {
      throw new Error('User or provider not found');
    }
    const token = user.serviceProvider.verificationToken;
    const uid = user.id;
    console.log('✅ Token retrieved');

    // Step 3: Test GET endpoint
    console.log('\n🧪 Step 3: Testing GET /complete-registration...');
    const getRes = await axios.get(`${BASE_URL}/complete-registration?token=${token}&uid=${uid}`);
    console.log('✅ GET Status:', getRes.status);
    console.log('✅ Form present:', getRes.data.includes('profileForm') ? 'Yes' : 'No');
    console.log('✅ Skills input:', getRes.data.includes('newSkill') ? 'Yes' : 'No');
    console.log('✅ Next steps message:', getRes.data.includes('Next Steps') ? 'Yes' : 'No');

    // Step 4: Test POST endpoint
    console.log('\n🧪 Step 4: Testing POST /complete-registration...');
    const postRes = await axios.post(`${BASE_URL}/complete-registration`, {
      firstName: 'Eks',
      lastName: 'Nxiweni',
      phone: '+27123456789',
      experienceYears: 5,
      skills: ['Plumbing', 'Electrical'],
      token,
      uid
    });
    console.log('✅ POST Status:', postRes.status);
    console.log('✅ Message:', postRes.data.message);

    // Step 5: Verify profile completion
    console.log('\n✅ Step 5: Verifying profile completion...');
    const updated = await prisma.user.findUnique({
      where: { id: uid },
      include: { serviceProvider: true }
    });
    console.log('✅ Profile Complete:', updated?.serviceProvider?.isProfileComplete);
    console.log('✅ Verified:', updated?.serviceProvider?.isVerified);
    console.log('✅ Skills:', updated?.serviceProvider?.skills);
    console.log('✅ Experience:', updated?.serviceProvider?.experienceYears);

    console.log('\n✅ ALL TESTS PASSED!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test failed:');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('  No response received. Is the server running on localhost:5003?');
      console.error('  Error:', error.message);
    } else {
      console.error('  Error:', error.message);
      console.error('  Stack:', error.stack);
    }
    process.exit(1);
  }
}

testCompleteRegistration();
