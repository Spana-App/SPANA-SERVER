/**
 * Test the email microservice directly to see if emails are being sent
 */

import axios from 'axios';
import chalk from 'chalk';

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'https://email-microservice-pi.vercel.app';
const EMAIL_SERVICE_SECRET = process.env.EMAIL_SERVICE_SECRET || process.env.API_SECRET;

async function testEmailMicroservice() {
  console.log(chalk.blue('\n🧪 Testing Email Microservice Directly\n'));
  console.log(chalk.gray(`Service URL: ${EMAIL_SERVICE_URL}\n`));

  if (!EMAIL_SERVICE_SECRET) {
    console.log(chalk.yellow('⚠️  Set EMAIL_SERVICE_SECRET or API_SECRET in .env to run this test\n'));
    process.exit(1);
  }

  const testEmail = {
    to: 'eksnxiweni@gmail.com',
    subject: '[TEST] Direct Email Microservice Test',
    text: `This is a direct test of the email microservice.
    
Time: ${new Date().toISOString()}
    
If you receive this, the email microservice is working correctly!`,
    html: `
      <h2>Email Microservice Test</h2>
      <p>This is a direct test of the email microservice.</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <p>If you receive this, the email microservice is working correctly!</p>
    `,
    apiSecret: EMAIL_SERVICE_SECRET,
    type: 'contact'
  };

  try {
    console.log(chalk.yellow('📤 Sending test email via microservice...\n'));
    console.log(chalk.gray(`To: ${testEmail.to}`));
    console.log(chalk.gray(`Subject: ${testEmail.subject}\n`));

    const response = await axios.post(
      `${EMAIL_SERVICE_URL}/api/send`,
      testEmail,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-secret': EMAIL_SERVICE_SECRET
        },
        timeout: 30000
      }
    );

    console.log(chalk.green('✅ Email sent successfully!\n'));
    console.log(chalk.green(`Status: ${response.status}`));
    console.log(chalk.green(`Response: ${JSON.stringify(response.data, null, 2)}\n`));
    console.log(chalk.blue('📧 Check eksnxiweni@gmail.com inbox\n'));

  } catch (error: any) {
    console.log(chalk.red('❌ Failed to send email!\n'));
    if (error.response) {
      console.log(chalk.red(`Status: ${error.response.status}`));
      console.log(chalk.red(`Response: ${JSON.stringify(error.response.data, null, 2)}`));
    } else {
      console.log(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}

testEmailMicroservice();
