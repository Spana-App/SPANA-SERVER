# 📧 SMTP Setup Guide for KonsoleH Custom Domain

This guide will help you configure SMTP email sending using your custom domain hosted on KonsoleH.

## 🔧 Step 1: Get Your SMTP Settings from KonsoleH

1. **Log into your KonsoleH control panel**
2. **Navigate to Email Settings** (usually under "Email" or "Mail" section)
3. **Find SMTP Configuration** and note down:
   - SMTP Server/Host
   - Port (usually 587 for STARTTLS or 465 for SSL)
   - Username (your full email address)
   - Password (your email password)

## 📝 Step 2: Create .env File

Create a `.env` file in your project root with the following configuration:

```env
# Database Configuration
DATABASE_URL="postgresql://postgres:EksIsHands0me@localhost:5432/spana_db"
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=EksIsHands0me
POSTGRES_DB=spana_db
POSTGRES_SSL=false

# MongoDB (Backup/Sync)
MONGODB_URI=mongodb://localhost:27017/spana_backup

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_change_this_in_production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=5003
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Redis Configuration (Optional)
USE_REDIS=false
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# SMTP Configuration for KonsoleH Custom Domain
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

# External API (Optional)
EXTERNAL_API_URL=

# App Version
APP_VERSION=1.0.0
```

## 🔄 Step 3: Replace Placeholder Values

Replace the following values with your actual KonsoleH settings:

- `mail.yourdomain.com` → Your actual SMTP host from KonsoleH
- `noreply@yourdomain.com` → Your actual email address
- `your_email_password_here` → Your actual email password
- `your_super_secret_jwt_key_here_change_this_in_production` → A secure random string

## 🧪 Step 4: Test Your SMTP Configuration

Run the SMTP test script to verify your configuration:

```bash
npx ts-node scripts/testSmtp.ts
```

This will:
- ✅ Verify your SMTP connection
- 📤 Send a test email to yourself
- 🔍 Show detailed error messages if something goes wrong

## 🔧 Common KonsoleH SMTP Settings

Here are typical SMTP settings for KonsoleH hosting:

### Option 1: STARTTLS (Recommended)
```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
```

### Option 2: SSL/TLS
```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=465
SMTP_SECURE=true
```

### Option 3: Alternative Ports
```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=25
SMTP_SECURE=false
```

## 🚨 Troubleshooting

### Common Issues and Solutions:

1. **"Authentication failed"**
   - Double-check your email and password
   - Ensure you're using the full email address as username
   - Check if your email account is active

2. **"Connection timeout"**
   - Verify the SMTP host is correct
   - Try different ports (587, 465, 25)
   - Check if your hosting provider blocks certain ports

3. **"Certificate verification failed"**
   - Set `SMTP_REJECT_UNAUTHORIZED=false` for testing
   - Check if your hosting provider uses self-signed certificates

4. **"Connection refused"**
   - Verify the SMTP host and port
   - Check if your hosting provider requires specific IP whitelisting
   - Ensure SMTP service is enabled for your account

## 📧 Email Types in Spana

Once configured, your SMTP will be used for:

- ✅ **Welcome emails** - When users register
- ✅ **Verification emails** - For service provider verification
- ✅ **Payment receipts** - After successful payments
- ✅ **Booking confirmations** - When bookings are created
- ✅ **Password reset** - When users request password reset
- ✅ **Notifications** - Various system notifications

## 🔒 Security Best Practices

1. **Never commit your `.env` file to version control**
2. **Use strong, unique passwords for your email account**
3. **Consider using an app-specific password if available**
4. **Regularly rotate your JWT secret in production**
5. **Monitor your email sending limits and usage**

## 🎯 Next Steps

After setting up SMTP:

1. Test the configuration with the test script
2. Register a new user to test welcome emails
3. Create a service provider account to test verification emails
4. Make a test payment to verify receipt emails
5. Monitor the server logs for any email-related errors

## 📞 Support

If you're still having issues:

1. Check your KonsoleH documentation for specific SMTP settings
2. Contact KonsoleH support for SMTP configuration help
3. Review the server logs for detailed error messages
4. Test with a different email client to verify your credentials work

---

**Happy emailing! 📧✨**
