# 🔧 Office365/Outlook SMTP Authentication Fix

## Problem
You're getting this error:
```
535 5.7.3 Authentication unsuccessful
```

This happens because **Microsoft has disabled basic authentication** for Office365/Outlook accounts by default.

## ✅ Solutions

### Option 1: Use App-Specific Password (Recommended for Personal Accounts)

If you have 2FA enabled on your Microsoft account:

1. **Go to Microsoft Account Security**: https://account.microsoft.com/security
2. **Sign in** with your Microsoft account
3. **Navigate to**: Security → Advanced security options → App passwords
4. **Create a new app password**:
   - Click "Create a new app password"
   - Name it "Spana Backend" or similar
   - Copy the generated password (16 characters, no spaces)
5. **Update your `.env` file**:
   ```env
   SMTP_HOST=smtp.office365.com
   SMTP_PORT=587
   SMTP_USER=your-email@outlook.com  # or @hotmail.com, @live.com
   SMTP_PASS=xxxx-xxxx-xxxx-xxxx     # Use the app password here, NOT your regular password
   SMTP_FROM=your-email@outlook.com
   SMTP_SECURE=false
   MAIL_PROVIDER=smtp
   MAIL_ENABLED=true
   ```

### Option 2: Enable Basic Authentication (For Business/Admin Accounts)

**⚠️ Warning**: This requires admin access and is not recommended for security reasons.

1. **Go to Microsoft 365 Admin Center**: https://admin.microsoft.com
2. **Navigate to**: Settings → Org settings → Modern authentication
3. **Enable basic authentication** (temporary workaround)
4. **Or use Exchange Online PowerShell**:
   ```powershell
   Set-OrganizationConfig -OAuth2ClientProfileEnabled $false
   ```

### Option 3: Use Alternative Email Provider (Recommended)

#### A. Gmail with App Password
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password  # Generate from Google Account → Security → App passwords
SMTP_FROM=your-email@gmail.com
SMTP_SECURE=false
MAIL_PROVIDER=smtp
MAIL_ENABLED=true
```

#### B. SendGrid (Recommended for Production)
```env
MAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_SMTP_HOST=smtp.sendgrid.net
SENDGRID_SMTP_PORT=587
SENDGRID_SMTP_USER=apikey
SMTP_FROM=noreply@yourdomain.com
MAIL_ENABLED=true
```

#### C. Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.mailgun.org
SMTP_PASS=your-mailgun-smtp-password
SMTP_FROM=noreply@yourdomain.com
SMTP_SECURE=false
MAIL_PROVIDER=smtp
MAIL_ENABLED=true
```

#### D. Your Hosting Provider's SMTP
If you have a custom domain with email hosting (like KonsoleH, cPanel, etc.):
```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-email-password
SMTP_FROM=noreply@yourdomain.com
SMTP_SECURE=false
MAIL_PROVIDER=smtp
MAIL_ENABLED=true
```

## 🧪 Test Your Configuration

After updating your `.env` file, test the SMTP connection:

```bash
npx ts-node scripts/testSmtp.ts
```

Or restart your server and check the startup diagnostics.

## 📋 Quick Checklist

- [ ] Using app-specific password (not regular password) for Office365
- [ ] `SMTP_USER` is your full email address
- [ ] `SMTP_PASS` is correct (app password if 2FA enabled)
- [ ] `SMTP_HOST` is correct (`smtp.office365.com` for Outlook)
- [ ] `SMTP_PORT` is `587` (or `465` for SSL)
- [ ] `SMTP_SECURE=false` for port 587, `true` for port 465
- [ ] `MAIL_PROVIDER=smtp` (not `none`)
- [ ] `MAIL_ENABLED=true`

## 🔒 Security Best Practices

1. **Never commit `.env` file** to version control
2. **Use app-specific passwords** instead of your main password
3. **Rotate passwords regularly**
4. **Use dedicated email accounts** for sending (not personal accounts)
5. **Consider using email service providers** (SendGrid, Mailgun) for production

## 🆘 Still Having Issues?

1. **Check firewall**: Ensure port 587 or 465 is not blocked
2. **Verify credentials**: Double-check email and password
3. **Check account status**: Ensure email account is active and not locked
4. **Try different port**: Switch between 587 (STARTTLS) and 465 (SSL)
5. **Check logs**: Look for more detailed error messages in server logs

## 📧 Current Status

Your server is running, but SMTP authentication is failing. The app will continue to work, but emails won't be sent until SMTP is properly configured.

