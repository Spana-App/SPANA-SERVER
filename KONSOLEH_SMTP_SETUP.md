# 📧 KonsoleH Webmail SMTP Setup Guide

Complete guide to configure SMTP email sending using KonsoleH webmail.

## 🔍 Step 1: Find Your KonsoleH SMTP Settings

### Method 1: From KonsoleH Control Panel

1. **Log into KonsoleH Control Panel**
   - Usually at: `https://yourdomain.com:2083` or your hosting provider's URL

2. **Navigate to Email Section**
   - Look for "Email Accounts" or "Email" in the main menu
   - Click on your email account (e.g., `noreply@yourdomain.com`)

3. **Find SMTP Settings**
   - Look for "Email Client Configuration" or "Mail Client Settings"
   - You should see:
     - **SMTP Server**: Usually `mail.yourdomain.com` or `smtp.yourdomain.com`
     - **Port**: `587` (STARTTLS) or `465` (SSL)
     - **Username**: Your full email address (e.g., `noreply@yourdomain.com`)
     - **Password**: Your email account password

### Method 2: Common KonsoleH SMTP Settings

If you can't find the settings, try these common configurations:

**Option A: STARTTLS (Most Common)**
```
SMTP Server: mail.yourdomain.com
Port: 587
Security: STARTTLS
Username: your-email@yourdomain.com
Password: your-email-password
```

**Option B: SSL/TLS**
```
SMTP Server: mail.yourdomain.com
Port: 465
Security: SSL/TLS
Username: your-email@yourdomain.com
Password: your-email-password
```

**Option C: Alternative Host**
```
SMTP Server: smtp.yourdomain.com
Port: 587
Security: STARTTLS
```

## 📝 Step 2: Update Your `.env` File

Open your `.env` file and update the SMTP section with your KonsoleH settings:

```env
# SMTP Configuration for KonsoleH
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your_email_password_here
SMTP_FROM=noreply@yourdomain.com
SMTP_SECURE=false
SMTP_POOL=true
SMTP_MAX_CONNECTIONS=5
SMTP_MAX_MESSAGES=100
SMTP_CONNECTION_TIMEOUT=10000
SMTP_TLS_CIPHERS=TLSv1.2
SMTP_REJECT_UNAUTHORIZED=true

# Mail Provider Configuration
MAIL_PROVIDER=smtp
MAIL_ENABLED=true
```

### 🔄 Replace These Values:

- `mail.yourdomain.com` → Your actual SMTP host from KonsoleH
- `noreply@yourdomain.com` → Your actual KonsoleH email address
- `your_email_password_here` → Your email account password

### 📋 Port Configuration:

**For Port 587 (STARTTLS - Recommended):**
```env
SMTP_PORT=587
SMTP_SECURE=false
```

**For Port 465 (SSL/TLS):**
```env
SMTP_PORT=465
SMTP_SECURE=true
```

## 🧪 Step 3: Test Your Configuration

After updating your `.env` file, test the SMTP connection:

```bash
npx ts-node scripts/testSmtp.ts
```

This will:
- ✅ Verify your SMTP connection
- 📤 Send a test email to yourself
- 🔍 Show detailed error messages if something goes wrong

## 🔧 Step 4: Restart Your Server

After updating `.env`, restart your server:

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

Check the startup diagnostics - you should see:
```
SMTP: connected (smtp)
```

## 🚨 Troubleshooting KonsoleH SMTP

### Issue 1: "Authentication failed" or "535 5.7.3"

**Solutions:**
- ✅ Double-check your email address and password
- ✅ Make sure you're using the **full email address** as username (e.g., `noreply@yourdomain.com`)
- ✅ Verify the email account is active in KonsoleH
- ✅ Try resetting the email password in KonsoleH

### Issue 2: "Connection timeout" or "ECONNREFUSED"

**Solutions:**
- ✅ Verify `SMTP_HOST` is correct (try `mail.yourdomain.com` or `smtp.yourdomain.com`)
- ✅ Try different ports: `587`, `465`, or `25`
- ✅ Check if your firewall is blocking the port
- ✅ Contact KonsoleH support to confirm SMTP is enabled for your account

### Issue 3: "Certificate verification failed"

**Solutions:**
- ✅ For testing, set `SMTP_REJECT_UNAUTHORIZED=false` (not recommended for production)
- ✅ KonsoleH may use self-signed certificates - this is normal
- ✅ Try port 465 with `SMTP_SECURE=true`

### Issue 4: "Connection refused"

**Solutions:**
- ✅ Verify the SMTP host and port are correct
- ✅ Check if KonsoleH requires IP whitelisting
- ✅ Ensure SMTP service is enabled for your hosting account
- ✅ Contact KonsoleH support to verify SMTP access

## 📋 Complete KonsoleH `.env` Example

Here's a complete example of SMTP configuration for KonsoleH:

```env
# Database Configuration
DATABASE_URL="postgresql://spana_users:***@dpg-d3p2ooc9c44c738ksb8g-a.frankfurt-postgres.render.com/spana_db?sslmode=prefer"

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=5003
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# SMTP Configuration for KonsoleH
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your_secure_password_here
SMTP_FROM=noreply@yourdomain.com
SMTP_SECURE=false
SMTP_POOL=true
SMTP_MAX_CONNECTIONS=5
SMTP_MAX_MESSAGES=100
SMTP_CONNECTION_TIMEOUT=10000
SMTP_TLS_CIPHERS=TLSv1.2
SMTP_REJECT_UNAUTHORIZED=true

# Mail Provider Configuration
MAIL_PROVIDER=smtp
MAIL_ENABLED=true
```

## ✅ Verification Checklist

Before testing, make sure:

- [ ] `SMTP_HOST` matches your KonsoleH mail server (usually `mail.yourdomain.com`)
- [ ] `SMTP_USER` is your full email address (e.g., `noreply@yourdomain.com`)
- [ ] `SMTP_PASS` is your email account password
- [ ] `SMTP_FROM` matches your email address
- [ ] `SMTP_PORT` is `587` (or `465` for SSL)
- [ ] `SMTP_SECURE` is `false` for port 587, `true` for port 465
- [ ] `MAIL_PROVIDER=smtp` (not `none`)
- [ ] `MAIL_ENABLED=true`

## 🎯 Quick Test Commands

1. **Test SMTP connection:**
   ```bash
   npx ts-node scripts/testSmtp.ts
   ```

2. **Check server startup:**
   ```bash
   npm run dev
   ```
   Look for: `SMTP: connected (smtp)` in the startup diagnostics

3. **Test email sending:**
   - Register a new user (should receive welcome email)
   - Request password reset (should receive reset email)
   - Complete a payment (should receive invoice email)

## 📞 Need Help?

If you're still having issues:

1. **Check KonsoleH Documentation**: Look for "Email Client Configuration" or "SMTP Settings"
2. **Contact KonsoleH Support**: They can provide your exact SMTP settings
3. **Check Server Logs**: Look for detailed error messages in the console
4. **Test with Email Client**: Try configuring the same email in Outlook/Thunderbird to verify credentials work

## 🔒 Security Notes

- ✅ Never commit your `.env` file to version control
- ✅ Use a dedicated email account for sending (not your personal email)
- ✅ Use strong passwords for your email account
- ✅ Consider using `noreply@yourdomain.com` or `support@yourdomain.com` for system emails

---

**Once configured, your Spana backend will send:**
- ✅ Welcome emails
- ✅ Email verification links
- ✅ Password reset links
- ✅ Payment invoices
- ✅ Booking confirmations
- ✅ System notifications

**Happy emailing! 📧✨**

