# Using SMTP on Render - Complete Guide

## Problem

Render's **free tier blocks outbound SMTP connections** on ports 25, 465, and 587 for security reasons.

## Solutions to Use SMTP on Render

### Option 1: Upgrade to Paid Plan ✅ (Recommended)

**Render paid plans allow SMTP connections on all ports.**

- **Starter Plan**: $7/month - Allows SMTP ports
- **Standard Plan**: $25/month - Better performance + SMTP
- **Pro Plan**: $85/month - Best performance + SMTP

**Steps:**
1. Go to Render Dashboard
2. Select your service
3. Click "Upgrade" 
4. Choose any paid plan
5. SMTP will work immediately on ports 25, 465, 587

**This is the simplest solution - no code changes needed!**

---

### Option 2: Use Alternative SMTP Port (2525) 🔧

Some SMTP servers support alternative ports that Render doesn't block.

**Steps:**

1. **Check if your SMTP server supports port 2525:**
   - Contact your email provider (KonsoleH, cPanel, etc.)
   - Ask if they support SMTP on port 2525
   - Many providers do support this port

2. **Configure your SMTP server to accept port 2525:**
   - This may require server configuration changes
   - Some providers enable it by default

3. **Set Render environment variables:**
   ```
   SMTP_HOST=mail.spana.co.za
   SMTP_PORT=2525
   SMTP_USER=no-reply@spana.co.za
   SMTP_PASS=your_password
   SMTP_ALT_PORT=2525
   ```

4. **The code will automatically use port 2525 on Render**

**Note:** Not all SMTP servers support port 2525. Check with your provider first.

---

### Option 3: Use SMTP Relay Service

Use a service that provides SMTP on non-blocked ports:

**SMTP2GO** (Free tier: 1000 emails/month)
- Supports port 2525
- Works on Render free tier
- Sign up: https://www.smtp2go.com

**Configuration:**
```
SMTP_HOST=mail.smtp2go.com
SMTP_PORT=2525
SMTP_USER=your_smtp2go_username
SMTP_PASS=your_smtp2go_password
```

**Mailgun** (Free tier: 5000 emails/month)
- Supports SMTP on port 587 (requires paid Render) or API
- Sign up: https://www.mailgun.com

---

### Option 4: Use Your Own SMTP Server with Port Forwarding

If you have your own server:

1. Set up SMTP on a non-standard port (e.g., 2525)
2. Configure firewall to allow Render IP ranges
3. Use that port in Render environment variables

---

## Current Code Support

The code now automatically:
- ✅ Detects Render environment
- ✅ Tries alternative port 2525 if standard ports are blocked
- ✅ Provides helpful error messages
- ✅ Logs connection attempts for debugging

## Testing SMTP on Render

1. **Check Render logs** for SMTP connection attempts
2. **Look for error codes:**
   - `ECONNREFUSED` - Port blocked or server not accepting
   - `ETIMEDOUT` - Connection timeout (likely blocked)
   - `ENOTFOUND` - DNS resolution failed

3. **Test with different ports:**
   ```
   SMTP_PORT=2525  # Try alternative port
   SMTP_PORT=8025  # Some servers use this
   SMTP_PORT=587   # Standard (requires paid plan)
   ```

## Recommended Action

**For production use:** Upgrade to Render paid plan ($7/month minimum)
- Most reliable
- No code changes needed
- Standard SMTP ports work
- Better performance

**For testing/development:** Try port 2525 if your SMTP server supports it

## Environment Variables for Render

```bash
# Standard SMTP (requires paid plan)
SMTP_HOST=mail.spana.co.za
SMTP_PORT=587
SMTP_USER=no-reply@spana.co.za
SMTP_PASS=your_password

# OR Alternative port (free tier)
SMTP_HOST=mail.spana.co.za
SMTP_PORT=2525
SMTP_ALT_PORT=2525
SMTP_USER=no-reply@spana.co.za
SMTP_PASS=your_password
```

## Next Steps

1. **Check if your SMTP server (mail.spana.co.za) supports port 2525**
2. **If yes:** Set `SMTP_PORT=2525` in Render environment variables
3. **If no:** Upgrade to Render paid plan or use SMTP relay service
4. **Test:** Send a test email and check logs

---

**Note:** The code will automatically try alternative ports on Render, but your SMTP server must support those ports for it to work.

