/**
 * Live test of SPANA Contact Form on production
 */

import axios from 'axios';
import chalk from 'chalk';

const API_BASE_URL = 'https://spana-server-5bhu.onrender.com';

async function testContactForm() {
  console.log(chalk.blue('\n🧪 Testing SPANA Contact Form (Production)\n'));
  console.log(chalk.gray(`Backend: ${API_BASE_URL}\n`));

  const testData = {
    name: 'Test User - ' + new Date().toISOString(),
    email: 'test@example.com',
    phone: '+27123456789',
    subject: 'Test Contact Form - ' + new Date().toLocaleTimeString(),
    message: `This is a test message sent at ${new Date().toISOString()}. 
    
If you receive this email at eksnxiweni@gmail.com, the contact form is working correctly! ✅`
  };

  try {
    console.log(chalk.yellow('📤 Sending test contact form submission...\n'));
    console.log(chalk.gray('Test Data:'));
    console.log(chalk.gray(`  Name: ${testData.name}`));
    console.log(chalk.gray(`  Email: ${testData.email}`));
    console.log(chalk.gray(`  Subject: ${testData.subject}`));
    console.log(chalk.gray(`  Message: ${testData.message.substring(0, 50)}...\n`));

    const response = await axios.post(
      `${API_BASE_URL}/contact`,
      testData,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log(chalk.green('✅ SUCCESS!\n'));
    console.log(chalk.green(`Status: ${response.status}`));
    console.log(chalk.green(`Response: ${JSON.stringify(response.data, null, 2)}\n`));
    console.log(chalk.blue('📧 Check your email inbox at eksnxiweni@gmail.com\n'));
    console.log(chalk.yellow('💡 The email should arrive within a few seconds.\n'));

  } catch (error: any) {
    console.log(chalk.red('❌ FAILED!\n'));
    if (error.response) {
      console.log(chalk.red(`Status: ${error.response.status}`));
      console.log(chalk.red(`Error: ${JSON.stringify(error.response.data, null, 2)}`));
    } else {
      console.log(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}

testContactForm();
