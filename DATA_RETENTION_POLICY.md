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

### Data Deletion Protection

**Bulk cleanup scripts have been REMOVED** to prevent accidental data loss.

- ❌ **No automatic cleanup** – Data is never deleted by background processes
- ✅ **Manual deletion only** – Via admin API endpoints only

---

## 📋 Manual Deletion Process

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
- ❌ **Bulk data deletion** (cleanup scripts removed)

---

## ✅ What IS Allowed

- ✅ **Manual admin deletion** via API endpoints only
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

1. **No Automatic Execution**: No bulk cleanup scripts exist – data is never auto-deleted
2. **Admin Only**: Deletions via admin API endpoints only
3. **Audit Trail**: All deletions are logged in the `activities` table
4. **Backup First**: Always backup before manual deletion

---

## 📝 Change Log

- **2026-02-13**: Removed cleanup scripts (cleanupOrphanedRecords, cleanupAllTestData) to prevent accidental data loss
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
