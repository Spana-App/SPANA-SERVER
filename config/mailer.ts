const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

// Create transporter lazily to allow env to load first
let cachedTransporter: any = null;

function isSmtpEnabled() {
  const mailProvider = (process.env.MAIL_PROVIDER || 'smtp').toLowerCase();
  const mailEnabled = String(process.env.MAIL_ENABLED || 'true').toLowerCase() === 'true';
  return mailEnabled && mailProvider !== 'none' && mailProvider !== 'disabled';
}

function getTransporter() {
  // Check if SMTP is disabled
  if (!isSmtpEnabled()) {
    throw new Error('SMTP is disabled. Set MAIL_PROVIDER=smtp and MAIL_ENABLED=true to enable email sending.');
  }

  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const pool = String(process.env.SMTP_POOL || '').toLowerCase() === 'true';
  const maxConnections = parseInt(process.env.SMTP_MAX_CONNECTIONS || '5', 10);
  const maxMessages = parseInt(process.env.SMTP_MAX_MESSAGES || '100', 10);
  const provider = (process.env.MAIL_PROVIDER || 'smtp').toLowerCase();
  const sendgridApiKey = process.env.SENDGRID_API_KEY;

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration is missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
  }

  // Choose transport based on MAIL_PROVIDER
  if (provider === 'sendgrid') {
    // SendGrid via SMTP requires username 'apikey' and password = API key
    if (!sendgridApiKey) {
      throw new Error('SENDGRID_API_KEY is required when MAIL_PROVIDER=sendgrid');
    }
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SENDGRID_SMTP_HOST || 'smtp.sendgrid.net',
      port: parseInt(process.env.SENDGRID_SMTP_PORT || '587', 10),
      secure: false,
      auth: { user: process.env.SENDGRID_SMTP_USER || 'apikey', pass: sendgridApiKey },
      pool: pool,
      maxConnections: maxConnections,
      maxMessages: maxMessages,
      requireTLS: true,
      connectionTimeout: parseInt(process.env.SMTP_CONNECTION_TIMEOUT || '10000', 10),
      tls: {
        ciphers: process.env.SMTP_TLS_CIPHERS || 'TLSv1.2',
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED ? process.env.SMTP_REJECT_UNAUTHORIZED === 'true' : false
      }
    });
  } else {
    // sensible defaults for Office365 or generic SMTP
    const effectiveHost = host || 'smtp.office365.com';
    cachedTransporter = nodemailer.createTransport({
      host: effectiveHost,
      port,
      secure,
      auth: { user, pass },
      pool: pool,
      maxConnections: maxConnections,
      maxMessages: maxMessages,
      requireTLS: true,
      connectionTimeout: parseInt(process.env.SMTP_CONNECTION_TIMEOUT || '10000', 10),
      tls: {
        // Use modern TLS; Office365 supports TLS 1.2
        ciphers: process.env.SMTP_TLS_CIPHERS || 'TLSv1.2',
        // In dev you can set SMTP_REJECT_UNAUTHORIZED=false to ignore cert errors (not for prod)
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED ? process.env.SMTP_REJECT_UNAUTHORIZED === 'true' : false
      }
    });
  }

  return cachedTransporter;
}

async function sendMail({ to, subject, text, html, from, attachments }: any) {
  // Check if SMTP is enabled before attempting to send
  if (!isSmtpEnabled()) {
    console.warn(`[SMTP Disabled] Email not sent to ${to}. Subject: ${subject}. Enable SMTP by setting MAIL_PROVIDER=smtp and MAIL_ENABLED=true`);
    // Return a mock success response to prevent errors in calling code
    return {
      messageId: `disabled-${Date.now()}`,
      accepted: [to],
      rejected: [],
      response: 'SMTP disabled - email not sent'
    };
  }

  try {
    const transporter = getTransporter();
    const fromAddress = from || process.env.SMTP_FROM || process.env.SMTP_USER;
    const mailOptions: any = { from: fromAddress, to, subject };
    if (text) mailOptions.text = text;
    if (html) mailOptions.html = html;
    if (attachments) mailOptions.attachments = attachments;
    return transporter.sendMail(mailOptions);
  } catch (error: any) {
    console.error('[SMTP Error] Failed to send email:', error.message);
    // Re-throw to allow calling code to handle the error
    throw error;
  }
}

