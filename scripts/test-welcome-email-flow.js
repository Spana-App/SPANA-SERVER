const axios = require('axios');
require('dotenv').config();

async function testWelcomeEmailFlow() {
  try {
    console.log('\n📧 Testing Welcome Email Flow\n');
    console.log('='.repeat(60));

    const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:3000';
    const apiSecret = process.env.EMAIL_SERVICE_SECRET || process.env.API_SECRET;

    console.log('Email Service URL:', emailServiceUrl);
    console.log('Testing welcome email with profile completion link...\n');

    // Test welcome email with token and uid (like registration flow)
    const welcomeResponse = await axios.post(
      `${emailServiceUrl}/api/welcome`,
      {
        to: 'eksnxiweni@gmail.com',
        name: 'Test Provider',
        role: 'service_provider',
        token: 'test-token-abc123',
        uid: 'test-uid-xyz789',
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
      console.log('\n📧 Check eksnxiweni@gmail.com for:');
      console.log('   Subject: Welcome to SPANA, Test Provider! 🎉');
      console.log('   Should contain "Complete Profile" button');
      console.log('   Link: /complete-registration?token=test-token-abc123&uid=test-uid-xyz789\n');
      
      if (welcomeResponse.data.messageId && welcomeResponse.data.messageId !== 'unknown') {
        console.log('📧 Resend Email ID:', welcomeResponse.data.messageId);
        console.log('🔗 Check delivery: https://resend.com/emails/' + welcomeResponse.data.messageId + '\n');
      }
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
      } else if (error.response.status === 500) {
        console.log('\n💡 Email service error - check email service logs\n');
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

testWelcomeEmailFlow();
