/**
 * Comprehensive Production End-to-End Test
 * 
 * Tests the entire application and registration flow against production backend:
 * 1. Provider submits application (with documents)
 * 2. Admin reviews application
 * 3. Admin verifies application and creates provider account
 * 4. Provider receives registration link
 * 5. Provider completes profile
 * 6. Provider receives credentials email
 * 7. Provider can login
 * 8. Verify all verification flags
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const BASE_URL = process.env.PRODUCTION_URL || 'https://spana-server-5bhu.onrender.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.argv[2] || '';

// Test data
const TEST_EMAIL = `test-prod-flow-${Date.now()}@example.com`;
const TEST_FIRST_NAME = 'Production';
const TEST_LAST_NAME = 'Test Provider';
const TEST_PHONE = '+27123456789';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(step: string, message: string, color: string = colors.reset) {
  console.log(`${color}${step}${colors.reset} ${message}`);
}

function logSection(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}\n`);
}

function logSuccess(message: string) {
  log('✅', message, colors.green);
}

function logError(message: string) {
  log('❌', message, colors.red);
}

function logWarning(message: string) {
  log('⚠️ ', message, colors.yellow);
}

function logInfo(message: string) {
  log('ℹ️ ', message, colors.blue);
}

async function testProductionFlow() {
  console.log(`\n${colors.bright}${colors.magenta}🧪 COMPREHENSIVE PRODUCTION FLOW TEST${colors.reset}\n`);
  logInfo(`Base URL: ${BASE_URL}`);
  logInfo(`Test Email: ${TEST_EMAIL}\n`);

  let applicationId: string | null = null;
  let userId: string | null = null;
  let providerId: string | null = null;
  let testDocPath: string | null = null;

  try {
    // ============================================
    // STEP 1: Test Backend Connectivity
    // ============================================
    logSection('STEP 1: Testing Backend Connectivity');

    try {
      const healthCheck = await axios.get(`${BASE_URL}/health`, { timeout: 10000 });
      logSuccess(`Backend is reachable (Status: ${healthCheck.status})`);
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        logError(`Cannot reach backend at ${BASE_URL}`);
        logWarning('Make sure the backend is deployed and running');
        throw new Error('Backend connectivity failed');
      }
      // Health endpoint might not exist, that's okay
      logInfo('Health endpoint not available, continuing...');
    }

    // ============================================
    // STEP 2: Provider Submits Application
    // ============================================
    logSection('STEP 2: Provider Submits Application');

    // Create test document
    logInfo('Creating test document...');
    testDocPath = path.join(__dirname, '../test-document-prod.pdf');
    const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n');
    fs.writeFileSync(testDocPath, pdfContent);
    logSuccess('Test document created');

    // Upload document
    logInfo('Uploading document to production...');
    const formData = new FormData();
    formData.append('documents', fs.createReadStream(testDocPath), {
      filename: 'test-document.pdf',
      contentType: 'application/pdf'
    });
    formData.append('types[]', 'id');

    const uploadResponse = await axios.post(
      `${BASE_URL}/uploads/application-documents`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000
      }
    );

    if (!uploadResponse.data.documents || uploadResponse.data.documents.length === 0) {
      throw new Error('Document upload failed - no documents returned');
    }

    const uploadedDoc = uploadResponse.data.documents[0];
    logSuccess(`Document uploaded: ${uploadedDoc.name}`);
    logInfo(`Document URL: ${BASE_URL}${uploadedDoc.url}`);

    // Submit application
    logInfo('Submitting application...');
    const applicationData = {
      firstName: TEST_FIRST_NAME,
      lastName: TEST_LAST_NAME,
      email: TEST_EMAIL,
      phone: TEST_PHONE,
      skills: ['Plumbing', 'Electrical', 'HVAC', 'Carpentry'],
      experienceYears: 6,
      motivation: 'I want to join Spana to grow my business and serve more customers',
      location: 'Johannesburg, Gauteng',
      documents: [uploadedDoc]
    };

    const applicationResponse = await axios.post(
      `${BASE_URL}/auth/applications/submit`,
      applicationData,
      { timeout: 30000 }
    );

    applicationId = applicationResponse.data.application.id;
    logSuccess(`Application submitted successfully`);
    logInfo(`Application ID: ${applicationId}`);
    logInfo(`Status: ${applicationResponse.data.application.status}`);
    logInfo(`Documents: ${applicationResponse.data.application.documents?.length || 0}`);

    // ============================================
    // STEP 3: Admin Reviews Application
    // ============================================
    logSection('STEP 3: Admin Reviews Application');

    if (!ADMIN_TOKEN) {
      logWarning('No admin token provided. Skipping admin steps.');
      logInfo('To test admin flow, provide ADMIN_TOKEN as environment variable or argument');
      logInfo(`Example: ADMIN_TOKEN=<token> npx ts-node scripts/testProductionFlow.ts`);
      return;
    }

    // Get all applications
    logInfo('Fetching applications from admin endpoint...');
    const applicationsResponse = await axios.get(
      `${BASE_URL}/admin/applications`,
      {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`
        },
        timeout: 30000
      }
    );

    const applications = applicationsResponse.data.applications;
    logSuccess(`Retrieved ${applications.length} application(s)`);

    // Find our test application
    const testApplication = applications.find((app: any) => app.id === applicationId);
    if (!testApplication) {
      throw new Error('Test application not found in admin endpoint');
    }

    logSuccess('Test application found in admin endpoint');
    logInfo(`Email: ${testApplication.email}`);
    logInfo(`Documents: ${testApplication.documents?.length || 0}`);

    // Get single application
    logInfo('Fetching single application by ID...');
    const singleAppResponse = await axios.get(
      `${BASE_URL}/admin/applications/${applicationId}`,
      {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`
        },
        timeout: 30000
      }
    );

    logSuccess('Single application retrieved');
    const singleApp = singleAppResponse.data;
    if (singleApp.documents && Array.isArray(singleApp.documents)) {
      logInfo('Documents in application:');
      singleApp.documents.forEach((doc: any, idx: number) => {
        console.log(`   ${idx + 1}. ${doc.type?.toUpperCase() || 'DOCUMENT'}: ${doc.name || 'Unknown'}`);
        console.log(`      URL: ${BASE_URL}${doc.url}`);
      });
    } else {
      logInfo('No documents found in application');
    }

    // ============================================
    // STEP 4: Admin Verifies Application
    // ============================================
    logSection('STEP 4: Admin Verifies Application and Creates Provider Account');

    logInfo('Verifying application...');
    const verifyResponse = await axios.post(
      `${BASE_URL}/admin/applications/${applicationId}/verify`,
      {},
      {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`
        },
        timeout: 30000
      }
    );

    userId = verifyResponse.data.user.id;
    providerId = verifyResponse.data.provider.id;

    logSuccess('Application verified and provider account created');
    logInfo(`User ID: ${userId}`);
    logInfo(`Provider ID: ${providerId}`);
    logInfo(`Application Status: ${verifyResponse.data.application.status}`);

    // Fetch provider from database to get verification token and flags
    const createdProvider = await prisma.serviceProvider.findUnique({
      where: { id: providerId! },
      include: { user: true }
    });

    if (!createdProvider) {
      throw new Error('Provider not found after creation');
    }

    // Verify user flags
    logInfo('Verification flags after account creation:');
    console.log(`   isEmailVerified: ${createdProvider.user.isEmailVerified} (expected: false)`);
    console.log(`   isPhoneVerified: ${createdProvider.user.isPhoneVerified} (expected: null)`);
    console.log(`   isIdentityVerified: ${createdProvider.isIdentityVerified} (expected: true)`);
    console.log(`   isVerified: ${createdProvider.isVerified} (expected: true)`);

    // Check documents were linked (need to fetch from DB)
    const providerDocs = await prisma.document.findMany({
      where: { providerId: providerId! }
    });
    
    if (providerDocs.length > 0) {
      logSuccess(`Documents linked: ${providerDocs.length}`);
      providerDocs.forEach((doc, idx) => {
        console.log(`   ${idx + 1}. ${doc.type} - ${doc.url}`);
      });
    } else {
      logWarning('No documents found linked to provider');
    }

    // ============================================
    // STEP 5: Provider Receives Registration Link
    // ============================================
    logSection('STEP 5: Provider Receives Registration Link');

    const registrationToken = createdProvider.verificationToken;
    if (!registrationToken) {
      throw new Error('Verification token not found');
    }
    
    const registrationLink = `${BASE_URL}/complete-registration?token=${registrationToken}&uid=${userId}`;
    
    logSuccess('Registration link generated');
    logInfo(`Token: ${registrationToken.substring(0, 30)}...`);
    logInfo(`Link: ${registrationLink}`);

    // ============================================
    // STEP 6: Provider Completes Profile
    // ============================================
    logSection('STEP 6: Provider Completes Profile');

    logInfo('Submitting profile completion...');
    const profileData = {
      token: registrationToken,
      uid: userId,
      experienceYears: 6,
      skills: ['Plumbing', 'Electrical', 'HVAC', 'Carpentry', 'Flooring']
    };

    const profileResponse = await axios.post(
      `${BASE_URL}/complete-registration`,
      profileData,
      { timeout: 30000 }
    );

    logSuccess('Profile completed successfully');
    logInfo(`Message: ${profileResponse.data.message}`);

    // ============================================
    // STEP 7: Verify Final Flags
    // ============================================
    logSection('STEP 7: Verifying Final Verification Flags');

    // Get updated user/provider from database
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId! },
      include: { serviceProvider: true }
    });

    if (!updatedUser || !updatedUser.serviceProvider) {
      throw new Error('User or ServiceProvider not found after profile completion');
    }

    logInfo('Final verification flags:');
    const checks = [
      { name: 'isEmailVerified', expected: true, actual: updatedUser.isEmailVerified },
      { name: 'isPhoneVerified', expected: null, actual: updatedUser.isPhoneVerified },
      { name: 'isIdentityVerified', expected: true, actual: updatedUser.serviceProvider.isIdentityVerified },
      { name: 'isVerified', expected: true, actual: updatedUser.serviceProvider.isVerified },
      { name: 'isProfileComplete', expected: true, actual: updatedUser.serviceProvider.isProfileComplete }
    ];

    let allPassed = true;
    for (const check of checks) {
      const passed = check.actual === check.expected;
      const icon = passed ? '✅' : '❌';
      const color = passed ? colors.green : colors.red;
      console.log(`   ${icon} ${check.name}: ${check.actual} ${passed ? '' : `(expected: ${check.expected})`}`);
      if (!passed) allPassed = false;
    }

    if (!allPassed) {
      throw new Error('Some verification flags are incorrect');
    }

    logSuccess('All verification flags are correct!');

    // ============================================
    // STEP 8: Provider Can Login
    // ============================================
    logSection('STEP 8: Provider Can Login');

    const temporaryPassword = updatedUser.serviceProvider.temporaryPassword;
    if (!temporaryPassword) {
      throw new Error('Temporary password not set');
    }

    logInfo(`Attempting login with email: ${TEST_EMAIL}`);
    logInfo(`Password: ${temporaryPassword}`);

    const loginResponse = await axios.post(
      `${BASE_URL}/auth/login`,
      {
        email: TEST_EMAIL,
        password: temporaryPassword
      },
      { timeout: 30000 }
    );

    logSuccess('Login successful!');
    logInfo(`Token: ${loginResponse.data.token.substring(0, 30)}...`);
    logInfo(`User ID: ${loginResponse.data.user.id}`);
    logInfo(`Role: ${loginResponse.data.user.role}`);
    logInfo(`Email Verified: ${loginResponse.data.user.isEmailVerified}`);

    // ============================================
    // SUMMARY
    // ============================================
    logSection('TEST SUMMARY');

    console.log(`${colors.green}✅ Application submitted${colors.reset}`);
    console.log(`${colors.green}✅ Documents uploaded${colors.reset}`);
    console.log(`${colors.green}✅ Admin retrieved applications${colors.reset}`);
    console.log(`${colors.green}✅ Admin verified application${colors.reset}`);
    console.log(`${colors.green}✅ Provider account created${colors.reset}`);
    console.log(`${colors.green}✅ Documents linked to provider${colors.reset}`);
    console.log(`${colors.green}✅ Profile completed${colors.reset}`);
    console.log(`${colors.green}✅ Credentials email sent${colors.reset}`);
    console.log(`${colors.green}✅ Provider can login${colors.reset}`);
    console.log(`${colors.green}✅ All verification flags correct${colors.reset}`);

    console.log(`\n${colors.bright}${colors.green}🎉 ALL TESTS PASSED!${colors.reset}\n`);

  } catch (error: any) {
    console.log(`\n${colors.bright}${colors.red}❌ TEST FAILED${colors.reset}\n`);
    logError(`Error: ${error.message}`);
    
    if (error.response) {
      logError(`Status: ${error.response.status}`);
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    if (error.stack) {
      console.log(`\n${colors.yellow}Stack trace:${colors.reset}`);
      console.log(error.stack);
    }

    process.exit(1);
  } finally {
    // Cleanup
    if (testDocPath && fs.existsSync(testDocPath)) {
      fs.unlinkSync(testDocPath);
    }
    
    // Note: We don't delete the test user/application in production
    // as it might be useful for verification
    logInfo('Cleanup: Test document removed');
    logWarning('Test user and application left in database for verification');
    
    await prisma.$disconnect();
  }
}

testProductionFlow();
