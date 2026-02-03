import axios from 'axios';
import prisma from '../lib/database';

const BACKEND_URL = 'https://spana-server-5bhu.onrender.com';
const EMAIL_SERVICE_URL = 'https://email-microservice-pi.vercel.app';

// Admin credentials
const adminEmail = 'xoli@spana.co.za';
const adminPassword = 'TestPassword123!';

// Test admin to create (using timestamp to ensure unique)
const timestamp = Date.now();
const testAdminEmail = `test-admin-${timestamp}@spana.co.za`;
const testAdminFirstName = 'Test';
const testAdminLastName = 'Admin';
const testAdminPhone = '+27123456789';

let adminToken: string | null = null;

interface TestResult {
  step: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logResult(step: string, status: 'pass' | 'fail' | 'skip', message: string, details?: any) {
  results.push({ step, status, message, details });
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️';
  console.log(`${icon} ${step}: ${message}`);
  if (details) {
    console.log(`   Details:`, details);
  }
}

async function step1_CheckEmailService() {
  try {
    console.log('\n📧 Step 1: Checking Email Service Health...\n');
    
    const response = await axios.get(`${EMAIL_SERVICE_URL}/api/health`, {
      timeout: 10000,
      validateStatus: () => true
    });

    if (response.status === 200) {
      const health = response.data;
      const smtp = health.providers?.smtp;
      
      if (smtp?.status === 'connected') {
        logResult('Email Service', 'pass', 'SMTP is connected and ready', {
          host: smtp.host,
          port: smtp.port
        });
        return true;
      } else {
        logResult('Email Service', 'fail', 'SMTP is not connected', {
          host: smtp?.host,
          port: smtp?.port,
          status: smtp?.status
        });
        console.log('   ⚠️  Emails may not be sent, but OTP will be in API response');
        return false;
      }
    } else {
      logResult('Email Service', 'fail', 'Could not reach email service', { status: response.status });
      return false;
    }
  } catch (error: any) {
    logResult('Email Service', 'fail', 'Email service check failed', { error: error.message });
    return false;
  }
}

async function step2_LoginAsAdmin() {
  try {
    console.log('\n🔐 Step 2: Logging in as Admin...\n');
    console.log(`   Email: ${adminEmail}`);

    const loginResponse = await axios.post(
      `${BACKEND_URL}/auth/login`,
      { email: adminEmail, password: adminPassword },
      { timeout: 15000, validateStatus: () => true }
    );

    if (loginResponse.status === 200 && loginResponse.data.requiresOTP) {
      const otp = loginResponse.data.otp;
      logResult('Admin Login', 'pass', 'Login successful, OTP received', { otp });

      console.log('\n🔑 Step 2b: Verifying OTP...\n');
      const verifyResponse = await axios.post(
        `${BACKEND_URL}/admin/otp/verify`,
        { email: adminEmail, otp },
        { timeout: 15000, validateStatus: () => true }
      );

      if (verifyResponse.status === 200 && verifyResponse.data.token) {
        adminToken = verifyResponse.data.token;
        logResult('OTP Verification', 'pass', 'OTP verified, admin token received');
        return true;
      } else {
        logResult('OTP Verification', 'fail', 'OTP verification failed', verifyResponse.data);
        return false;
      }
    } else {
      logResult('Admin Login', 'fail', 'Login failed', loginResponse.data);
      return false;
    }
  } catch (error: any) {
    logResult('Admin Login', 'fail', 'Login error', { error: error.message });
    return false;
  }
}

async function step3_CheckBackendHealth() {
  try {
    console.log('\n🏥 Step 3: Checking Backend Health...\n');

    const response = await axios.get(`${BACKEND_URL}/health`, {
      timeout: 10000,
      validateStatus: () => true
    });

    if (response.status === 200) {
      const health = response.data;
      logResult('Backend Health', 'pass', 'Backend is healthy', {
        status: health.status,
        database: health.database,
        uptime: `${Math.floor(health.uptime)}s`
      });
      return true;
    } else {
      logResult('Backend Health', 'fail', 'Backend health check failed', { status: response.status });
      return false;
    }
  } catch (error: any) {
    logResult('Backend Health', 'fail', 'Health check error', { error: error.message });
    return false;
  }
}

async function step4_CheckUserExists() {
  try {
    console.log('\n🔍 Step 4: Checking if test admin exists...\n');
    console.log(`   Email: ${testAdminEmail}`);

    const user = await prisma.user.findUnique({
      where: { email: testAdminEmail.toLowerCase() }
    });

    if (user) {
      logResult('User Check', 'skip', 'User already exists, will skip creation', {
        id: user.id,
        role: user.role
      });
      return true; // User exists, skip creation
    } else {
      logResult('User Check', 'pass', 'User does not exist, will create', { email: testAdminEmail });
      return false; // User doesn't exist, proceed with creation
    }
  } catch (error: any) {
    logResult('User Check', 'fail', 'Error checking user', { error: error.message });
    return false;
  }
}

async function step5_CreateNewAdmin() {
  try {
    console.log('\n👤 Step 5: Creating New Admin...\n');
    console.log(`   Email: ${testAdminEmail}`);
    console.log(`   Name: ${testAdminFirstName} ${testAdminLastName}`);
    console.log(`   Phone: ${testAdminPhone}`);

    const createResponse = await axios.post(
      `${BACKEND_URL}/admin/admins/register`,
      {
        email: testAdminEmail,
        firstName: testAdminFirstName,
        lastName: testAdminLastName,
        phone: testAdminPhone
      },
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000,
        validateStatus: () => true
      }
    );

    if (createResponse.status === 201) {
      const data = createResponse.data;
      logResult('Create Admin', 'pass', 'Admin created successfully', {
        userId: data.user?.id,
        email: data.user?.email,
        passwordGenerated: !!data.password,
        emailSent: data.message?.includes('sent') || false
      });

      if (data.password) {
        console.log(`\n🔑 Auto-generated password: ${data.password}`);
        console.log('   (This should have been sent via email)');
      }

      return { success: true, password: data.password, userId: data.user?.id };
    } else {
      logResult('Create Admin', 'fail', 'Failed to create admin', {
        status: createResponse.status,
        response: createResponse.data
      });
      return { success: false };
    }
  } catch (error: any) {
    logResult('Create Admin', 'fail', 'Error creating admin', {
      error: error.message,
      response: error.response?.data
    });
    return { success: false };
  }
}

