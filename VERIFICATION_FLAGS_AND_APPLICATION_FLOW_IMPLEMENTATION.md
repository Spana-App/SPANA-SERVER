# Verification Flags and Application Flow Implementation

## Summary of Changes

This document outlines all changes made to implement the new verification flags logic and the application verification flow.

---

## 1. Schema Changes (`prisma/schema.prisma`)

### Updated `isPhoneVerified` Field
- **Before**: `isPhoneVerified Boolean @default(false)`
- **After**: `isPhoneVerified Boolean?` (nullable, no default)

**Reason**: Phone verification is not a priority, so it should be `null` by default rather than `false`.

**Migration Required**: Run `npx prisma db push` or create a migration to update the database schema.

---

## 2. Admin Controller Changes (`controllers/adminController.ts`)

### A. `registerServiceProvider` Function (Existing Endpoint)

**Changes Made**:

1. **User Creation**:
   - Added `isPhoneVerified: null` (not a priority)
   - `isEmailVerified: false` (will be true after credentials email sent)
   - `phone: phone || null` (explicit null handling)

2. **ServiceProvider Creation**:
   - `isVerified: true` (admin verified documents before creating account)
   - `isIdentityVerified: true` (admin verified documents before creating account)

**Flow**:
- Admin creates provider → Account created with `isIdentityVerified: true`, `isEmailVerified: false`
- Provider receives registration link → Completes profile → Receives credentials email
- After credentials email sent → `isEmailVerified: true`

### B. New Endpoint: `verifyApplicationAndCreateProvider`

**Route**: `POST /admin/applications/:applicationId/verify`

**Purpose**: Verify a service provider application and automatically create their account with data from the application.

**Flow**:
1. Admin reviews application in CMS
2. Admin verifies documents (manual + third-party verification)
3. Admin clicks "Verify Account" → Calls this endpoint
4. Endpoint:
   - Creates `User` account (auto-populated from application)
   - Creates `ServiceProvider` record (auto-populated from application)
   - Links application to provider (`applicationId`)
   - Sets `isVerified: true` and `isIdentityVerified: true`
   - Sets `isEmailVerified: false` (will be true after credentials email)
   - Sets `isPhoneVerified: null`
   - Generates password and stores in `temporaryPassword`
   - Sends registration link email
   - Updates application status to `'approved'`

**Request**:
```
POST /admin/applications/:applicationId/verify
Headers: Authorization: Bearer <admin_jwt_token>
```

**Response**:
```json
{
  "message": "Application verified and provider account created successfully",
  "user": {
    "id": "...",
    "email": "...",
    "firstName": "...",
    "lastName": "..."
  },
  "provider": {
    "id": "...",
    "isVerified": true,
    "isIdentityVerified": true
  },
  "application": {
    "id": "...",
    "status": "approved"
  }
}
```

**Error Cases**:
- 404: Application not found
- 400: Application already approved/rejected, or user already exists

---

## 3. Registration Controller Changes (`controllers/registrationController.ts`)

### `submitProfile` Function

**Changes Made**:

1. **After credentials email sent**:
   - Updates `User` with `isEmailVerified: true` (credentials sent via email = email verified)
   - Updates `User` with `isPhoneVerified: null` (not a priority)

2. **ServiceProvider Update**:
   - `isVerified: true` (already verified by admin)
   - `isIdentityVerified: true` (already verified by admin during application review)

**Flow**:
- Provider receives registration link → Clicks link → Completes profile form
- Profile submitted → Credentials email sent → `isEmailVerified: true`, `isPhoneVerified: null`

---

## 4. Routes Changes (`routes/admin.ts`)

### New Route Added

```typescript
router.post('/applications/:applicationId/verify', auth, authorize('admin'), adminController.verifyApplicationAndCreateProvider);
```

**Authentication**: Requires admin JWT token

---

## Complete Application Flow

### Step 1: Provider Applies
- Provider visits careers page on website
- Fills out application form
- Uploads documents (ID, certificates, etc.)
- Application stored in `ServiceProviderApplication` table
- Status: `'pending'`

### Step 2: Admin Reviews Application
- Admin views applications in CMS
- Admin manually reviews documents
- Admin uses third-party verification provider to validate documents
- If verification successful → Admin clicks "Verify Account"

### Step 3: Admin Verifies Application
- `POST /admin/applications/:applicationId/verify` called
- Creates `User` account (auto-populated from application)
- Creates `ServiceProvider` record (auto-populated from application)
- Sets verification flags:
  - `isIdentityVerified: true` ✅
  - `isVerified: true` ✅
  - `isEmailVerified: false` (will be true after credentials email)
  - `isPhoneVerified: null`
- Generates password → Stores in `temporaryPassword`
- Sends registration link email to provider
- Updates application status to `'approved'`

### Step 4: Provider Completes Profile
- Provider receives email with registration link
- Provider clicks link → Opens profile completion form
- Provider fills in additional details (skills, experience, etc.)
- Provider submits form → `POST /complete-registration`

### Step 5: Credentials Email Sent
- Profile completion successful
- Credentials email sent with username (email) and password
- Updates `User`:
  - `isEmailVerified: true` ✅
  - `isPhoneVerified: null`
- Password remains in `temporaryPassword` until user changes it

### Step 6: Provider Can Login
- Provider receives credentials email
- Provider can now log into the app using email and password
- Provider can change password from profile settings

---

## Verification Flags Summary

| Flag | Initial Value (Admin Creates) | After Profile Completion | Notes |
|------|-------------------------------|--------------------------|-------|
| `isEmailVerified` | `false` | `true` | Set to `true` after credentials email sent |
| `isPhoneVerified` | `null` | `null` | Not a priority, remains `null` |
| `isIdentityVerified` | `true` | `true` | Set to `true` when admin verifies documents |
| `isVerified` | `true` | `true` | Set to `true` when admin verifies documents |

---

## Testing

### Test the New Endpoint

1. **Create a test application** (via public endpoint or directly in DB):
   ```sql
   INSERT INTO service_provider_applications (id, email, "firstName", "lastName", phone, status, skills, "experienceYears")
   VALUES ('test-app-123', 'test@example.com', 'Test', 'Provider', '+27123456789', 'pending', ARRAY['Plumbing'], 5);
   ```

2. **Get admin token** (via OTP login):
   ```
   POST /admin/otp/request
   POST /admin/otp/verify
   ```

3. **Verify application**:
   ```
   POST /admin/applications/test-app-123/verify
   Headers: Authorization: Bearer <admin_token>
   ```

4. **Check provider account created**:
   - User should exist with email `test@example.com`
   - ServiceProvider should exist with `isIdentityVerified: true`
   - Application status should be `'approved'`

5. **Complete registration**:
   - Use registration link from email
   - Complete profile form
   - Verify credentials email received
   - Check `isEmailVerified: true` in database

---

## Migration Steps

1. **Update Schema**:
   ```bash
   npx prisma db push
   # OR
   npx prisma migrate dev --name make_isPhoneVerified_nullable
   ```

2. **Regenerate Prisma Client**:
   ```bash
   npx prisma generate
   ```

3. **Update Existing Records** (if needed):
   ```sql
   UPDATE users SET "isPhoneVerified" = NULL WHERE "isPhoneVerified" = false AND role = 'service_provider';
   ```

---

## Notes

- The `temporaryPassword` field stores the plaintext password until the user changes it themselves
- The password is sent via email after profile completion, not during account creation
- Phone verification is not a priority and remains `null`
- Identity verification happens before account creation (admin verifies documents)
- Email verification happens after profile completion (credentials email sent)
