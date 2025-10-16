// const nodemailer = require('nodemailer'); // Moved to avoid conflicts
// const dotenv = require('dotenv'); // Moved to avoid conflicts

// Load environment variables
dotenv.config();

async function testSmtpConfigurations() {
  console.log('🔧 Advanced SMTP Configuration Testing...\n');
  
  // Display current SMTP settings
  console.log('📧 Current SMTP Settings:');
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
    return;
  }

  // Test different configurations
  const configurations = [
    {
      name: 'Current Configuration (Port 587 + SSL)',
      config: {
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
      }
    },
    {
      name: 'Port 587 + STARTTLS (Recommended)',
      config: {
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          ciphers: 'TLSv1.2',
          rejectUnauthorized: false
        }
      }
    },
    {
      name: 'Port 465 + SSL',
      config: {
        host: process.env.SMTP_HOST,
        port: 465,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          ciphers: 'TLSv1.2',
          rejectUnauthorized: false
        }
      }
    },
    {
      name: 'Port 25 + STARTTLS',
      config: {
        host: process.env.SMTP_HOST,
        port: 25,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          ciphers: 'TLSv1.2',
          rejectUnauthorized: false
        }
      }
    }
  ];

  for (const { name, config } of configurations) {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   Secure: ${config.secure}`);
    console.log(`   Auth: ${config.auth.user}`);
    
    try {
      const transporter = nodemailer.createTransport(config);
      
      // Test connection with timeout
      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
      );
      
      await Promise.race([verifyPromise, timeoutPromise]);
      console.log('   ✅ Connection successful!');
      
      // Try to send a test email
      console.log('   📤 Sending test email...');
      const testEmail = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: process.env.SMTP_USER,
        subject: `Spana SMTP Test - ${name}`,
        text: `This is a test email using configuration: ${name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">🎉 SMTP Test Successful!</h2>
            <p><strong>Configuration:</strong> ${name}</p>
            <p><strong>Host:</strong> ${config.host}:${config.port}</p>
            <p><strong>Secure:</strong> ${config.secure}</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              Sent at: ${new Date().toLocaleString()}
            </p>
          </div>
        `
      };

      const info = await transporter.sendMail(testEmail);
      console.log('   ✅ Test email sent successfully!');
      console.log(`   📧 Message ID: ${info.messageId}`);
      
      // If we get here, this configuration works!
      console.log(`\n🎉 SUCCESS! Use this configuration in your .env file:`);
      console.log(`SMTP_HOST=${config.host}`);
      console.log(`SMTP_PORT=${config.port}`);
      console.log(`SMTP_SECURE=${config.secure}`);
      console.log(`SMTP_USER=${config.auth.user}`);
      console.log(`SMTP_PASS=${process.env.SMTP_PASS}`);
      console.log(`SMTP_FROM=${process.env.SMTP_FROM || process.env.SMTP_USER}`);
      
      return; // Exit after finding a working configuration
      
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      if (error.code) {
        console.log(`   📋 Error Code: ${error.code}`);
      }
    }
  }

  console.log('\n❌ All configurations failed. Please check:');
  console.log('   1. Your SMTP credentials are correct');
  console.log('   2. Your hosting provider allows SMTP access');
  console.log('   3. Your firewall/antivirus isn\'t blocking the connection');
  console.log('   4. Contact KonsoleH support for specific SMTP settings');
}

// Run the test
testSmtpConfigurations().catch(console.error);
