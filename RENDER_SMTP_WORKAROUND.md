# Render SMTP Workaround (Without SendGrid)

## The Problem
Render's free tier **blocks SMTP ports 25, 587, and 465**. This is why nodemailer works locally but fails on Render.

## Solutions (Without SendGrid)

### Option 1: Use Alternative Port (If Your SMTP Supports It) ✅

Some SMTP servers support alternative ports that Render doesn't block:

1. **Add to Render Environment Variables:**
```env
SMTP_HOST=mail.spana.co.za
SMTP_PORT=587
SMTP_ALT_PORT=2525  # Try this alternative port
SMTP_USER=noreply@spana.co.za
SMTP_PASS=your_password
SMTP_FROM=noreply@spana.co.za
SMTP_SECURE=false
MAIL_PROVIDER=smtp
MAIL_ENABLED=true
```

2. **Check if your SMTP provider supports port 2525:**
   - KonsoleH: Usually supports 2525
   - cPanel: May support 2525
   - Office365: Usually only 587/465

### Option 2: Use Mailgun SMTP (Free Tier: 5,000 emails/month)

Mailgun provides SMTP that works on Render:

1. **Sign up:** https://www.mailgun.com/
2. **Get SMTP credentials** from Mailgun dashboard
3. **Add to Render:**
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.mailgun.org
SMTP_PASS=your_mailgun_smtp_password
SMTP_FROM=noreply@spana.co.za
SMTP_SECURE=false
MAIL_PROVIDER=smtp
MAIL_ENABLED=true
```

### Option 3: Use AWS SES SMTP (Pay-as-you-go)

AWS SES works well on Render:

1. **Set up AWS SES** (verify domain)
2. **Get SMTP credentials** from AWS SES console
3. **Add to Render:**
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com  # Your SES region
SMTP_PORT=587
SMTP_USER=your_ses_smtp_username
SMTP_PASS=your_ses_smtp_password
SMTP_FROM=noreply@spana.co.za
SMTP_SECURE=false
MAIL_PROVIDER=smtp
MAIL_ENABLED=true
```

### Option 4: Upgrade Render Plan (Paid Tier)

Render's paid plans allow SMTP ports:
- **Starter Plan:** $7/month - Allows SMTP ports
- **Standard Plan:** $25/month - Full SMTP support

### Option 5: Use SMTP Relay Service

Services like:
- **Postmark** (free tier: 100 emails/month)
- **SparkPost** (free tier: 500 emails/month)
- **Mailjet** (free tier: 6,000 emails/month)

---

## Quick Test: Try Port 2525

**Easiest solution to try first:**

1. Go to Render Dashboard → Environment
2. Add/Update:
```env
SMTP_ALT_PORT=2525
```
3. Keep your existing SMTP settings
4. Save and redeploy

If your SMTP server supports 2525, this will work immediately!

---

## Testing

After configuring, test with:
```bash
curl -X POST https://spana-server-5bhu.onrender.com/email-verification/send-verification \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Check Render logs for SMTP connection status.

---

## Why This Happens

Render blocks SMTP ports to prevent spam. This is common on free tiers of cloud platforms. The workarounds above use:
- Alternative ports (2525, 8025)
- SMTP services that work around blocks
- Paid plans that allow SMTP

---

## Recommended: Mailgun

**Best free option:** Mailgun gives you 5,000 emails/month free and works perfectly on Render. It's just SMTP - same nodemailer code, different credentials.
