# Complete SMTP Setup for Render

## Current Status
✅ You've added: `SMTP_ALT_PORT=2525`  
❌ Still need: Full SMTP credentials

## Required Environment Variables in Render

Go to **Render Dashboard → Your Service → Environment** and add ALL of these:

```env
# SMTP Configuration
SMTP_HOST=mail.spana.co.za
SMTP_PORT=587
SMTP_ALT_PORT=2525
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

# Enable Email
MAIL_PROVIDER=smtp
MAIL_ENABLED=true
```

## Step-by-Step

1. **Copy your SMTP settings from local `.env`** (the ones that work locally)
2. **Paste them into Render Environment variables**
3. **Add `SMTP_ALT_PORT=2525`** (you already did this ✅)
4. **Save** - Render will auto-redeploy
5. **Wait 2-3 minutes** for deployment
6. **Test** with admin OTP endpoint

## Testing After Setup

```bash
# Test admin OTP (will send email)
curl -X POST https://spana-server-5bhu.onrender.com/admin/otp/request \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"xoli@spana.co.za"}'
```

## What to Copy from Local .env

Look for these in your local `.env` file:
- `SMTP_HOST=mail.spana.co.za` (or your SMTP server)
- `SMTP_USER=noreply@spana.co.za` (your email)
- `SMTP_PASS=...` (your password)
- `SMTP_FROM=noreply@spana.co.za`

Copy these exact values to Render.

## After Adding Credentials

1. Server will redeploy automatically
2. Check logs for: `[SMTP] Render detected - using alternative port 2525`
3. Check health endpoint: `/health/detailed` should show `smtp: connected`
4. Test email sending

## Troubleshooting

**Still disconnected?**
- Double-check password (no extra spaces)
- Verify SMTP server supports port 2525
- Check Render logs for connection errors
- Try port 8025 if 2525 doesn't work

**Connection timeout?**
- Increase `SMTP_CONNECTION_TIMEOUT=30000`
- Check if SMTP server allows connections from Render IPs
