# 🔒 Data Retention Policy

## Policy Statement

**All data must be retained. Deletions are ONLY allowed via manual admin action.**

Automatic cleanup scripts are **DISABLED** and will **NOT** run automatically.

---

## ✅ Current Status

- ✅ **Automatic cleanup: DISABLED**
- ✅ **Data retention: ENABLED**
- ✅ **Manual deletion: Admin-only**

---

## 🛡️ Safety Measures

### Cleanup Scripts Protection

**Two safeguards prevent accidental data loss:**

1. **Production block:** Cleanup scripts refuse to run when `NODE_ENV=production` (e.g. on Render).
2. **Explicit confirmation:** All cleanup scripts require `ALLOW_CLEANUP=true`.

**Without both conditions, cleanup scripts will:**
- ❌ Exit immediately
- ⚠️ Display warning messages
- 🔒 Prevent any data deletion

### Protected Scripts

1. **`scripts/cleanupAllTestData.ts`**
   - Deletes test users and orphaned records
   - **Blocked in production** (NODE_ENV=production)
   - **Requires:** `ALLOW_CLEANUP=true` (development only)

2. **`scripts/cleanupOrphanedRecords.ts`**
   - Deletes orphaned customers/providers
   - **Blocked in production** (NODE_ENV=production)
   - **Requires:** `ALLOW_CLEANUP=true` (development only)

3. **`scripts/cleanupUsers.ts`** (MongoDB legacy)
   - Modifies user data
   - **Blocked in production** (NODE_ENV=production)
   - **Requires:** `ALLOW_CLEANUP=true` (development only)

---

## 📋 Manual Deletion Process

### For Admins Only

To manually run cleanup scripts (admin only):

```bash
# Cleanup test data
ALLOW_CLEANUP=true npx ts-node scripts/cleanupAllTestData.ts

# Cleanup orphaned records
ALLOW_CLEANUP=true npx ts-node scripts/cleanupOrphanedRecords.ts

# Cleanup users (MongoDB legacy)
ALLOW_CLEANUP=true node scripts/cleanupUsers.js
```

### Via Admin API

Deletions can also be performed via admin API endpoints:
- `DELETE /admin/users/:id` - Delete user (admin only)
- `DELETE /admin/bookings/:id` - Delete booking (admin only)
- `DELETE /admin/services/:id` - Delete service (admin only)

---

## 🚫 What is NOT Allowed

- ❌ **Automatic scheduled cleanup** (cron jobs, scheduled tasks)
- ❌ **Background cleanup processes**
- ❌ **Automatic deletion on conditions**
- ❌ **Running cleanup scripts without explicit confirmation**

---

## ✅ What IS Allowed

- ✅ **Manual admin deletion** via API endpoints
- ✅ **Manual admin deletion** via scripts (with `ALLOW_CLEANUP=true`)
- ✅ **Data retention** - All data is kept by default
- ✅ **Audit logging** - All deletions are logged

---

## 📊 Data Retention

### What is Retained

- ✅ **All bookings** (including test bookings)
- ✅ **All users** (including test users)
- ✅ **All services** (including inactive services)
- ✅ **All payments** (including failed payments)
- ✅ **All activities** (audit trail)
- ✅ **All orphaned records** (for investigation)

### Why Retain Everything?

1. **Audit Trail** - Complete history for compliance
2. **Debugging** - Historical data helps troubleshoot issues
3. **Analytics** - Data for business insights
4. **Recovery** - Ability to restore if needed
5. **Compliance** - Legal/regulatory requirements

---

## 🔍 Monitoring

### Check for Orphaned Records

```bash
# Check without deleting
npx ts-node scripts/checkDeletedBookings.ts
```

### Count Records

```bash
# Count all bookings
npx ts-node scripts/countBookings.ts
```

---

## ⚠️ Important Notes

1. **No Automatic Execution**: Cleanup scripts will NEVER run automatically
2. **Explicit Confirmation Required**: Must set `ALLOW_CLEANUP=true` environment variable
3. **Admin Only**: Only admins should run cleanup scripts
4. **Audit Trail**: All deletions are logged in the `activities` table
5. **Backup First**: Always backup before running cleanup scripts

---

## 📝 Change Log

- **2026-02-04**: Disabled automatic cleanup. All cleanup scripts now require `ALLOW_CLEANUP=true`
- **2026-02-04**: Added safety checks to prevent accidental data loss
- **2026-02-04**: Established data retention policy

---

## 🆘 Support

If you need to clean up data:

1. **Contact Admin**: Only admins can perform deletions
2. **Backup First**: Always backup before deletion
3. **Use API**: Prefer admin API endpoints for deletions
4. **Document Reason**: Log why deletion is necessary

---

**Last Updated:** February 4, 2026  
**Policy Status:** ✅ Active  
**Automatic Cleanup:** ❌ Disabled
