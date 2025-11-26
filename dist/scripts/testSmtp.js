const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
// Load environment variables
dotenv.config();
async function testSmtpConnection() {
    console.log('🔧 Testing SMTP Configuration...\n');
    // Display current SMTP settings (without password)
    console.log('📧 SMTP Settings:');
    console.log(`   Host: ${process.env.SMTP_HOST || 'NOT SET'}`);
    console.log(`   Port: ${process.env.SMTP_PORT || 'NOT SET'}`);
    console.log(`   User: ${process.env.SMTP_USER || 'NOT SET'}`);
    console.log(`   Password: ${process.env.SMTP_PASS ? '***SET***' : 'NOT SET'}`);
    console.log(`   From: ${process.env.SMTP_FROM || 'NOT SET'}`);
    console.log(`   Secure: ${process.env.SMTP_SECURE || 'false'}`);
    console.log('');
    // Check if required environment variables are set
    const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        console.log('❌ Missing required environment variables:');
        missingVars.forEach(varName => console.log(`   - ${varName}`));
        console.log('\n📝 Please create a .env file with your SMTP configuration.');
        console.log('   Example for KonsoleH:');
        console.log('   SMTP_HOST=mail.yourdomain.com');
        console.log('   SMTP_PORT=587');
        console.log('   SMTP_USER=noreply@yourdomain.com');
        console.log('   SMTP_PASS=your_email_password');
        console.log('   SMTP_FROM=noreply@yourdomain.com');
        return;
    }
    try {
        // Create transporter
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                ciphers: 'TLSv1.2',
                rejectUnauthorized: false
            }
        });
        console.log('🔍 Verifying SMTP connection...');
        // Test connection
        await transporter.verify();
        console.log('✅ SMTP connection successful!');
        // Send test email
        console.log('📤 Sending test email...');
        const testEmail = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: process.env.SMTP_USER, // Send to yourself
            subject: 'Spana Backend - SMTP Test',
            text: 'This is a test email from your Spana backend SMTP configuration.',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">🎉 SMTP Test Successful!</h2>
          <p>This is a test email from your Spana backend.</p>
          <p><strong>Configuration:</strong></p>
          <ul>
            <li>Host: ${process.env.SMTP_HOST}</li>
            <li>Port: ${process.env.SMTP_PORT}</li>
            <li>User: ${process.env.SMTP_USER}</li>
            <li>From: ${process.env.SMTP_FROM || process.env.SMTP_USER}</li>
          </ul>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Sent at: ${new Date().toLocaleString()}
          </p>
        </div>
      `
        };
        const info = await transporter.sendMail(testEmail);
        console.log('✅ Test email sent successfully!');
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`   Response: ${info.response}`);
    }
    catch (error) {
        console.log('❌ SMTP test failed:');
        console.log(`   Error: ${error.message}`);
        if (error.code) {
            console.log(`   Code: ${error.code}`);
        }
        if (error.response) {
            console.log(`   Response: ${error.response}`);
        }
        console.log('\n🔧 Troubleshooting tips:');
        console.log('   1. Check your SMTP credentials');
        console.log('   2. Verify the SMTP host and port');
        console.log('   3. Ensure your email account allows SMTP access');
        console.log('   4. Check if your hosting provider requires specific settings');
        console.log('   5. Try different ports (587, 465, 25)');
        console.log('   6. Check if STARTTLS is required');
    }
}
// Run the test
testSmtpConnection().catch(console.error);
