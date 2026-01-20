const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

// Import email service client (Vercel microservice)
const emailService = require('../lib/emailService');
const USE_EMAIL_SERVICE = process.env.USE_EMAIL_SERVICE === 'true' || !!process.env.EMAIL_SERVICE_URL;

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
  // Try alternative ports for Render compatibility (2525 is often not blocked)
  // Render free tier blocks 25, 465, 587 - but 2525 may work
  let port = parseInt(process.env.SMTP_PORT || '587', 10) || 587;
  
  // Detect Render environment (check multiple indicators)
  const isRender = process.env.RENDER || 
                   process.env.RENDER_SERVICE_NAME || 
                   (process.env.NODE_ENV === 'production' && process.env.PORT);
  
  // Render free tier blocks ports 25, 587, 465 - try alternative ports
  // Common alternatives: 2525, 8025, 2587
  if (isRender && (port === 587 || port === 465 || port === 25)) {
    // Try alternative port if configured
    if (process.env.SMTP_ALT_PORT) {
      const altPort = parseInt(process.env.SMTP_ALT_PORT, 10);
      if (altPort && altPort !== port) {
        console.log(`[SMTP] Render detected - using alternative port ${altPort} instead of ${port}`);
        port = altPort;
      }
    } else {
      // Auto-try common alternative ports for Render
      console.log(`[SMTP] Render detected - port ${port} may be blocked. Consider using SMTP_ALT_PORT=2525 or upgrade to paid plan.`);
    }
  }
  
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const pool = String(process.env.SMTP_POOL || '').toLowerCase() === 'true';
  const maxConnections = parseInt(process.env.SMTP_MAX_CONNECTIONS || '5', 10);
  const maxMessages = parseInt(process.env.SMTP_MAX_MESSAGES || '100', 10);
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  
  // Prioritize SendGrid if API key is available (works better on Render/cloud platforms)
  let provider = (process.env.MAIL_PROVIDER || 'smtp').toLowerCase();
  if (sendgridApiKey && !process.env.MAIL_PROVIDER) {
    console.log('[SMTP] SendGrid API key detected - using SendGrid (recommended for cloud platforms)');
    provider = 'sendgrid';
  }

  // Choose transport based on MAIL_PROVIDER
  if (provider === 'sendgrid') {
    // SendGrid doesn't need SMTP_HOST, SMTP_USER, SMTP_PASS - skip validation
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
      connectionTimeout: parseInt(process.env.SMTP_CONNECTION_TIMEOUT || '30000', 10), // Increased to 30s
      socketTimeout: parseInt(process.env.SMTP_SOCKET_TIMEOUT || '30000', 10), // 30s socket timeout
      greetingTimeout: parseInt(process.env.SMTP_GREETING_TIMEOUT || '5000', 10), // 5s greeting timeout
      tls: {
        ciphers: process.env.SMTP_TLS_CIPHERS || 'TLSv1.2',
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED ? process.env.SMTP_REJECT_UNAUTHORIZED === 'true' : false
      },
      debug: process.env.SMTP_DEBUG === 'true', // Enable debug logging
      logger: process.env.SMTP_DEBUG === 'true' // Enable logger
    });
  } else {
    // Validate SMTP settings for non-SendGrid providers
    if (!host || !user || !pass) {
      throw new Error('SMTP configuration is missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (or use SendGrid with SENDGRID_API_KEY)');
    }
    
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
      connectionTimeout: parseInt(process.env.SMTP_CONNECTION_TIMEOUT || '30000', 10), // 30s timeout
      socketTimeout: parseInt(process.env.SMTP_SOCKET_TIMEOUT || '30000', 10), // 30s socket timeout
      greetingTimeout: parseInt(process.env.SMTP_GREETING_TIMEOUT || '5000', 10), // 5s greeting timeout
      tls: {
        // Use modern TLS; Office365 supports TLS 1.2
        ciphers: process.env.SMTP_TLS_CIPHERS || 'TLSv1.2',
        // In dev you can set SMTP_REJECT_UNAUTHORIZED=false to ignore cert errors (not for prod)
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED ? process.env.SMTP_REJECT_UNAUTHORIZED === 'true' : false
      },
      debug: process.env.SMTP_DEBUG === 'true',
      logger: process.env.SMTP_DEBUG === 'true'
    });
  }

  return cachedTransporter;
}

