require('dotenv').config();
const { sendAdminOTPEmail } = require('../config/mailer');

async function testAdminLogin() {
  console.log('🧪 Testing Admin OTP Email...\n');
  
  const testEmail = process.env.TEST_EMAIL || 'xoli@spana.co.za';
  const testOTP = '123456';
  const testLink = 'https://spana-server-5bhu.onrender.com/admin/verify?token=test&email=xoli@spana.co.za&otp=123456';
  
  console.log('SMTP Configuration:');
  console.log('  MAIL_ENABLED:', process.env.MAIL_ENABLED);
  console.log('  MAIL_PROVIDER:', process.env.MAIL_PROVIDER);
  console.log('  SMTP_HOST:', process.env.SMTP_HOST);
  console.log('  SMTP_PORT:', process.env.SMTP_PORT);
  console.log('  SMTP_USER:', process.env.SMTP_USER ? '***' : 'NOT SET');
  console.log('  SMTP_PASS:', process.env.SMTP_PASS ? '***' : 'NOT SET');
  console.log('');
  
  try {
    console.log(`📧 Sending test email to ${testEmail}...`);
    const result = await sendAdminOTPEmail({
      to: testEmail,
      name: 'Xoli',
      otp: testOTP,
      verificationLink: testLink
    });
    
    console.log('✅ Email sent successfully!');
    console.log('MessageId:', result.messageId);
    console.log('Accepted:', result.accepted);
    console.log('Rejected:', result.rejected);
  } catch (error: any) {
    console.error('❌ Failed to send email:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('Command:', error.command);
    process.exit(1);
  }
}

testAdminLogin();

