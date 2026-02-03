import axios from 'axios';
import prisma from '../lib/database';

const BACKEND_URL = 'https://spana-server-5bhu.onrender.com';
const EMAIL_SERVICE_URL = 'https://email-microservice-pi.vercel.app';

// Admin credentials
const adminEmail = 'xoli@spana.co.za';
const adminPassword = 'TestPassword123!';

// New admin to create
const newAdminEmail = 'nhlakanipho@spana.co.za';
const newAdminFirstName = 'Nhlakanipho';
const newAdminLastName = 'Nxiweni';
const newAdminPhone = '+27123456789';

let adminToken: string | null = null;

async function checkUserExists(email: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    return !!user;
  } catch (error: any) {
    console.error('Error checking user:', error.message);
    return false;
  }
}

async function loginAsAdmin(): Promise<string | null> {
  try {
    console.log('🔐 Step 1: Logging in as admin...');
    console.log(`   Email: ${adminEmail}\n`);

    const loginResponse = await axios.post(
      `${BACKEND_URL}/auth/login`,
      {
        email: adminEmail,
        password: adminPassword
      },
      {
        timeout: 15000,
        validateStatus: () => true
      }
    );

    if (loginResponse.status === 200 && loginResponse.data.requiresOTP) {
      const otp = loginResponse.data.otp;
      console.log(`✅ Login successful! OTP received: ${otp}\n`);

      console.log('🔑 Step 2: Verifying OTP...');
      const verifyResponse = await axios.post(
        `${BACKEND_URL}/admin/otp/verify`,
        {
          email: adminEmail,
          otp: otp
        },
        {
          timeout: 15000,
          validateStatus: () => true
        }
      );

      if (verifyResponse.status === 200 && verifyResponse.data.token) {
        console.log('✅ OTP verified! Admin token received.\n');
        return verifyResponse.data.token;
      } else {
        console.error('❌ OTP verification failed:', verifyResponse.data);
        return null;
      }
    } else {
      console.error('❌ Login failed:', loginResponse.data);
      return null;
    }
  } catch (error: any) {
    console.error('❌ Error during login:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return null;
  }
}

async function checkNewAdminExists(): Promise<boolean> {
  try {
    console.log('🔍 Step 3: Checking if new admin exists...');
    console.log(`   Email: ${newAdminEmail}\n`);

    const exists = await checkUserExists(newAdminEmail);
    
    if (exists) {
      console.log('⚠️  User already exists in database!');
      const user = await prisma.user.findUnique({
        where: { email: newAdminEmail.toLowerCase() },
        select: { id: true, email: true, role: true, firstName: true, lastName: true }
      });
      if (user) {
        console.log(`   ID: ${user.id}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Name: ${user.firstName} ${user.lastName}`);
      }
      console.log('\n✅ Skipping creation - user already exists.\n');
      return true;
    } else {
      console.log('✅ User does NOT exist - will create new admin.\n');
      return false;
    }
  } catch (error: any) {
    console.error('❌ Error checking user:', error.message);
    return false;
  }
}

async function createNewAdmin(token: string): Promise<boolean> {
  try {
    console.log('👤 Step 4: Creating new admin...');
    console.log(`   Email: ${newAdminEmail}`);
    console.log(`   Name: ${newAdminFirstName} ${newAdminLastName}`);
    console.log(`   Phone: ${newAdminPhone}\n`);

    const createResponse = await axios.post(
      `${BACKEND_URL}/admin/admins/register`,
      {
        email: newAdminEmail,
        firstName: newAdminFirstName,
        lastName: newAdminLastName,
        phone: newAdminPhone
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000,
        validateStatus: () => true
      }
    );

    if (createResponse.status === 201) {
      console.log('✅ Admin created successfully!');
      console.log('Response:', JSON.stringify(createResponse.data, null, 2));
      
      if (createResponse.data.message) {
        console.log(`\n📧 ${createResponse.data.message}`);
      }
      
      if (createResponse.data.password) {
        console.log(`\n🔑 Auto-generated password: ${createResponse.data.password}`);
        console.log('   (This should have been sent via email)');
      }
      
      return true;
    } else {
      console.error('❌ Failed to create admin:', createResponse.status);
      console.error('Response:', JSON.stringify(createResponse.data, null, 2));
      return false;
    }
  } catch (error: any) {
    console.error('❌ Error creating admin:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

async function verifyEmailService() {
  try {
    console.log('📧 Step 5: Verifying email service...\n');
    
    const healthResponse = await axios.get(
      `${EMAIL_SERVICE_URL}/api/health`,
      { timeout: 10000, validateStatus: () => true }
    );

    if (healthResponse.status === 200) {
      const health = healthResponse.data;
      console.log('Email Service Health:');
      console.log(`   Status: ${health.status}`);
      
      if (health.providers?.smtp) {
        const smtp = health.providers.smtp;
        console.log(`   SMTP Host: ${smtp.host}`);
        console.log(`   SMTP Port: ${smtp.port}`);
        console.log(`   SMTP Status: ${smtp.status}`);
        
        if (smtp.status === 'error') {
          console.log('\n⚠️  WARNING: SMTP is showing error status');
          console.log('   Email may not be sent. Check Vercel environment variables.');
        } else if (smtp.status === 'connected') {
          console.log('\n✅ SMTP is connected - emails should be sent successfully!');
        }
      }
    } else {
      console.log('⚠️  Could not check email service health');
    }
  } catch (error: any) {
    console.log('⚠️  Could not verify email service:', error.message);
  }
}

async function runEndToEndTest() {
  console.log('🧪 End-to-End Admin Creation Test\n');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Step 1 & 2: Login and get admin token
    adminToken = await loginAsAdmin();
    if (!adminToken) {
      console.error('\n❌ Failed to get admin token. Cannot proceed.');
      return;
    }

    // Step 3: Check if new admin exists
    const userExists = await checkNewAdminExists();
    
    if (userExists) {
      console.log('✅ Test complete - user already exists, no action needed.');
      await prisma.$disconnect();
      return;
    }

    // Step 4: Create new admin
    const created = await createNewAdmin(adminToken);
    
    if (!created) {
      console.error('\n❌ Failed to create admin.');
      await prisma.$disconnect();
      return;
    }

    // Step 5: Verify email service
    await verifyEmailService();

    console.log('\n' + '='.repeat(80));
    console.log('✅ End-to-End Test Complete!');
    console.log('='.repeat(80));
    console.log('\n📋 Summary:');
    console.log(`   ✅ Logged in as: ${adminEmail}`);
    console.log(`   ✅ Created admin: ${newAdminEmail}`);
    console.log(`   📧 Registration email should have been sent`);
    console.log('\n💡 Next Steps:');
    console.log(`   1. Check ${newAdminEmail} inbox for registration email`);
    console.log('   2. Email should contain auto-generated password');
    console.log('   3. New admin can login with email and password');
    console.log('   4. They will receive OTP for admin login');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

runEndToEndTest();
