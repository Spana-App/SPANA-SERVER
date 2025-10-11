import dotenv from 'dotenv';
dotenv.config();

(async () => {
  try {
    // Use CommonJS require to match project config
    const mailer = require('../config/mailer');

    console.log('Verifying SMTP connection...');
    const verify = await mailer.verifySmtp();
    console.log('verifySmtp result:', verify);

    if (!process.env.TEST_EMAIL) {
      console.log('Set TEST_EMAIL in your .env to actually send a test email. Skipping send.');
      return;
    }

    console.log(`Sending a test email to ${process.env.TEST_EMAIL}...`);
    const info = await mailer.sendMail({
      to: process.env.TEST_EMAIL,
      subject: 'SPANA SMTP test',
      text: 'This is a test message from SPANA SMTP test script.'
    });

    console.log('Send result:', info);
  } catch (err: any) {
    console.error('Error in SMTP test script:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
