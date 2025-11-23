# 🔧 Neon Database Connection Fix

## Issue
If you're seeing connection errors like:
```
Can't reach database server at `dpg-xxx:5432`
```

This usually means your Neon database connection string has an **incomplete hostname**.

## Solution

### 1. Get the Complete Connection String from Neon Dashboard

1. Go to your [Neon Dashboard](https://console.neon.tech)
2. Select your project
3. Go to **Connection Details**
4. Copy the **Connection string** (not the pooler connection string unless you're using connection pooling)

The connection string should look like:
```
postgresql://user:password@dpg-xxx-xxxxx.neon.tech/dbname?sslmode=require
```

**Important:** Notice the full hostname includes `.neon.tech` or similar domain.

### 2. Update Your DATABASE_URL

Update your `.env` file or environment variable:

```env
DATABASE_URL="postgresql://spana_db_i2x0_user:YOUR_PASSWORD@dpg-d4h2bier433s73asevpg-a.xxxxx.neon.tech/spana_db_i2x0?sslmode=require"
```

Replace:
- `YOUR_PASSWORD` with your actual password
- `xxxxx.neon.tech` with the actual domain from your Neon dashboard

### 3. Common Issues

#### Database is Paused
Neon databases pause after inactivity. To wake it up:
1. Go to Neon Dashboard
2. Click on your database
3. It should automatically wake up when you access it
4. Or make a connection attempt - it will wake up automatically

#### SSL Required
Neon databases **always require SSL**. The connection string should include `?sslmode=require`.

#### Incomplete Hostname
❌ **Wrong:** `postgresql://user:pass@dpg-xxx/dbname`
✅ **Correct:** `postgresql://user:pass@dpg-xxx.xxxxx.neon.tech/dbname?sslmode=require`

### 4. Test the Connection

You can test your connection using `psql`:
```bash
psql "postgresql://user:password@dpg-xxx.xxxxx.neon.tech/dbname?sslmode=require"
```

Or test with Prisma:
```bash
npx prisma db pull
```

### 5. Verify Configuration

After updating your DATABASE_URL, restart your server. You should see:
```
🔍 Database Configuration:
  DATABASE_URL: ✅ Set
  Provider: Neon
  Hostname: dpg-xxx.xxxxx.neon.tech
  SSL: ✅ Required
```

## Auto-Detection

The updated `lib/database.ts` now:
- ✅ Auto-detects Neon databases
- ✅ Automatically enables SSL for Neon databases
- ✅ Warns if hostname appears incomplete
- ✅ Adds `sslmode=require` if missing from URL

## Still Having Issues?

1. **Check your Neon dashboard** - Ensure the database is active (not paused)
2. **Verify the connection string** - Copy it directly from Neon dashboard
3. **Check network/firewall** - Ensure your IP is allowed (if IP restrictions are enabled)
4. **Verify credentials** - Double-check username and password

