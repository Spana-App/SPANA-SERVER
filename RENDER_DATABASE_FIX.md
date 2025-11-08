# 🔧 Render PostgreSQL Connection String Guide

## Two Types of Connection Strings

Render provides **two** connection strings for your database:

### 1. **Internal Database URL** (For Render Services)
**Use this when your backend is deployed on Render:**
```
postgresql://spana_users:U2kOB5yHZDB5vI9tuEfPqLB2t52Ai3SH@dpg-d3p2ooc9c44c738ksb8g-a/spana_db
```
- ✅ Faster (internal network)
- ✅ No SSL needed
- ✅ Shorter hostname
- ❌ Only works from within Render

### 2. **External Database URL** (For Local Development)
**Use this when developing locally:**
```
postgresql://spana_users:U2kOB5yHZDB5vI9tuEfPqLB2t52Ai3SH@dpg-d3p2ooc9c44c738ksb8g-a.frankfurt-postgres.render.com/spana_db?sslmode=require
```
- ✅ Works from anywhere
- ✅ Requires SSL (`?sslmode=require`)
- ✅ Full hostname with `.frankfurt-postgres.render.com`

## What Was Fixed

1. **render.yaml** - Updated to use **Internal URL** for Render deployments:
   - Internal URL: `postgresql://spana_users:U2kOB5yHZDB5vI9tuEfPqLB2t52Ai3SH@dpg-d3p2ooc9c44c738ksb8g-a/spana_db`
   - `POSTGRES_SSL=false` (not needed for internal connections)

2. **lib/database.ts** - Auto-detects internal vs external URLs and configures SSL accordingly

## How to Use

### For Render Production (render.yaml)
Uses **Internal URL** - already configured** ✅

### For Local Development (.env or start scripts)
Use **External URL** with SSL:
```env
DATABASE_URL="postgresql://spana_users:U2kOB5yHZDB5vI9tuEfPqLB2t52Ai3SH@dpg-d3p2ooc9c44c738ksb8g-a.frankfurt-postgres.render.com/spana_db?sslmode=require"
POSTGRES_SSL=true
```

### In Render Dashboard (Manual Setup)
1. Go to your Render service dashboard
2. Navigate to **Environment** tab
3. For **Render services**: Use Internal URL (no SSL)
4. For **external access**: Use External URL with `?sslmode=require`

## Testing the Connection

You can test the connection using `psql`:
```bash
psql "postgresql://spana_users:U2kOB5yHZDB5vI9tuEfPqLB2t52Ai3SH@dpg-d3p2ooc9c44c738ksb8g-a.frankfurt-postgres.render.com:5432/spana_db?sslmode=require"
```

Or test with Prisma:
```bash
npx prisma db pull
```

## Key Points

- ✅ Always include `.frankfurt-postgres.render.com` (or your region's domain)
- ✅ Always include port `:5432`
- ✅ Always include `?sslmode=require` for Render PostgreSQL
- ✅ Render PostgreSQL requires SSL connections

## Common Mistakes

❌ **Wrong:** `postgresql://user:pass@host/db`
✅ **Correct:** `postgresql://user:pass@host.frankfurt-postgres.render.com:5432/db?sslmode=require`

