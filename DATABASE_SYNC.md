# Database Sync – Fix "Bookings in Different DB" Issue

If bookings created via the app don't appear when you run scripts or use the admin dashboard, **local and production are using different databases**.

## Quick Fix

1. **Get production's DATABASE_URL**
   - Go to [Render Dashboard](https://dashboard.render.com) → your `spana-backend` service
   - Open **Environment**
   - Copy the value of `DATABASE_URL`

2. **Update local `.env`**
   - Open `spana-backend/.env`
   - Set `DATABASE_URL` to the value from Render (paste the full connection string)

3. **Verify**
   ```bash
   cd spana-backend
   npm run verify:db
   ```
   You should see: `✅ DATABASES ARE IN SYNC`

## Why This Happens

| Component        | Uses DATABASE_URL from          |
|-----------------|---------------------------------|
| Production API (Render) | Render Dashboard env vars |
| Local scripts   | `spana-backend/.env`            |
| Local backend   | `spana-backend/.env`            |

If Render uses Supabase and your `.env` uses Render PostgreSQL (or vice versa), they point at different databases. Bookings created through the app go to the production DB; local scripts read from the DB in `.env`.

## Verify Anytime

```bash
npm run verify:db
```

Or with a custom production URL:

```bash
PRODUCTION_URL=https://your-backend.onrender.com npm run verify:db
```