// Send mail with inline images (attachments with cid)
async function sendMailWithInlineImages({ to, subject, html, inlineImages, from, text }: any) {
  // inlineImages: [{ filename, path, cid }]
  const attachments = (inlineImages || []).map((img: any) => ({ filename: img.filename, path: img.path, cid: img.cid }));
  return sendMail({ to, subject, html, attachments, from, text });
}

function buildWelcomeEmail({ firstName, lastName }: any) {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim() || 'there';
  const subject = 'Welcome to Spana!';
  const text = `Hi ${name},\n\nWelcome to Spana. Your account is now set up.\n\nThanks,\nThe Spana Team`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">Welcome to Spana, ${name}!</h2>
      <p>Your account is now set up and ready to use.</p>
      <p>If you didn't create this account, please contact support immediately.</p>
      <p style="margin-top:24px">Thanks,<br/>The Spana Team</p>
    </div>
  `;
  return { subject, text, html };
}

async function sendWelcomeEmail(user: any) {
  const { subject, text, html } = buildWelcomeEmail({ firstName: user.firstName, lastName: user.lastName });
  return sendMail({ to: user.email, subject, text, html });
}

function buildVerificationEmail({ firstName, lastName, verificationLink }: any) {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim() || 'there';
  const subject = 'Verify your provider account';
  const text = `Hi ${name},\n\nPlease verify your provider account by visiting: ${verificationLink}\n\nThanks,\nThe Spana Team`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111">
      <h3>Hi ${name},</h3>
      <p>Please verify your provider account.</p>
      <p><a href="${verificationLink}" style="background:#111;color:#fff;padding:10px 14px;text-decoration:none;border-radius:6px">Verify account</a></p>
      <p>If the button doesn't work, copy this link:<br/><span style="word-break:break-all">${verificationLink}</span></p>
    </div>
  `;
  return { subject, text, html };
}

async function sendVerificationEmail(user: any, verificationLink: string) {
  const { subject, text, html } = buildVerificationEmail({ firstName: user.firstName, lastName: user.lastName, verificationLink });
  return sendMail({ to: user.email, subject, text, html });
}

// New function for email verification (not provider verification)
async function sendEmailVerification({ to, name, link }: any) {
  const subject = 'Verify Your Email - Spana';
  const text = `Hi ${name},\n\nPlease verify your email by clicking this link: ${link}\n\nThis link expires in 24 hours.\n\nThanks,\nThe Spana Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Verify Your Email 📧</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-top: 0;">Hello ${name}!</h2>
        <p style="color: #666; line-height: 1.6; font-size: 16px;">
          Thank you for joining Spana! To complete your registration and ensure the security of your account, 
          please verify your email address by clicking the button below.
        </p>
        <p style="color: #666; line-height: 1.6; font-size: 16px;">
          This verification link will expire in 24 hours for your security.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${link}" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; font-size: 16px;">
            ✅ Verify My Email
          </a>
        </div>
        <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${link}" style="color: #667eea; word-break: break-all;">${link}</a>
        </p>
        <p style="color: #999; font-size: 14px; text-align: center; margin-top: 20px;">
          If you didn't create this account, please ignore this email.
        </p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>© 2024 Spana. All rights reserved.</p>
      </div>
    </div>
  `;
  return sendMail({ to, subject, text, html });
}

function buildReceiptEmail({ toRole, amount, currency, bookingId, transactionId, createdAt }: any) {
  const subject = `Payment receipt - Booking ${bookingId}`;
  const text = `Receipt for ${toRole}\nAmount: ${amount} ${currency}\nBooking: ${bookingId}\nTransaction: ${transactionId}\nDate: ${new Date(createdAt).toISOString()}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111">
      <h3>Payment receipt</h3>
      <p><strong>Amount:</strong> ${amount} ${currency}</p>
      <p><strong>Booking:</strong> ${bookingId}</p>
      <p><strong>Transaction:</strong> ${transactionId}</p>
      <p><strong>Date:</strong> ${new Date(createdAt).toLocaleString()}</p>
    </div>
  `;
  return { subject, text, html };
}

