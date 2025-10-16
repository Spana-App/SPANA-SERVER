const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

// Create transporter lazily to allow env to load first
let cachedTransporter: any = null;

function getTransporter() {
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
  const transporter = getTransporter();
  const fromAddress = from || process.env.SMTP_FROM || process.env.SMTP_USER;
  const mailOptions: any = { from: fromAddress, to, subject };
  if (text) mailOptions.text = text;
  if (html) mailOptions.html = html;
  if (attachments) mailOptions.attachments = attachments;
  return transporter.sendMail(mailOptions);
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

module.exports = {
  sendMail,
  sendWelcomeEmail,
  buildWelcomeEmail,
  sendVerificationEmail,
  sendEmailVerification,
  sendReceiptEmail,
  async verifySmtp() {
    try {
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
  }
};


  // Also expose helper
  module.exports.sendMailWithInlineImages = sendMailWithInlineImages;
  module.exports.getTransporter = getTransporter;

export {};