# Environment Variables Cleanup Summary

## ✅ Variables KEPT (Actually Used in Codebase)

### Required Variables
- `NODE_ENV` - Used in server.ts, config/mailer.ts
- `PORT` - Used in server.ts
- `DATABASE_URL` - Used in lib/database.ts (Supabase connection)
- `JWT_SECRET` - Used in server.ts, middleware/auth.ts
- `JWT_EXPIRES_IN` - Used in auth middleware
- `SMTP_HOST` - Used in config/mailer.ts
- `SMTP_PORT` - Used in config/mailer.ts
- `SMTP_USER` - Used in config/mailer.ts
- `SMTP_PASS` - Used in config/mailer.ts
- `SMTP_FROM` - Used in config/mailer.ts
- `SMTP_SECURE` - Used in config/mailer.ts
- `SMTP_POOL` - Used in config/mailer.ts
- `SMTP_MAX_CONNECTIONS` - Used in config/mailer.ts
- `SMTP_MAX_MESSAGES` - Used in config/mailer.ts
- `SMTP_CONNECTION_TIMEOUT` - Used in config/mailer.ts
- `SMTP_TLS_CIPHERS` - Used in config/mailer.ts
- `SMTP_REJECT_UNAUTHORIZED` - Used in config/mailer.ts
- `MAIL_PROVIDER` - Used in config/mailer.ts
- `MAIL_ENABLED` - Used in config/mailer.ts
- `PAYFAST_MERCHANT_ID` - Used in controllers/paymentController.ts
- `PAYFAST_MERCHANT_KEY` - Used in controllers/paymentController.ts
- `PAYFAST_PASSPHRASE` - Used in controllers/paymentController.ts
- `PAYFAST_URL` - Used in controllers/paymentController.ts

### Optional Variables
- `USE_REDIS` - Used in server.ts (optional, defaults to false)
- `REDIS_HOST` - Used in server.ts (optional)
- `REDIS_PORT` - Used in server.ts (optional)
- `REDIS_PASSWORD` - Used in server.ts (optional)
- `MONGODB_URI` - Used in lib/mongoSync.ts (optional backup)

## ❌ Variables REMOVED (Not Used in Codebase)

### Database Variables (Not Needed - Using DATABASE_URL)
- `POSTGRES_HOST` - Only used if DATABASE_URL is not set
- `POSTGRES_PORT` - Only used if DATABASE_URL is not set
- `POSTGRES_USER` - Only used if DATABASE_URL is not set
- `POSTGRES_PASSWORD` - Only used if DATABASE_URL is not set
- `POSTGRES_DB` - Only used if DATABASE_URL is not set
- `POSTGRES_SSL` - Only used if DATABASE_URL is not set

### Payment Variables (Not Used - Using PayFast, not Stripe)
- `STRIPE_SECRET_KEY` - Not found in codebase
- `STRIPE_WEBHOOK_SECRET` - Not found in codebase

### Other Unused Variables
- `CLIENT_URL` - Not used (CORS is set to "*" in server.ts)
- `GOOGLE_MAPS_API_KEY` - Not found in codebase
- `APP_VERSION` - Not found in codebase

## 📝 Clean .env File

A clean `.env.production` file has been created with only the variables that are actually used. 

**To use it:**
1. Backup your current `.env` file
2. Copy `.env.production` to `.env`
3. Update the values with your actual production credentials
4. Remove all commented/unused lines

## 🔒 Security Notes

- Never commit `.env` to git (already in .gitignore)
- Use strong, unique passwords for production
- Generate a secure JWT_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Keep your PayFast credentials secure
- Use environment-specific values (development vs production)
