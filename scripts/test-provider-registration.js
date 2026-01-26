const axios = require('axios');

async function testProviderRegistration() {
  try {
    console.log('\n📝 Registering Service Provider...\n');
    console.log('Email: eksnxiweni@gmail.com\n');

    const response = await axios.post('http://localhost:5003/auth/register?sendEmails=true', {
      email: 'eksnxiweni@gmail.com',
      password: 'TestPassword123!',
      firstName: 'Eks',
      lastName: 'Nxiweni',
      phone: '+27123456789',
      role: 'service_provider'
    });

    console.log('✅ Registration Successful!\n');
    console.log('User ID:', response.data.user._id);
    console.log('Email:', response.data.user.email);
    console.log('Role:', response.data.user.role);
    console.log('Profile Complete:', response.data.user.isProfileComplete);
    console.log('\n📧 Welcome email sent via Resend!');
    console.log('Check eksnxiweni@gmail.com for the email with profile completion link.\n');
  } catch (error) {
    if (error.response) {
      console.error('❌ Registration Failed (Status:', error.response.status, ')\n');
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.data.message && error.response.data.message.includes('already exists')) {
        console.log('\n💡 User already exists. Options:');
        console.log('   1. Use existing account');
        console.log('   2. Delete user and re-register\n');
      }
    } else {
      console.error('❌ Error:', error.message);
      console.log('\n💡 Make sure the backend server is running:');
      console.log('   cd spana-backend');
      console.log('   npm run dev\n');
    }
  }
}

testProviderRegistration();