async function sendReceiptEmail({ to, toRole, amount, currency, bookingId, transactionId, createdAt }: any) {
  const { subject, text, html } = buildReceiptEmail({ toRole, amount, currency, bookingId, transactionId, createdAt });
  return sendMail({ to, subject, text, html });
}

function buildPasswordResetEmail({ name, link }: any) {
  const subject = 'Reset Your Password - Spana';
  const text = `Hi ${name},\n\nYou requested to reset your password. Click this link to reset: ${link}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nThanks,\nThe Spana Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Reset Your Password 🔐</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-top: 0;">Hello ${name}!</h2>
        <p style="color: #666; line-height: 1.6; font-size: 16px;">
          You requested to reset your password. Click the button below to create a new password.
        </p>
        <p style="color: #666; line-height: 1.6; font-size: 16px;">
          This link will expire in 1 hour for your security.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${link}" style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; font-size: 16px;">
            🔑 Reset Password
          </a>
        </div>
        <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${link}" style="color: #667eea; word-break: break-all;">${link}</a>
        </p>
        <p style="color: #ff6b6b; font-size: 14px; text-align: center; margin-top: 20px;">
          ⚠️ If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
        </p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>© 2024 Spana. All rights reserved.</p>
      </div>
    </div>
  `;
  return { subject, text, html };
}

async function sendPasswordResetEmail({ to, name, link }: any) {
  const { subject, text, html } = buildPasswordResetEmail({ name, link });
  return sendMail({ to, subject, text, html });
}

function buildInvoiceEmail({ name, invoiceNumber, bookingId, serviceTitle, amount, currency, jobSize, basePrice, multiplier, calculatedPrice, tipAmount, date, transactionId }: any) {
  const subject = `Invoice ${invoiceNumber} - Spana Service`;
  const text = `Invoice ${invoiceNumber}\n\nBooking: ${bookingId}\nService: ${serviceTitle}\nAmount: ${amount} ${currency}\nDate: ${date}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Invoice 📄</h1>
        <p style="color: white; margin: 5px 0 0 0; font-size: 18px;">${invoiceNumber}</p>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-top: 0;">Hello ${name}!</h2>
        <p style="color: #666; line-height: 1.6; font-size: 16px;">
          Thank you for your payment. Please find your invoice details below.
        </p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Booking ID:</strong></td>
              <td style="padding: 8px 0; text-align: right; color: #333;">${bookingId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Service:</strong></td>
              <td style="padding: 8px 0; text-align: right; color: #333;">${serviceTitle}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Job Size:</strong></td>
              <td style="padding: 8px 0; text-align: right; color: #333;">${jobSize || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Base Price:</strong></td>
              <td style="padding: 8px 0; text-align: right; color: #333;">${basePrice?.toFixed(2) || '0.00'} ${currency}</td>
            </tr>
            ${multiplier && multiplier !== 1.0 ? `
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Multiplier:</strong></td>
              <td style="padding: 8px 0; text-align: right; color: #333;">${multiplier}x</td>
            </tr>
            ` : ''}
            ${tipAmount && tipAmount > 0 ? `
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Tip:</strong></td>
              <td style="padding: 8px 0; text-align: right; color: #28a745;">+${tipAmount.toFixed(2)} ${currency}</td>
            </tr>
            ` : ''}
            <tr style="border-top: 2px solid #667eea; margin-top: 10px;">
              <td style="padding: 12px 0; color: #333; font-size: 18px;"><strong>Total Amount:</strong></td>
              <td style="padding: 12px 0; text-align: right; color: #667eea; font-size: 20px; font-weight: bold;">${amount.toFixed(2)} ${currency}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Transaction ID:</strong></td>
              <td style="padding: 8px 0; text-align: right; color: #333; font-size: 12px;">${transactionId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Date:</strong></td>
              <td style="padding: 8px 0; text-align: right; color: #333;">${new Date(date).toLocaleString()}</td>
            </tr>
          </table>
        </div>
        <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">
          This is an automated invoice. Please keep this for your records.
        </p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>© 2024 Spana. All rights reserved.</p>
      </div>
    </div>
  `;
  return { subject, text, html };
}

