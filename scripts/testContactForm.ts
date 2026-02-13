/**
 * Test script for SPANA Contact Form
 * Tests the /contact endpoint to verify it's working correctly
 */

import axios from 'axios';
import chalk from 'chalk';

// Default to production backend for testing
const API_BASE_URL = process.env.API_BASE_URL || process.env.BACKEND_URL || 'https://spana-server-5bhu.onrender.com';
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'https://email-microservice-pi.vercel.app';
const EMAIL_SERVICE_SECRET = process.env.EMAIL_SERVICE_SECRET || process.env.API_SECRET;

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

async function testContactForm(): Promise<void> {
  console.log(chalk.blue('\n🧪 Testing SPANA Contact Form\n'));
  console.log(chalk.gray(`Backend URL: ${API_BASE_URL}`));
  console.log(chalk.gray(`Email Service URL: ${EMAIL_SERVICE_URL || 'Not set'}`));
  console.log(chalk.gray(`Email Service Secret: ${EMAIL_SERVICE_SECRET ? '✅ Set' : '❌ Not set'}\n`));

  const results: TestResult[] = [];

  // Test 1: Check if backend is reachable
  try {
    console.log(chalk.yellow('1️⃣  Testing backend connectivity...'));
    const healthResponse = await axios.get(`${API_BASE_URL}/health`, { timeout: 15000 });
    if (healthResponse.status === 200) {
      results.push({
        name: 'Backend Connectivity',
        passed: true,
        message: 'Backend is reachable',
        details: healthResponse.data
      });
      console.log(chalk.green('   ✅ Backend is reachable\n'));
    } else {
      results.push({
        name: 'Backend Connectivity',
        passed: false,
        message: `Unexpected status: ${healthResponse.status}`
      });
      console.log(chalk.red(`   ❌ Unexpected status: ${healthResponse.status}\n`));
    }
  } catch (error: any) {
    results.push({
      name: 'Backend Connectivity',
      passed: false,
      message: error.message || 'Backend is not reachable'
    });
    console.log(chalk.red(`   ❌ Backend is not reachable: ${error.message}\n`));
    console.log(chalk.red('\n⚠️  Cannot continue testing. Please ensure the backend is running.\n'));
    printSummary(results);
    return;
  }

  // Test 2: Check email service configuration
  console.log(chalk.yellow('2️⃣  Testing email service configuration...'));
  if (!EMAIL_SERVICE_URL || !EMAIL_SERVICE_SECRET) {
    results.push({
      name: 'Email Service Configuration',
      passed: false,
      message: 'EMAIL_SERVICE_URL or EMAIL_SERVICE_SECRET is not set'
    });
    console.log(chalk.red('   ❌ Email service is not configured\n'));
    console.log(chalk.yellow('   ⚠️  Set EMAIL_SERVICE_URL and EMAIL_SERVICE_SECRET environment variables\n'));
  } else {
    results.push({
      name: 'Email Service Configuration',
      passed: true,
      message: 'Email service is configured'
    });
    console.log(chalk.green('   ✅ Email service is configured\n'));
  }

  // Test 3: Check email service health
  if (EMAIL_SERVICE_URL) {
    try {
      console.log(chalk.yellow('3️⃣  Testing email service health...'));
      const emailHealthResponse = await axios.get(`${EMAIL_SERVICE_URL}/api/health`, { timeout: 5000 });
      if (emailHealthResponse.status === 200 && emailHealthResponse.data.status === 'healthy') {
        results.push({
          name: 'Email Service Health',
          passed: true,
          message: 'Email service is healthy',
          details: emailHealthResponse.data
        });
        console.log(chalk.green('   ✅ Email service is healthy\n'));
      } else {
        results.push({
          name: 'Email Service Health',
          passed: false,
          message: 'Email service health check failed'
        });
        console.log(chalk.red('   ❌ Email service health check failed\n'));
      }
    } catch (error: any) {
      results.push({
        name: 'Email Service Health',
        passed: false,
        message: error.message || 'Email service is not reachable'
      });
      console.log(chalk.red(`   ❌ Email service is not reachable: ${error.message}\n`));
    }
  }

  // Test 4: Test contact endpoint with valid data
  console.log(chalk.yellow('4️⃣  Testing contact form submission...'));
  const testContactData = {
    name: 'Test User',
    email: 'test@example.com',
    phone: '+27123456789',
    subject: 'Test Contact Form',
    message: 'This is a test message from the contact form test script.'
  };

  try {
    const contactResponse = await axios.post(
      `${API_BASE_URL}/contact`,
      testContactData,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (contactResponse.status === 200) {
      results.push({
        name: 'Contact Form Submission',
        passed: true,
        message: 'Contact form submitted successfully',
        details: contactResponse.data
      });
      console.log(chalk.green('   ✅ Contact form submitted successfully\n'));
      console.log(chalk.gray(`   Response: ${JSON.stringify(contactResponse.data, null, 2)}\n`));
    } else {
      results.push({
        name: 'Contact Form Submission',
        passed: false,
        message: `Unexpected status: ${contactResponse.status}`
      });
      console.log(chalk.red(`   ❌ Unexpected status: ${contactResponse.status}\n`));
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    const statusCode = error.response?.status || 'N/A';
    
    results.push({
      name: 'Contact Form Submission',
      passed: false,
      message: `Failed: ${errorMessage}`,
      details: { status: statusCode, error: error.response?.data }
    });
    
    console.log(chalk.red(`   ❌ Contact form submission failed\n`));
    console.log(chalk.red(`   Status: ${statusCode}`));
    console.log(chalk.red(`   Error: ${errorMessage}\n`));
    
    if (statusCode === 503) {
      console.log(chalk.yellow('   💡 This usually means the email service is not configured.\n'));
    } else if (statusCode === 400) {
      console.log(chalk.yellow('   💡 Check that all required fields (name, email, message) are provided.\n'));
    }
  }

  // Test 5: Test validation (missing required fields)
  console.log(chalk.yellow('5️⃣  Testing form validation...'));
  try {
    await axios.post(
      `${API_BASE_URL}/contact`,
      { name: 'Test', email: 'test@example.com' }, // Missing message
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      }
    );
    results.push({
      name: 'Form Validation',
      passed: false,
      message: 'Validation should have rejected missing message field'
    });
    console.log(chalk.red('   ❌ Validation failed - should reject missing message\n'));
  } catch (error: any) {
    if (error.response?.status === 400) {
      results.push({
        name: 'Form Validation',
        passed: true,
        message: 'Validation correctly rejects invalid data'
      });
      console.log(chalk.green('   ✅ Validation correctly rejects invalid data\n'));
    } else {
      results.push({
        name: 'Form Validation',
        passed: false,
        message: `Unexpected error: ${error.message}`
      });
      console.log(chalk.red(`   ❌ Unexpected error: ${error.message}\n`));
    }
  }

  // Print summary
  printSummary(results);
}

function printSummary(results: TestResult[]): void {
  console.log(chalk.blue('\n' + '='.repeat(60)));
  console.log(chalk.blue('📊 Test Summary'));
  console.log(chalk.blue('='.repeat(60) + '\n'));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? chalk.green : chalk.red;
    console.log(color(`${icon} ${index + 1}. ${result.name}`));
    console.log(chalk.gray(`   ${result.message}`));
    if (result.details && !result.passed) {
      console.log(chalk.gray(`   Details: ${JSON.stringify(result.details, null, 2)}`));
    }
    console.log('');
  });

  console.log(chalk.blue('='.repeat(60)));
  console.log(chalk.green(`✅ Passed: ${passed}`));
  console.log(chalk.red(`❌ Failed: ${failed}`));
  console.log(chalk.blue(`📊 Total: ${results.length}`));
  console.log(chalk.blue('='.repeat(60) + '\n'));

  if (failed === 0) {
    console.log(chalk.green('🎉 All tests passed! Contact form is working correctly.\n'));
  } else {
    console.log(chalk.yellow('⚠️  Some tests failed. Please check the errors above.\n'));
    
    // Provide helpful suggestions
    const emailConfigFailed = results.find(r => r.name === 'Email Service Configuration' && !r.passed);
    if (emailConfigFailed) {
      console.log(chalk.yellow('💡 To fix email service issues:'));
      console.log(chalk.gray('   1. Set EMAIL_SERVICE_URL environment variable'));
      console.log(chalk.gray('   2. Set EMAIL_SERVICE_SECRET environment variable'));
      console.log(chalk.gray('   3. Ensure the email microservice is deployed and accessible\n'));
    }
  }
}

// Run tests
testContactForm().catch((error) => {
  console.error(chalk.red('\n❌ Test script error:'), error);
  process.exit(1);
});
