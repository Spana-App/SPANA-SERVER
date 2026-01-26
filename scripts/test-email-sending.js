const axios = require('axios');

async function testEmailSending() {
  try {
    console.log('\n📧 Testing Email Sending via Email Service...\n');

    require('dotenv').config();
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:3000';
    const apiSecret = process.env.EMAIL_SERVICE_SECRET || process.env.API_SECRET || 'e37cf6365bf1daa23bbb4dfd359a978117857dfabb5410478ca0f8c58880cbf3';

    console.log('Email Service URL:', emailServiceUrl);
    console.log('Testing welcome email...\n');

    // Test welcome email
    const welcomeResponse = await axios.post(
      `${emailServiceUrl}/api/welcome`,
      {
        to: 'eksnxiweni@gmail.com',
        name: 'Test Provider',
        role: 'service_provider',
        token: 'test-token-123',
        uid: 'test-uid-123',
        apiSecret: apiSecret
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-secret': apiSecret
        },
        timeout: 30000
      }
    );

    if (welcomeResponse.status === 200) {
      console.log('✅ Welcome email sent successfully!\n');
      console.log('Response:', JSON.stringify(welcomeResponse.data, null, 2));
      console.log('\n📧 Check eksnxiweni@gmail.com for the email');
      console.log('   Subject: Welcome to SPANA, Test Provider! 🎉');
      console.log('   Should contain profile completion link\n');
    } else {
      console.error('❌ Email sending failed');
      console.log('Response:', welcomeResponse.data);
    }
  } catch (error) {
    if (error.response) {
      console.error('❌ Error (Status:', error.response.status, ')\n');
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.log('\n💡 API_SECRET might be missing or incorrect');
        console.log('   Check .env file for EMAIL_SERVICE_SECRET or API_SECRET\n');
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.error('❌ Cannot connect to email service');
      console.log('💡 Make sure email service is running:');
      console.log('   cd ../spana-email-service');
      console.log('   npm run dev\n');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testEmailSending();