async function sendInvoiceEmail({ to, name, invoiceNumber, bookingId, serviceTitle, amount, currency, jobSize, basePrice, multiplier, calculatedPrice, tipAmount, date, transactionId }: any) {
  const { subject, text, html } = buildInvoiceEmail({ name, invoiceNumber, bookingId, serviceTitle, amount, currency, jobSize, basePrice, multiplier, calculatedPrice, tipAmount, date, transactionId });
  return sendMail({ to, subject, text, html });
}

function buildAdminOTPEmail({ name, otp, verificationLink }: any) {
  const subject = 'Your Spana Admin Login OTP 🎉';
  const text = `Hi ${name},\n\nWelcome to SPANA Admin! Your account has been created.\n\nYour 6-digit OTP for admin login is: ${otp}\n\nThis OTP expires in 5 hours.\n\n${verificationLink ? `Or click this link to verify and see your OTP: ${verificationLink}\n\n` : ''}If you didn't request this, please contact support immediately.\n\nThanks,\nThe Spana Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to SPANA Admin! 🎉</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-top: 0;">Hello ${name}!</h2>
        <p style="color: #666; line-height: 1.6; font-size: 16px;">
          Your admin account has been created! Use the OTP below to complete your login.
        </p>
        <div style="background: #f8f9fa; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px;">
          <p style="color: #999; font-size: 14px; margin: 0 0 10px 0;">Your 6-digit OTP:</p>
          <p style="color: #667eea; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${otp}</p>
        </div>
        ${verificationLink ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            🎊 Click here to verify & see confetti! 🎊
          </a>
        </div>
        ` : ''}
        <p style="color: #666; line-height: 1.6; font-size: 16px;">
          This OTP will expire in <strong>5 hours</strong> for your security.
        </p>
        <p style="color: #ff6b6b; font-size: 14px; text-align: center; margin-top: 20px;">
          ⚠️ If you didn't request this OTP, please contact support immediately. Your account may be at risk.
        </p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>© 2024 Spana. All rights reserved.</p>
      </div>
    </div>
  `;
  return { subject, text, html };
}

async function sendAdminOTPEmail({ to, name, otp, verificationLink }: any) {
  const { subject, text, html } = buildAdminOTPEmail({ name, otp, verificationLink });
  return sendMail({ to, subject, text, html });
}

module.exports = {
  sendMail,
  sendWelcomeEmail,
  buildWelcomeEmail,
  sendVerificationEmail,
  sendEmailVerification,
  sendReceiptEmail,
  sendPasswordResetEmail,
  sendInvoiceEmail,
  sendAdminOTPEmail,
  async verifySmtp() {
    try {
      // Check if SMTP is disabled first
      if (!isSmtpEnabled()) {
        return { 
          ok: false, 
          error: { 
            message: 'SMTP is disabled. Set MAIL_PROVIDER=smtp and MAIL_ENABLED=true to enable.',
            code: 'SMTP_DISABLED'
          } 
        };
      }

      const transporter = getTransporter();
      await transporter.verify();
      return { ok: true };
    } catch (error: any) {
      // Include code and response when available (helps diagnose auth vs connectivity)
      const details: any = { message: error && error.message ? error.message : String(error) };
      if (error && error.code) details.code = error.code;
      if (error && error.response) details.response = error.response;
      return { ok: false, error: details };
    }
  },
  isSmtpEnabled
};


  // Also expose helper
  module.exports.sendMailWithInlineImages = sendMailWithInlineImages;
  module.exports.getTransporter = getTransporter;

export {};