// Retry email sending with exponential backoff
async function sendMailWithRetry({ to, subject, text, html, from, attachments, maxRetries = 5 }: any): Promise<any> {
  const retryDelay = (attempt: number) => Math.min(2000 * Math.pow(2, attempt), 15000); // Exponential backoff, max 15s
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await sendMail({ to, subject, text, html, from, attachments });
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      const isConnectionError = error.code === 'ETIMEDOUT' || 
                                error.code === 'ECONNREFUSED' || 
                                error.code === 'ECONNRESET' ||
                                error.code === 'ENOTFOUND' ||
                                error.message?.includes('timeout') ||
                                error.message?.includes('Connection');
      
      if (isLastAttempt) {
        console.error(`[SMTP] Failed after ${maxRetries + 1} attempts. Last error:`, {
          code: error.code,
          message: error.message,
          command: error.command
        });
        throw error;
      }
      
      if (isConnectionError) {
        const delay = retryDelay(attempt);
        console.warn(`[SMTP] Connection error (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`, {
          code: error.code,
          message: error.message
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Clear cached transporter to force new connection
        cachedTransporter = null;
      } else {
        // For non-connection errors (auth, etc.), don't retry
        console.error(`[SMTP] Non-connection error, not retrying:`, error.message);
        throw error;
      }
    }
  }
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
    
    console.log(`[SMTP] Attempting to send email to ${to} via ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
    console.log(`[SMTP] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[SMTP] Host: ${process.env.SMTP_HOST}`);
    console.log(`[SMTP] Port: ${process.env.SMTP_PORT}`);
    
    // Skip verification for faster sending - retry logic will handle connection issues
    const result = await transporter.sendMail(mailOptions);
    console.log(`[SMTP] Email sent successfully to ${to}. MessageId: ${result.messageId}`);
    return result;
  } catch (error: any) {
    const errorDetails = {
      to,
      subject,
      error: error.message,
      code: error.code,
      command: error.command,
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      environment: process.env.NODE_ENV || 'development',
      stack: error.stack
    };
    
    console.error('[SMTP Error] Failed to send email:', errorDetails);
    
    // Check for common Render/cloud platform issues
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      console.error('[SMTP] ⚠️  Connection issue detected. This is common on cloud platforms like Render.');
      console.error('[SMTP] 💡 Solutions for SMTP on Render:');
      console.error('[SMTP]   1. Upgrade to Render paid plan (allows SMTP ports 25, 465, 587)');
      console.error('[SMTP]   2. Use alternative SMTP port 2525 (set SMTP_ALT_PORT=2525)');
      console.error('[SMTP]   3. Configure your SMTP server to accept connections on port 2525');
      console.error('[SMTP]   4. Use SMTP relay service that supports alternative ports');
      console.error('[SMTP]   5. Use API-based services (SendGrid, Mailgun) as fallback');
      console.error('[SMTP]   6. Verify SMTP server allows connections from Render IP ranges');
    }
    
    // Clear cached transporter on error to force reconnect on retry
    cachedTransporter = null;
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
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#333;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#0066CC;padding:30px;text-align:center;border-radius:10px 10px 0 0;">
        <h1 style="color:#ffffff;margin:0;font-size:28px;">Welcome to SPANA!</h1>
      </div>
      <div style="background:#F5F5F5;padding:30px;border-radius:0 0 10px 10px;">
        <h2 style="color:#000000;margin:0 0 12px">Welcome to SPANA, ${name}!</h2>
        <p>Your account is now set up and ready to use.</p>
        <p>If you didn't create this account, please contact support immediately.</p>
        <p style="margin-top:24px">Thanks,<br/>The SPANA Team</p>
      </div>
    </div>
  `;
  return { subject, text, html };
}

async function sendWelcomeEmail(user: any, options?: { token?: string; uid?: string }) {
  if (USE_EMAIL_SERVICE && emailService.isEmailServiceEnabled()) {
    try {
      return await emailService.sendWelcomeEmailViaService({
        to: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0],
        role: user.role || 'customer',
        token: options?.token,
        uid: options?.uid
      });
    } catch (error: any) {
      console.error('[Mailer] Email service failed, falling back to SMTP:', error.message);
      // Fall back to SMTP if email service fails
    }
  }
  const { subject, text, html } = buildWelcomeEmail({ firstName: user.firstName, lastName: user.lastName });
  return sendMailWithRetry({ to: user.email, subject, text, html });
}

