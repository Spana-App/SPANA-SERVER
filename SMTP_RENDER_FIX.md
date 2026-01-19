# SMTP Not Working on Render - Solution Guide

## Problem

SMTP works perfectly on localhost but fails on Render. This is a **common issue** with cloud platforms.

## Root Cause

**Render (and most cloud platforms) block outbound SMTP connections** on ports 25, 587, and 465 for security reasons. This prevents direct SMTP connections from your application.

## Solutions

### Option 1: Use SendGrid API (Recommended) ✅

SendGrid provides an API-based email service that works perfectly on Render.

**Steps:**
1. Sign up for SendGrid (free tier: 100 emails/day)
2. Get your API key from SendGrid dashboard
3. Set environment variables on Render:
   ```
   MAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=your_sendgrid_api_key_here
   SENDGRID_SMTP_HOST=smtp.sendgrid.net
   SENDGRID_SMTP_PORT=587
   SENDGRID_SMTP_USER=apikey
   ```

**Note:** The code already supports SendGrid! Just change `MAIL_PROVIDER` to `sendgrid`.

### Option 2: Use Mailgun

1. Sign up for Mailgun (free tier: 5,000 emails/month)
2. Get your API key
3. Update `config/mailer.ts` to add Mailgun support (or use their SMTP with different port)

### Option 3: Use AWS SES

1. Set up AWS SES
2. Use SES SMTP credentials
3. AWS SES uses port 587 but may work if configured correctly

### Option 4: Use a Proxy/Tunnel Service

Use a service like Mailgun or SendGrid that provides SMTP over different ports or protocols.

## Current Status

✅ **Email sending is non-blocking** - Your API will still respond even if email fails
✅ **OTP is embedded in API response** - Users can still get OTP even if email fails
✅ **Error logging enhanced** - You'll see detailed error messages in logs

## Testing

To test if SMTP is blocked on Render, check the logs for:
- `ECONNREFUSED` - Connection refused (port blocked)
- `ETIMEDOUT` - Connection timeout (firewall blocking)
- `ENOTFOUND` - DNS resolution failed

## Recommended Action

**Switch to SendGrid API** - It's the easiest and most reliable solution for cloud platforms.

1. Sign up: https://sendgrid.com
2. Get API key
3. Update Render environment variables:
   ```
   MAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
   ```
4. Restart Render service

The code already supports this - no code changes needed!


