/**
 * Reset User Passwords with Email Service
 * Uses the configured email microservice
 */

import prisma from '../lib/database';
import bcrypt from 'bcryptjs';
import axios from 'axios';

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'https://email-microservice-pi.vercel.app';
const EMAIL_SERVICE_SECRET = process.env.EMAIL_SERVICE_SECRET;

// Generate secure random password
function generatePassword(): string {
  const length = 12;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

async function sendPasswordResetEmail(email: string, firstName: string, newPassword: string) {
  try {
    await axios.post(`${EMAIL_SERVICE_URL}/api/send`, {
      to: email,
      subject: '🔒 Your SPANA Password Has Been Reset',
      apiSecret: EMAIL_SERVICE_SECRET,
      type: 'generic',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0;">🔒 Password Reset</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi <strong>${firstName}</strong>,</p>
            
            <p>Due to a system update, your SPANA account password has been reset for security purposes.</p>
            
            <p>Your new temporary password is:</p>
            
            <div style="background: white; border: 2px dashed #667eea; padding: 20px; margin: 20px 0; text-align: center; font-size: 24px; font-weight: bold; color: #667eea; border-radius: 5px;">
              ${newPassword}
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <strong>⚠️ Important Security Notice:</strong>
              <ul>
                <li>This password is unique to your account</li>
                <li>Please change it immediately after logging in</li>
                <li>Never share this password with anyone</li>
                <li>This email should be deleted after you've logged in</li>
              </ul>
            </div>
            
            <p>To change your password:</p>
            <ol>
              <li>Login to SPANA with the password above</li>
              <li>Go to your profile settings</li>
              <li>Update your password to something memorable</li>
            </ol>
            
            <p style="text-align: center;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                Login to SPANA
              </a>
            </p>
            
            <p>If you did not request this password reset or have any concerns, please contact our support team immediately.</p>
            
            <p>Best regards,<br><strong>The SPANA Team</strong></p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #666;">
            <p>This is an automated message from SPANA. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} SPANA. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
    });
    return true;
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.response?.data || error.message;
    console.error(`   ⚠️  Email failed:`, JSON.stringify(errorMsg));
    return false;
  }
}

async function resetAllPasswords() {
  console.log('🔐 SPANA Password Reset System');
  console.log('=' .repeat(60));
  console.log('Generating unique passwords and sending emails...\n');

  try {
    // Get all real users (exclude test accounts)
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { email: { not: { contains: 'test' } } },
          { email: { not: { contains: 'e2e' } } },
          { email: { not: { contains: 'example.com' } } },
        ]
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      }
    });

    console.log(`📊 Found ${users.length} users to reset\n`);

    let successCount = 0;
    let emailSuccessCount = 0;
    const resetDetails: Array<{name: string, email: string, password: string, emailSent: boolean}> = [];

    for (const user of users) {
      const newPassword = generatePassword();
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      try {
        // Update password in database
        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashedPassword }
        });

        // Send email
        const emailSent = await sendPasswordResetEmail(user.email, user.firstName, newPassword);
        
        successCount++;
        if (emailSent) emailSuccessCount++;

        console.log(`${emailSent ? '✅' : '⚠️ '} ${user.firstName} ${user.lastName}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Password: ${newPassword}`);
        console.log(`   Email sent: ${emailSent ? '✅' : '❌'}\n`);

        resetDetails.push({
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          password: newPassword,
          emailSent
        });

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error: any) {
        console.error(`❌ Failed for ${user.email}: ${error.message}\n`);
      }
    }

    console.log('=' .repeat(60));
    console.log('✅ PASSWORD RESET COMPLETE');
    console.log('=' .repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   Total users: ${users.length}`);
    console.log(`   Passwords reset: ${successCount}`);
    console.log(`   Emails sent: ${emailSuccessCount}`);
    console.log(`   Email failures: ${successCount - emailSuccessCount}`);

    if (emailSuccessCount < successCount) {
      console.log('\n⚠️  Some emails failed to send. Here are the credentials for manual distribution:\n');
      console.log('📋 Password List (for users who didn\'t receive email):\n');
      resetDetails
        .filter(d => !d.emailSent)
        .forEach(d => {
          console.log(`   ${d.name}`);
          console.log(`   Email: ${d.email}`);
          console.log(`   Password: ${d.password}\n`);
        });
    } else {
      console.log('\n✅ All users received their password reset emails!');
    }

    console.log('\n📧 Email System Status: ' + (emailSuccessCount > 0 ? '✅ Working' : '❌ Not configured'));

  } catch (error: any) {
    console.error('\n❌ Reset failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetAllPasswords();
