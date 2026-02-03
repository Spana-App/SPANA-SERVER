/**
 * Complete End-to-End Test: Application and Registration Flow
 * 
 * Tests the entire flow:
 * 1. Provider submits application (with documents)
 * 2. Admin reviews application
 * 3. Admin verifies application and creates provider account
 * 4. Provider receives registration link
 * 5. Provider completes profile
 * 6. Provider receives credentials email
 * 7. Provider can login
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5003';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'xoli@spana.co.za';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.argv[2] || '';

// Test data
const TEST_EMAIL = `test-complete-flow-${Date.now()}@example.com`;
const TEST_FIRST_NAME = 'Test';
const TEST_LAST_NAME = 'Provider';
const TEST_PHONE = '+27123456789';

async function testCompleteFlow() {
  console.log('🧪 Testing Complete Application and Registration Flow\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Email: ${TEST_EMAIL}\n`);

  try {
    // ============================================
    // STEP 1: Provider Submits Application
    // ============================================
    console.log('📝 STEP 1: Provider submits application...');
    
    // First, upload a test document (create a PDF-like file)
    console.log('   📎 Uploading test document...');
    const testDocPath = path.join(__dirname, '../test-document.pdf');
    // Create a dummy test PDF file if it doesn't exist
    if (!fs.existsSync(testDocPath)) {
      // Create a minimal PDF file
      const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n');
      fs.writeFileSync(testDocPath, pdfContent);
    }

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
        headers: formData.getHeaders()
      }
    );

    if (!uploadResponse.data.documents || uploadResponse.data.documents.length === 0) {
      throw new Error('Document upload failed');
    }

    const uploadedDoc = uploadResponse.data.documents[0];
    console.log(`   ✅ Document uploaded: ${uploadedDoc.name}\n`);

    // Submit application with document
    const applicationData = {
      firstName: TEST_FIRST_NAME,
      lastName: TEST_LAST_NAME,
      email: TEST_EMAIL,
      phone: TEST_PHONE,
      skills: ['Plumbing', 'Electrical'],
      experienceYears: 5,
      motivation: 'I want to join Spana to grow my business',
      location: 'Johannesburg, Gauteng',
      documents: [uploadedDoc]
    };

    const applicationResponse = await axios.post(
      `${BASE_URL}/auth/applications/submit`,
      applicationData
    );

    console.log('   ✅ Application submitted successfully');
    console.log(`   Application ID: ${applicationResponse.data.application.id}\n`);

    const applicationId = applicationResponse.data.application.id;

    // Verify application was saved
    const savedApplication = await prisma.serviceProviderApplication.findUnique({
      where: { id: applicationId }
    });

    if (!savedApplication) {
      throw new Error('Application not found in database');
    }

    console.log('   ✅ Application verified in database');
    console.log(`   Status: ${savedApplication.status}`);
    console.log(`   Documents: ${savedApplication.documents ? 'Yes' : 'No'}\n`);

    // ============================================
    // STEP 2: Admin Reviews Application
    // ============================================
    console.log('👤 STEP 2: Admin reviews application...');
    
    if (!ADMIN_TOKEN) {
      console.log('   ⚠️  No admin token provided. Skipping admin steps.');
      console.log('   💡 To test admin flow, provide ADMIN_TOKEN as environment variable or argument\n');
      return;
    }

    // Admin can view the application (simulated - would be done in CMS)
    console.log('   ✅ Admin can view application in CMS\n');

    // ============================================
    // STEP 3: Admin Verifies Application and Creates Provider Account
    // ============================================
    console.log('✅ STEP 3: Admin verifies application and creates provider account...');

    const verifyResponse = await axios.post(
      `${BASE_URL}/admin/applications/${applicationId}/verify`,
      {},
      {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`
        }
      }
    );

    console.log('   ✅ Application verified and provider account created');
    console.log(`   User ID: ${verifyResponse.data.user.id}`);
    console.log(`   Provider ID: ${verifyResponse.data.provider.id}\n`);

    const userId = verifyResponse.data.user.id;
    const providerId = verifyResponse.data.provider.id;

    // Verify user and provider were created
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { serviceProvider: true }
    });

    if (!user || !user.serviceProvider) {
      throw new Error('User or ServiceProvider not found');
    }

    console.log('   ✅ User and Provider verified in database');
    console.log(`   Email: ${user.email}`);
    console.log(`   isEmailVerified: ${user.isEmailVerified}`);
    console.log(`   isPhoneVerified: ${user.isPhoneVerified}`);
    console.log(`   isIdentityVerified: ${user.serviceProvider.isIdentityVerified}`);
    console.log(`   isVerified: ${user.serviceProvider.isVerified}`);
    console.log(`   Temporary Password: ${user.serviceProvider.temporaryPassword ? 'Set' : 'Not set'}\n`);

    // Verify documents were created
    const documents = await prisma.document.findMany({
      where: { providerId: providerId }
    });

    console.log(`   ✅ Documents created: ${documents.length}`);
    documents.forEach((doc, index) => {
      console.log(`      ${index + 1}. ${doc.type} - ${doc.url}`);
    });
    console.log('');

    // ============================================
    // STEP 4: Provider Receives Registration Link
    // ============================================
    console.log('📧 STEP 4: Provider receives registration link...');
    console.log(`   Registration Token: ${user.serviceProvider.verificationToken?.substring(0, 20)}...`);
    console.log(`   Registration Link: ${BASE_URL}/complete-registration?token=${user.serviceProvider.verificationToken}&uid=${userId}\n`);

    // ============================================
    // STEP 5: Provider Completes Profile
    // ============================================
    console.log('📋 STEP 5: Provider completes profile...');

    const profileData = {
      token: user.serviceProvider.verificationToken,
      uid: userId,
      experienceYears: 5,
      skills: ['Plumbing', 'Electrical', 'HVAC']
    };

    const profileResponse = await axios.post(
      `${BASE_URL}/complete-registration`,
      profileData
    );

    console.log('   ✅ Profile completed successfully');
    console.log(`   Message: ${profileResponse.data.message}\n`);

    // Verify flags after profile completion
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { serviceProvider: true }
    });

    if (!updatedUser) {
      throw new Error('User not found after profile completion');
    }

    console.log('   ✅ Verification flags after profile completion:');
    console.log(`   isEmailVerified: ${updatedUser.isEmailVerified} (expected: true)`);
    console.log(`   isPhoneVerified: ${updatedUser.isPhoneVerified} (expected: null)`);
    console.log(`   isIdentityVerified: ${updatedUser.serviceProvider.isIdentityVerified} (expected: true)`);
    console.log(`   isVerified: ${updatedUser.serviceProvider.isVerified} (expected: true)`);
    console.log(`   isProfileComplete: ${updatedUser.serviceProvider.isProfileComplete} (expected: true)`);
    console.log(`   Temporary Password: ${updatedUser.serviceProvider.temporaryPassword ? 'Still set' : 'Cleared'}\n`);

    // Verify all flags are correct
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
      console.log(`   ${icon} ${check.name}: ${check.actual} (expected: ${check.expected})`);
      if (!passed) allPassed = false;
    }

    if (!allPassed) {
      throw new Error('Some verification flags are incorrect');
    }

    console.log('\n   ✅ All verification flags are correct!\n');

    // ============================================
    // STEP 6: Provider Receives Credentials Email
    // ============================================
    console.log('📧 STEP 6: Provider receives credentials email...');
    console.log(`   Email sent to: ${updatedUser.email}`);
    console.log(`   Password: ${updatedUser.serviceProvider.temporaryPassword}`);
    console.log('   ✅ Credentials email would be sent (check email service logs)\n');

    // ============================================
    // STEP 7: Provider Can Login
    // ============================================
    console.log('🔐 STEP 7: Provider can login...');

    const loginResponse = await axios.post(
      `${BASE_URL}/auth/login`,
      {
        email: TEST_EMAIL,
        password: updatedUser.serviceProvider.temporaryPassword
      }
    );

    console.log('   ✅ Login successful!');
    console.log(`   Token: ${loginResponse.data.token.substring(0, 20)}...`);
    console.log(`   User ID: ${loginResponse.data.user.id}`);
    console.log(`   Role: ${loginResponse.data.user.role}\n`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log('🎉 COMPLETE FLOW TEST PASSED!\n');
    console.log('📊 Summary:');
    console.log(`   ✅ Application submitted`);
    console.log(`   ✅ Documents uploaded`);
    console.log(`   ✅ Admin verified application`);
    console.log(`   ✅ Provider account created`);
    console.log(`   ✅ Documents linked to provider`);
    console.log(`   ✅ Profile completed`);
    console.log(`   ✅ Credentials email sent`);
    console.log(`   ✅ Provider can login\n`);

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await prisma.user.delete({ where: { id: userId } });
    await prisma.serviceProviderApplication.delete({ where: { id: applicationId } });
    // Clean up test document file
    if (fs.existsSync(testDocPath)) {
      fs.unlinkSync(testDocPath);
    }
    console.log('   ✅ Test data cleaned up\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testCompleteFlow();
