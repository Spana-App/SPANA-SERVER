# Render SMTP Setup Guide

## Issue
SMTP is showing as "disconnected" on production server, causing email sending to fail.

## Solution
Configure SMTP environment variables in Render dashboard.

---

## Step 1: Access Render Dashboard

1. Go to https://dashboard.render.com
2. Select your service: `spana-server-5bhu`
3. Click on **Environment** tab

---

## Step 2: Add SMTP Environment Variables

Add the following environment variables in Render:

### Required SMTP Variables:

```env
SMTP_HOST=mail.spana.co.za
SMTP_PORT=587
SMTP_USER=noreply@spana.co.za
SMTP_PASS=your_email_password_here
SMTP_FROM=noreply@spana.co.za
SMTP_SECURE=false
SMTP_POOL=true
SMTP_MAX_CONNECTIONS=5
SMTP_MAX_MESSAGES=100
SMTP_CONNECTION_TIMEOUT=10000
SMTP_TLS_CIPHERS=TLSv1.2
SMTP_REJECT_UNAUTHORIZED=true
MAIL_PROVIDER=smtp
MAIL_ENABLED=true
```

### KonsoleH SMTP Settings (if using KonsoleH):

```env
SMTP_HOST=mail.spana.co.za
SMTP_PORT=587
SMTP_USER=noreply@spana.co.za
SMTP_PASS=your_konsoleh_password
SMTP_FROM=noreply@spana.co.za
SMTP_SECURE=false
```

### Office 365 SMTP Settings (alternative):

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your_password
SMTP_FROM=your-email@yourdomain.com
SMTP_SECURE=false
SMTP_TLS_CIPHERS=TLSv1.2
```

---

## Step 3: Verify Configuration

After adding the environment variables:

1. **Save** the environment variables in Render
2. **Redeploy** the service (Render will auto-redeploy)
3. Check the **Logs** tab for SMTP connection status
4. Test email endpoints:
   - `POST /email-verification/send-verification`
   - `POST /password-reset/request`

---

## Step 4: Test Email Functionality

Use the test script:
```bash
npx ts-node scripts/testProductionEmail.ts
```

Or test via API:
```bash
# Email verification
curl -X POST https://spana-server-5bhu.onrender.com/email-verification/send-verification \
  -H "Authorization: Bearer YOUR_TOKEN"

# Password reset
curl -X POST https://spana-server-5bhu.onrender.com/password-reset/request \
  -d '{"email":"test@example.com"}'
```

---

## Troubleshooting

### SMTP Still Disconnected

1. **Check SMTP credentials:**
   - Verify username and password are correct
   - Ensure no extra spaces in environment variables
   - Check if password has special characters (may need URL encoding)

2. **Check SMTP server:**
   - Test SMTP connection from local machine
   - Verify firewall/security settings allow connections from Render IPs
   - Check if SMTP server requires IP whitelisting

3. **Check Render logs:**
   - Go to Render dashboard → Logs
   - Look for SMTP connection errors
   - Check for authentication failures

4. **Common Issues:**
   - **Port 587 blocked:** Try port 465 with `SMTP_SECURE=true`
   - **Authentication failed:** Double-check username/password
   - **Connection timeout:** Increase `SMTP_CONNECTION_TIMEOUT`
   - **TLS errors:** Try different `SMTP_TLS_CIPHERS` or set `SMTP_SECURE=false`

---

## Current Status

**Production Server:** https://spana-server-5bhu.onrender.com
**SMTP Status:** ❌ Disconnected
**Action Required:** Add SMTP environment variables in Render dashboard

---

## Quick Setup Checklist

- [ ] Access Render dashboard
- [ ] Navigate to Environment tab
- [ ] Add all SMTP environment variables
- [ ] Save changes (triggers auto-redeploy)
- [ ] Wait for deployment to complete
- [ ] Check logs for SMTP connection status
- [ ] Test email endpoints
- [ ] Verify emails are received

---

## Support

If issues persist:
1. Check Render logs for detailed error messages
2. Verify SMTP server is accessible from Render's IP ranges
3. Test SMTP connection using a mail client (e.g., Thunderbird, Outlook)
4. Contact SMTP provider support if authentication fails
