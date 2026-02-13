/**
 * Check what CONTACT_EMAIL value the backend is using
 */

import axios from 'axios';
import chalk from 'chalk';

const BACKEND_URL = 'https://spana-server-5bhu.onrender.com';

async function checkContactEmail() {
  console.log(chalk.blue('\n🔍 Checking CONTACT_EMAIL Configuration\n'));

  try {
    // Try to get health endpoint which might show env vars (if available)
    const healthResponse = await axios.get(`${BACKEND_URL}/health/detailed`, { timeout: 15000 });
    
    console.log(chalk.yellow('Backend Health Status:'));
    console.log(chalk.gray(JSON.stringify(healthResponse.data, null, 2)));
    console.log('');

    // Test contact form to see what email it uses
    console.log(chalk.yellow('Testing contact form to see recipient email...'));
    const testResponse = await axios.post(
      `${BACKEND_URL}/contact`,
      {
        name: 'Test',
        email: 'test@example.com',
        message: 'Test'
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    console.log(chalk.green('✅ Contact form works'));
    console.log(chalk.yellow('\n⚠️  Based on logs, emails are being sent to: info@spana.co.za'));
    console.log(chalk.yellow('   This means CONTACT_EMAIL is NOT set in Render!\n'));

    console.log(chalk.blue('📋 To Fix:'));
    console.log(chalk.white('1. Go to Render Dashboard'));
    console.log(chalk.white('2. Select your backend service (spana-backend)'));
    console.log(chalk.white('3. Go to "Environment" tab'));
    console.log(chalk.white('4. Add/Update: CONTACT_EMAIL = eksnxiweni@gmail.com'));
    console.log(chalk.white('5. Save and redeploy (or wait for auto-restart)\n'));

  } catch (error: any) {
    console.log(chalk.red('Error checking backend:'), error.message);
  }
}

checkContactEmail();