function buildVerificationEmail({ firstName, lastName, verificationLink }: any) {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim() || 'there';
  const subject = 'Verify your provider account';
  const text = `Hi ${name},\n\nPlease verify your provider account by visiting: ${verificationLink}\n\nThanks,\nThe Spana Team`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#333;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#0066CC;padding:30px;text-align:center;border-radius:10px 10px 0 0;">
        <h1 style="color:#ffffff;margin:0;font-size:28px;">Verify Your Provider Account</h1>
      </div>
      <div style="background:#F5F5F5;padding:30px;border-radius:0 0 10px 10px;">
        <h3 style="color:#000000;margin-top:0;">Hi ${name},</h3>
        <p>Please verify your provider account.</p>
        <div style="text-align:center;margin:20px 0;">
          <a href="${verificationLink}" style="background:#0066CC;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Verify account</a>
        </div>
        <p>If the button doesn't work, copy this link:<br/><span style="word-break:break-all;color:#0066CC;">${verificationLink}</span></p>
      </div>
    </div>
  `;
  return { subject, text, html };
}

async function sendVerificationEmail(user: any, verificationLink: string) {
  if (USE_EMAIL_SERVICE && emailService.isEmailServiceEnabled()) {
    try {
      return await emailService.sendVerificationEmailViaService({
        to: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0],
        verificationLink
      });
    } catch (error: any) {
      console.error('[Mailer] Email service failed, falling back to SMTP:', error.message);
      // Fall back to SMTP if email service fails
    }
  }
  const { subject, text, html } = buildVerificationEmail({ firstName: user.firstName, lastName: user.lastName, verificationLink });
  return sendMailWithRetry({ to: user.email, subject, text, html });
}

// New function for email verification (not provider verification)
async function sendEmailVerification({ to, name, link }: any) {
  if (USE_EMAIL_SERVICE && emailService.isEmailServiceEnabled()) {
    try {
      return await emailService.sendVerificationEmailViaService({
        to,
        name: name || to.split('@')[0],
        verificationLink: link
      });
    } catch (error: any) {
      console.error('[Mailer] Email service failed, falling back to SMTP:', error.message);
      // Fall back to SMTP if email service fails
    }
  }
  const subject = 'Verify Your Email - Spana';
  const text = `Hi ${name},\n\nPlease verify your email by clicking this link: ${link}\n\nThis link expires in 24 hours.\n\nThanks,\nThe Spana Team`;
  // Extract HTML from the template below and send with retry
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
      <div style="background: #0066CC; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Verify Your Email</h1>
      </div>
      <div style="background: #F5F5F5; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h2 style="color: #000000; margin-top: 0;">Hello ${name}!</h2>
        <p style="color: #333333; line-height: 1.6; font-size: 16px;">
          Thank you for joining SPANA! To complete your registration and ensure the security of your account, 
          please verify your email address by clicking the button below.
        </p>
        <p style="color: #333333; line-height: 1.6; font-size: 16px;">
          This verification link will expire in 24 hours for your security.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${link}" style="background: #0066CC; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; font-size: 16px;">
            Verify My Email
          </a>
        </div>
        <p style="color: #666666; font-size: 14px; text-align: center; margin-top: 30px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${link}" style="color: #0066CC; word-break: break-all; text-decoration: underline;">${link}</a>
        </p>
        <p style="color: #666666; font-size: 14px; text-align: center; margin-top: 20px;">
          If you didn't create this account, please ignore this email.
        </p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999999; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Spana. All rights reserved.</p>
      </div>
    </div>
  `;
  return sendMailWithRetry({ to, subject, text, html });
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
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
      <div style="background: #0066CC; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Reset Your Password</h1>
      </div>
      <div style="background: #F5F5F5; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h2 style="color: #000000; margin-top: 0;">Hello ${name}!</h2>
        <p style="color: #333333; line-height: 1.6; font-size: 16px;">
          You requested to reset your password. Click the button below to create a new password.
        </p>
        <p style="color: #333333; line-height: 1.6; font-size: 16px;">
          This link will expire in 1 hour for your security.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${link}" style="background: #0066CC; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; font-size: 16px;">
            Reset Password
          </a>
        </div>
        <p style="color: #666666; font-size: 14px; text-align: center; margin-top: 30px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${link}" style="color: #0066CC; word-break: break-all; text-decoration: underline;">${link}</a>
        </p>
        <p style="color: #333333; font-size: 14px; text-align: center; margin-top: 20px;">
          If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
        </p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999999; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Spana. All rights reserved.</p>
      </div>
    </div>
  `;
  return { subject, text, html };
}

async function sendPasswordResetEmail({ to, name, link }: any) {
  const { subject, text, html } = buildPasswordResetEmail({ name, link });
  return sendMailWithRetry({ to, subject, text, html });
}

function buildInvoiceEmail({ name, invoiceNumber, bookingId, serviceTitle, amount, currency, jobSize, basePrice, multiplier, calculatedPrice, tipAmount, date, transactionId }: any) {
  const subject = `Invoice ${invoiceNumber} - Spana Service`;
  const text = `Invoice ${invoiceNumber}\n\nBooking: ${bookingId}\nService: ${serviceTitle}\nAmount: ${amount} ${currency}\nDate: ${date}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
      <div style="background: #0066CC; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Invoice</h1>
        <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 18px;">${invoiceNumber}</p>
      </div>
      <div style="background: #F5F5F5; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-top: 0;">Hello ${name}!</h2>
        <p style="color: #666; line-height: 1.6; font-size: 16px;">
          Thank you for your payment. Please find your invoice details below.
        </p>
        <div style="background: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #0066CC;">
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
              <td style="padding: 8px 0; text-align: right; color: #0066CC;">+${tipAmount.toFixed(2)} ${currency}</td>
            </tr>
            ` : ''}
            <tr style="border-top: 2px solid #0066CC; margin-top: 10px;">
              <td style="padding: 12px 0; color: #000000; font-size: 18px;"><strong>Total Amount:</strong></td>
              <td style="padding: 12px 0; text-align: right; color: #0066CC; font-size: 20px; font-weight: bold;">${amount.toFixed(2)} ${currency}</td>
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
        <p>© ${new Date().getFullYear()} Spana. All rights reserved.</p>
      </div>
    </div>
  `;
  return { subject, text, html };
}

