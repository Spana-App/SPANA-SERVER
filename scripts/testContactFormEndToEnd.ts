/**
 * End-to-end test: Simulate what happens when website form is submitted
 */

import axios from 'axios';
import chalk from 'chalk';

const BACKEND_URL = 'https://spana-server-5bhu.onrender.com';

async function testEndToEnd() {
  console.log(chalk.blue('\n🧪 End-to-End Contact Form Test\n'));
  console.log(chalk.gray('Simulating website form submission...\n'));

  // This is exactly what the website sends
  const formData = {
    name: 'Test User',
    email: 'test@example.com',
    phone: '+27123456789',
    subject: 'Test from Website Form',
    message: 'This is a test message from the website contact form.'
  };

  try {
    console.log(chalk.yellow('1️⃣  Website sends POST to backend...'));
    console.log(chalk.gray(`   URL: ${BACKEND_URL}/contact`));
    console.log(chalk.gray(`   Data: ${JSON.stringify(formData, null, 2)}\n`));

    const response = await axios.post(
      `${BACKEND_URL}/contact`,
      formData,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log(chalk.green('✅ Backend responded successfully!\n'));
    console.log(chalk.green(`   Status: ${response.status}`));
    console.log(chalk.green(`   Message: ${response.data.message}\n`));

    console.log(chalk.yellow('2️⃣  Backend should have sent email to CONTACT_EMAIL...'));
    console.log(chalk.gray('   Expected recipient: eksnxiweni@gmail.com\n'));

    console.log(chalk.blue('📋 Summary:'));
    console.log(chalk.green('   ✅ Website form → Backend API: Working'));
    console.log(chalk.green('   ✅ Backend → Email Microservice: Should be working'));
    console.log(chalk.yellow('   ⚠️  Email delivery: Check inbox/spam folder\n'));

    console.log(chalk.yellow('💡 If email not received:'));
    console.log(chalk.gray('   1. Check spam/junk folder'));
    console.log(chalk.gray('   2. Wait 1-2 minutes for delivery'));
    console.log(chalk.gray('   3. Verify CONTACT_EMAIL is set in Render environment'));
    console.log(chalk.gray('   4. Check Render logs for email service errors\n'));

  } catch (error: any) {
    console.log(chalk.red('❌ Test failed!\n'));
    if (error.response) {
      console.log(chalk.red(`   Status: ${error.response.status}`));
      console.log(chalk.red(`   Error: ${JSON.stringify(error.response.data, null, 2)}`));
      
      if (error.response.status === 503) {
        console.log(chalk.yellow('\n💡 This means email service is not configured in Render!'));
        console.log(chalk.yellow('   Add EMAIL_SERVICE_SECRET to Render environment variables\n'));
      }
    } else {
      console.log(chalk.red(`   Error: ${error.message}`));
    }
  }
}

testEndToEnd();
