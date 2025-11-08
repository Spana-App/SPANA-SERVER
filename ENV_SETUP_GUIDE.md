# 📝 Environment Variables Setup Guide

## Quick Start

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Update the required values:**
   - `JWT_SECRET` - Generate a secure random string
   - `SMTP_*` - Your KonsoleH email settings
   - `CLIENT_URL` - Your frontend URL

## Required Variables

### ✅ Must Have

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | Secret key for JWT tokens | `your_super_secret_key_here` |
| `PORT` | Server port | `5003` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `CLIENT_URL` | Frontend URL | `http://localhost:3000` |

### 📧 Email (Required for Registration)

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | `mail.yourdomain.com` |
| `SMTP_PORT` | SMTP port | `587` (STARTTLS) or `465` (SSL) |
| `SMTP_USER` | Email username | `noreply@yourdomain.com` |
| `SMTP_PASS` | Email password | `your_password` |
| `SMTP_FROM` | From email address | `noreply@yourdomain.com` |
| `MAIL_ENABLED` | Enable email sending | `true` |

### 🔧 Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `USE_REDIS` | Enable Redis caching | `false` |
| `MONGODB_URI` | MongoDB backup URI | Not set |
| `EXTERNAL_API_URL` | External API endpoint | Not set |

## Generate JWT Secret

Run this command to generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it as your `JWT_SECRET` value.

## Database URLs

### For Local Development (External)
```
postgresql://spana_users:U2kOB5yHZDB5vI9tuEfPqLB2t52Ai3SH@dpg-d3p2ooc9c44c738ksb8g-a.frankfurt-postgres.render.com/spana_db?sslmode=require
```

### For Render Production (Internal)
```
postgresql://spana_users:U2kOB5yHZDB5vI9tuEfPqLB2t52Ai3SH@dpg-d3p2ooc9c44c738ksb8g-a/spana_db
```

## SMTP Configuration

### KonsoleH Settings
- **Host:** Usually `mail.yourdomain.com`
- **Port:** `587` (STARTTLS) or `465` (SSL)
- **Username:** Full email address (e.g., `noreply@yourdomain.com`)
- **Password:** Your email account password
- **Secure:** `false` for port 587, `true` for port 465

See `KONSOLEH_SMTP_SETUP.md` for detailed SMTP setup instructions.

## Testing Your Configuration

1. **Test database connection:**
   ```bash
   npm run dev
   ```
   Look for: `✅ PostgreSQL connected successfully`

2. **Test SMTP:**
   ```bash
   npx ts-node scripts/testSmtp.ts
   ```

3. **Test registration:**
   - Register a new user
   - Check if welcome email is sent

## Security Notes

⚠️ **Never commit `.env` to git!**
- `.env` is already in `.gitignore`
- Use `.env.example` as a template
- Generate unique `JWT_SECRET` for each environment
- Use strong passwords for database and email

## Production Checklist

- [ ] `JWT_SECRET` is a strong random string
- [ ] `NODE_ENV=production`
- [ ] `CLIENT_URL` points to production frontend
- [ ] `DATABASE_URL` uses internal URL (for Render)
- [ ] `POSTGRES_SSL=false` (for internal connections)
- [ ] SMTP credentials are correct
- [ ] All sensitive values are set in Render dashboard