async function sendInvoiceEmail({ to, name, invoiceNumber, bookingId, serviceTitle, amount, currency, jobSize, basePrice, multiplier, calculatedPrice, tipAmount, date, transactionId }: any) {
  const { subject, text, html } = buildInvoiceEmail({ name, invoiceNumber, bookingId, serviceTitle, amount, currency, jobSize, basePrice, multiplier, calculatedPrice, tipAmount, date, transactionId });
  return sendMailWithRetry({ to, subject, text, html });
}

function buildAdminOTPEmail({ name, otp, verificationLink }: any) {
  const subject = 'Your Spana Admin Login OTP 🎉';
  const text = `Hi ${name},\n\nWelcome to SPANA Admin! Your account has been created.\n\nYour 6-digit OTP for admin login is: ${otp}\n\nThis OTP expires in 5 hours.\n\n${verificationLink ? `Or click this link to verify and see your OTP: ${verificationLink}\n\n` : ''}If you didn't request this, please contact support immediately.\n\nThanks,\nThe Spana Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
      <div style="background: #0066CC; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to SPANA Admin!</h1>
      </div>
      <div style="background: #F5F5F5; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h2 style="color: #000000; margin-top: 0;">Hello ${name}!</h2>
        <p style="color: #333333; line-height: 1.6; font-size: 16px;">
          Your admin account has been created! Use the OTP below to complete your login.
        </p>
        <div style="background: #ffffff; border: 2px solid #0066CC; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px;">
          <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">Your 6-digit OTP:</p>
          <p style="color: #0066CC; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${otp}</p>
        </div>
        ${verificationLink ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="display: inline-block; background: #0066CC; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">
            Click here to verify & see your OTP
          </a>
        </div>
        ` : ''}
        <p style="color: #333333; line-height: 1.6; font-size: 16px;">
          This OTP will expire in <strong>5 hours</strong> for your security.
        </p>
        <p style="color: #333333; font-size: 14px; text-align: center; margin-top: 20px;">
          If you didn't request this OTP, please contact support immediately. Your account may be at risk.
        </p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999999; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Spana. All rights reserved.</p>
      </div>
    </div>
  `;
  return { subject, text, html };
}

async function sendAdminOTPEmail({ to, name, otp, verificationLink }: any) {
  if (USE_EMAIL_SERVICE && emailService.isEmailServiceEnabled()) {
    try {
      return await emailService.sendOTPEmailViaService({
        to,
        name: name || to.split('@')[0],
        otp
      });
    } catch (error: any) {
      console.error('[Mailer] Email service failed, falling back to SMTP:', error.message);
      // Fall back to SMTP if email service fails
    }
  }
  const { subject, text, html } = buildAdminOTPEmail({ name, otp, verificationLink });
  return sendMailWithRetry({ to, subject, text, html });
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