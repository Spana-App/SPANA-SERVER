# First-Time Admin Flow

This document explains the complete flow for first-time admin registration and access.

## 📋 Overview

First-time admins go through:
1. **Registration** (or auto-creation on login)
2. **Email Verification** (via verification link)
3. **OTP Authentication** (for login)
4. **Access** (full admin panel)

---

## 🔄 Complete Flow

### Step 1: Registration

**Option A: Manual Registration**
```
POST /auth/register
{
  "email": "admin@gmail.com",  // Gmail or @spana.co.za
  "password": "SecurePassword123!",
  "firstName": "Admin",
  "lastName": "User",
  "phone": "+27123456789"
}
```

**What Happens:**
- ✅ Email checked against `ADMIN_EMAIL_DOMAINS` (default: `@spana.co.za`, `@gmail.com`)
- ✅ Auto-detected as `admin` role
- ✅ User created with `isEmailVerified: false`
- ✅ `AdminVerification` record created with `verified: false`
- ✅ Verification email sent with link (if email service works)

**Option B: Auto-Creation on Login**
If admin tries to login but doesn't exist:
- ✅ User auto-created with random password
- ✅ `AdminVerification` record created
- ✅ Proceeds to OTP flow

---

### Step 2: Email Verification

**Verification Email Contains:**
- Subject: "Verify your provider account"
- Link: `/admin/verify?token={token}&email={email}`
- Sent via: Gmail SMTP (from `noreply.spana@gmail.com`)

**Admin Clicks Link:**
```
GET /admin/verify?token={token}&email={email}
```

**What Happens:**
- ✅ Token validated (must be valid and not expired)
- ✅ Email marked as verified: `isEmailVerified: true`
- ✅ `AdminVerification.verified` set to `true`
- ✅ Shows confetti page with OTP (if available)
- ✅ OTP displayed on page (if not expired)

**If Token Invalid:**
- ❌ Shows error page: "Invalid or Expired Token"
- Admin can request new verification email

---

### Step 3: First Login (OTP Required)

**Admin Attempts Login:**
```
POST /auth/login
{
  "email": "admin@gmail.com",
  "password": "SecurePassword123!"
}
```

**What Happens:**
- ✅ Password validated
- ✅ 6-digit OTP generated
- ✅ OTP stored in `AdminOTP` table (expires in 5 hours)
- ✅ OTP email sent via Gmail SMTP
- ✅ Response: `{ requiresOTP: true, otp: "123456" }`

**OTP Email Contains:**
- Subject: "Your Spana Admin Login OTP 🎉"
- OTP: 6-digit code
- Expires: 5 hours
- Sent via: Gmail SMTP

---

### Step 4: OTP Verification

**Admin Verifies OTP:**
```
POST /admin/otp/verify
{
  "email": "admin@gmail.com",
  "otp": "123456"
}
```

**What Happens:**
- ✅ OTP validated (must match, not used, not expired)
- ✅ OTP marked as `used: true`
- ✅ JWT token generated
- ✅ Response: `{ token: "jwt_token", user: {...}, expiresIn: "5 hours" }`

**If OTP Invalid:**
- ❌ Error: "Invalid or expired OTP"
- Admin can request new OTP

---

### Step 5: Access Admin Panel

**Admin Uses Token:**
```
Authorization: Bearer {jwt_token}
```

**Admin Can Now:**
- ✅ Access all `/admin/*` endpoints
- ✅ Register service providers
- ✅ Manage users, bookings, services
- ✅ View dashboard data
- ✅ Verify documents

---

## 🔐 Security Features

1. **Email Verification Required**
   - Admin must verify email before full access
   - Verification link expires in 24 hours

2. **OTP Required for Login**
   - Every admin login requires OTP
   - OTP expires in 5 hours
   - OTP can only be used once

3. **Password + OTP**
   - Both password AND OTP required
   - Even if password is correct, OTP still needed

4. **Domain Restriction**
   - Only emails from `ADMIN_EMAIL_DOMAINS` can be admins
   - Default: `@spana.co.za`, `@gmail.com`

---

## 📧 Email Flow

### Registration Email
```
From: noreply.spana@gmail.com
To: admin@gmail.com
Subject: Verify your provider account
Link: /admin/verify?token={token}&email={email}
```

### OTP Email
```
From: noreply.spana@gmail.com
To: admin@gmail.com
Subject: Your Spana Admin Login OTP 🎉
OTP: 123456
Expires: 5 hours
```

---

## 🚨 Troubleshooting

### "Invalid or Expired Token"
- **Cause:** Verification link expired (24 hours) or already used
- **Solution:** Request new verification email:
  ```
  POST /admin/resend-verification
  { "email": "admin@gmail.com" }
  ```

### "Invalid or expired OTP"
- **Cause:** OTP wrong, used, or expired (5 hours)
- **Solution:** Request new OTP by logging in again

### "OTP is only available for admin emails"
- **Cause:** Email not in `ADMIN_EMAIL_DOMAINS`
- **Solution:** Add domain to `.env`:
  ```env
  ADMIN_EMAIL_DOMAINS=@spana.co.za,@gmail.com
  ```

### Email Not Received
- **Check:** Gmail SMTP is working
- **Check:** Spam folder
- **Check:** Email service logs
- **Resend:** Use `/admin/resend-verification` endpoint

---

## 📝 Quick Reference

### Endpoints Used

1. **Register:** `POST /auth/register`
2. **Login:** `POST /auth/login`
3. **Verify Email:** `GET /admin/verify?token={token}&email={email}`
4. **Verify OTP:** `POST /admin/otp/verify`
5. **Resend Verification:** `POST /admin/resend-verification`

### Database Records

- **User:** `role: 'admin'`, `isEmailVerified: true` (after verification)
- **AdminVerification:** `verified: true` (after verification)
- **AdminOTP:** `used: true` (after OTP verification)

---

## ✅ Success Criteria

Admin is fully set up when:
- ✅ User record exists with `role: 'admin'`
- ✅ `isEmailVerified: true`
- ✅ `AdminVerification.verified: true`
- ✅ Can login and receive OTP
- ✅ Can verify OTP and get JWT token
- ✅ Can access admin endpoints with token

---

## 🔄 Subsequent Logins

After first-time setup, admin login is simpler:
1. Login with email + password
2. Receive OTP via email
3. Verify OTP
4. Get JWT token
5. Access admin panel

No email verification needed after first time!
