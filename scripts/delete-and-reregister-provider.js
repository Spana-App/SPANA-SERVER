const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteAndReregister() {
  try {
    const email = 'eksnxiweni@gmail.com';
    
    console.log('\n🗑️  Deleting existing user...\n');
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        serviceProvider: true
      }
    });

    if (user) {
      // Delete service provider if exists
      if (user.serviceProvider) {
        await prisma.serviceProvider.delete({
          where: { userId: user.id }
        });
        console.log('✅ Deleted ServiceProvider record');
      }

      // Delete user
      await prisma.user.delete({
        where: { id: user.id }
      });
      console.log('✅ Deleted User record\n');
    } else {
      console.log('ℹ️  User not found, proceeding to registration\n');
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Register new provider
    console.log('📝 Registering Service Provider...\n');
    console.log('Email:', email, '\n');

    const response = await axios.post('http://localhost:5003/auth/register?sendEmails=true', {
      email: email,
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
    console.log('Check', email, 'for the email with profile completion link.\n');

  } catch (error) {
    if (error.response) {
      console.error('❌ Registration Failed (Status:', error.response.status, ')\n');
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

deleteAndReregister();
