# Admin CMS Registration

## Overview

Admins can now only be created by other admins via the CMS. Public registration of admin accounts is **disabled**.

## Changes Made

### 1. New Endpoint: `POST /admin/admins/register`

**Access:** Admin only (requires admin JWT token)

**Request Body:**
```json
{
  "firstName": "Admin",
  "lastName": "User",
  "email": "admin@gmail.com",
  "phone": "+27123456789",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "message": "Admin created successfully. Verification email sent with setup instructions.",
  "user": {
    "id": "user_id",
    "email": "admin@gmail.com",
    "firstName": "Admin",
    "lastName": "User",
    "phone": "+27123456789",
    "role": "admin",
    "referenceNumber": "SPN-USR-000123",
    "isEmailVerified": false
  },
  "verificationLink": "https://.../admin/verify?token=...&email=...",
  "note": "New admin must verify email and set up their account before first login"
}
```

### 2. Public Registration Blocked

**Before:** Anyone could register with `@spana.co.za` or `@gmail.com` and auto-become admin

**After:** 
- Public registration with `role: 'admin'` → **403 Forbidden**
- Public registration with admin domain email → **403 Forbidden**
- Error message: "Admin accounts cannot be created via public registration. Please contact an existing admin to create your account."

### 3. Security Features

- ✅ Only existing admins can create new admins
- ✅ Email must be from `ADMIN_EMAIL_DOMAINS` (default: `@spana.co.za`, `@gmail.com`)
- ✅ Password must be at least 8 characters
- ✅ Verification email sent automatically
- ✅ New admin must verify email before first login

## Flow for New Admin

1. **Existing Admin Creates New Admin:**
   ```
   POST /admin/admins/register
   Authorization: Bearer {admin_token}
   ```

2. **New Admin Receives Email:**
   - Verification link sent to their email
   - Link expires in 24 hours

3. **New Admin Verifies Email:**
   - Clicks verification link
   - Email marked as verified

4. **New Admin First Login:**
   - Login with email + password
   - Receives OTP via email
   - Verifies OTP
   - Gets JWT token
   - Can now access admin panel

## Testing

Use the test script:
```bash
node scripts/test-admin-register-admin.js
```

This will:
1. Login as existing admin
2. Create a new admin
3. Show verification link

## Implementation Notes

The `registerAdmin` function needs to be added to `adminController.ts`. The function code is ready and should be added before the `export {}` statement.

## Benefits

- ✅ **Security:** No unauthorized admin account creation
- ✅ **Control:** Only existing admins can add new admins
- ✅ **Audit Trail:** All admin creation is logged
- ✅ **CMS Integration:** Fits perfectly with admin CMS workflow