async function step6_TestNewAdminLogin(createdPassword?: string) {
  if (!createdPassword) {
    logResult('New Admin Login', 'skip', 'Skipped - admin not created or password not available');
    return false;
  }

  try {
    console.log('\n🔐 Step 6: Testing New Admin Login...\n');
    console.log(`   Email: ${testAdminEmail}`);
    console.log(`   Password: ${createdPassword}`);

    const loginResponse = await axios.post(
      `${BACKEND_URL}/auth/login`,
      {
        email: testAdminEmail,
        password: createdPassword
      },
      { timeout: 15000, validateStatus: () => true }
    );

    if (loginResponse.status === 200 && loginResponse.data.requiresOTP) {
      const otp = loginResponse.data.otp;
      logResult('New Admin Login', 'pass', 'Login successful, OTP received', { otp });

      // Verify OTP
      const verifyResponse = await axios.post(
        `${BACKEND_URL}/admin/otp/verify`,
        { email: testAdminEmail, otp },
        { timeout: 15000, validateStatus: () => true }
      );

      if (verifyResponse.status === 200 && verifyResponse.data.token) {
        logResult('New Admin OTP', 'pass', 'OTP verified, token received');
        return true;
      } else {
        logResult('New Admin OTP', 'fail', 'OTP verification failed', verifyResponse.data);
        return false;
      }
    } else {
      logResult('New Admin Login', 'fail', 'Login failed', loginResponse.data);
      return false;
    }
  } catch (error: any) {
    logResult('New Admin Login', 'fail', 'Login error', { error: error.message });
    return false;
  }
}

async function step7_TestAdminEndpoints() {
  if (!adminToken) {
    logResult('Admin Endpoints', 'skip', 'Skipped - no admin token');
    return false;
  }

  try {
    console.log('\n👑 Step 7: Testing Admin Endpoints...\n');

    const endpoints = [
      { name: 'Get All Users', path: '/admin/users', method: 'GET' },
      { name: 'Get All Bookings', path: '/admin/bookings', method: 'GET' },
      { name: 'Get All Services', path: '/admin/services', method: 'GET' },
    ];

    let passed = 0;
    for (const endpoint of endpoints) {
      try {
        const response = await axios({
          method: endpoint.method as any,
          url: `${BACKEND_URL}${endpoint.path}`,
          headers: { 'Authorization': `Bearer ${adminToken}` },
          timeout: 10000,
          validateStatus: () => true
        });

        if (response.status === 200) {
          passed++;
          logResult(endpoint.name, 'pass', `Status ${response.status}`, {
            dataCount: Array.isArray(response.data) ? response.data.length : 'N/A'
          });
        } else {
          logResult(endpoint.name, 'fail', `Status ${response.status}`, response.data);
        }
      } catch (error: any) {
        logResult(endpoint.name, 'fail', 'Request failed', { error: error.message });
      }
    }

    return passed === endpoints.length;
  } catch (error: any) {
    logResult('Admin Endpoints', 'fail', 'Error testing endpoints', { error: error.message });
    return false;
  }
}

async function runFullE2ETest() {
  console.log('🧪 Full End-to-End Test');
  console.log('='.repeat(80));
  console.log(`\n🌐 Using LIVE URLs:`);
  console.log(`   Backend: ${BACKEND_URL}`);
  console.log(`   Email Service: ${EMAIL_SERVICE_URL}`);
  console.log(`\n👤 Test Admin: ${testAdminEmail}`);
  console.log('='.repeat(80));

  try {
    // Step 1: Check email service
    await step1_CheckEmailService();

    // Step 2: Login as admin
    const loginSuccess = await step2_LoginAsAdmin();
    if (!loginSuccess) {
      console.log('\n❌ Cannot proceed without admin token');
      return;
    }

    // Step 3: Check backend health
    await step3_CheckBackendHealth();

    // Step 4: Check if user exists
    const userExists = await step4_CheckUserExists();

    let createdPassword: string | undefined;
    if (!userExists) {
      // Step 5: Create new admin
      const createResult = await step5_CreateNewAdmin();
      createdPassword = createResult.password;

      if (createResult.success) {
        // Step 6: Test new admin login
        await step6_TestNewAdminLogin(createdPassword);
      }
    } else {
      logResult('Create Admin', 'skip', 'User already exists, skipping creation');
      logResult('New Admin Login', 'skip', 'Skipped - user already exists');
    }

    // Step 7: Test admin endpoints
    await step7_TestAdminEndpoints();

    // Print Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const skipped = results.filter(r => r.status === 'skip').length;

    console.log(`\n✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📈 Total: ${results.length}\n`);

    results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️';
      console.log(`${icon} ${result.step}: ${result.message}`);
    });

    console.log('\n' + '='.repeat(80));
    if (failed === 0) {
      console.log('🎉 All tests passed! System is fully operational.');
    } else {
      console.log('⚠️  Some tests failed. Review details above.');
    }
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

runFullE2ETest();
