# 🚀 Supabase Setup Guide

This guide will help you set up Supabase as your PostgreSQL database provider for the Spana backend.

## Why Supabase?

- ✅ **No sleeping databases** - Unlike Render's free tier, Supabase databases stay active
- ✅ **Fast connections** - No 30-60 second wake-up delays
- ✅ **Free tier available** - Generous free tier with 500MB database
- ✅ **Built-in features** - Auth, storage, real-time subscriptions (optional)
- ✅ **PostgreSQL compatible** - Works seamlessly with Prisma

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click **"New Project"**
4. Fill in:
   - **Project Name**: `spana-backend` (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is fine for development

5. Wait for the project to be created (takes ~2 minutes)

## Step 2: Get Your Connection String

1. In your Supabase project dashboard, go to **Settings** → **Database**
2. Scroll down to **"Connection string"** section
3. Select **"URI"** tab
4. Copy the connection string - it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with the password you set when creating the project
6. The final URL should look like:
   ```
   postgresql://postgres:your_actual_password@abcdefghijklmnop.supabase.co:5432/postgres
   ```

## Step 3: Update Your .env File

Open your `.env` file and update the `DATABASE_URL`:

```env
# Supabase Connection String
DATABASE_URL="postgresql://postgres:your_actual_password@abcdefghijklmnop.supabase.co:5432/postgres?sslmode=require"
```

**Important**: Make sure to:
- Replace `your_actual_password` with your actual database password
- Replace `abcdefghijklmnop` with your actual project reference
- Keep `?sslmode=require` at the end (SSL is required for Supabase)

## Step 4: Run Database Migrations

After updating your `.env` file, run Prisma migrations:

```bash
# Generate Prisma client
npm run db:generate

# Push schema to Supabase database
npm run db:push

# Or create a migration
npm run db:migrate
```

## Step 5: Verify Connection

Start your server:

```bash
npm run dev
```

You should see:
```
🔍 Database Configuration:
  DATABASE_URL: ✅ Set
  Provider: Supabase
  Hostname: [your-project].supabase.co
  Database: postgres
  User: postgres
  SSL: ✅ Required
✅ PostgreSQL connection established
```

## Step 6: (Optional) Enable PostGIS Extension

If you need geospatial features, enable PostGIS in Supabase:

1. Go to **SQL Editor** in your Supabase dashboard
2. Run this SQL:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. Click **Run**

## Connection Pooling (Optional)

Supabase provides connection pooling for better performance. The database configuration automatically detects Supabase and enables pooling. If you want to use the direct connection (bypassing pooler), you can use:

```
postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
```

For connection pooling (recommended for serverless/server apps):
```
postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:6543/postgres?sslmode=require&pgbouncer=true
```

Note: Port `6543` is for connection pooling, port `5432` is direct connection.

## Troubleshooting

### Connection Timeout
- Make sure you're using the correct password
- Verify the project reference in the URL matches your project
- Check that `sslmode=require` is in the connection string

### SSL Error
- Ensure `?sslmode=require` is at the end of your DATABASE_URL
- The database configuration auto-adds this for Supabase URLs

### Migration Errors
- Make sure you've run `npm run db:generate` first
- Check that your Prisma schema is valid
- Verify you have the correct permissions in Supabase

## Free Tier Limits

Supabase free tier includes:
- **500 MB database storage**
- **2 GB bandwidth**
- **50,000 monthly active users** (if using Supabase Auth)
- **Unlimited API requests**

For production apps, consider upgrading to a paid plan.

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase PostgreSQL Guide](https://supabase.com/docs/guides/database)
- [Prisma + Supabase Guide](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-supabase)

## Migration from Render

If you're migrating from Render PostgreSQL:

1. Export your data from Render (if needed)
2. Set up Supabase as above
3. Update your `.env` file with the new `DATABASE_URL`
4. Run migrations: `npm run db:push`
5. Import your data (if you exported it)

The database schema is compatible, so your Prisma models will work the same way!
