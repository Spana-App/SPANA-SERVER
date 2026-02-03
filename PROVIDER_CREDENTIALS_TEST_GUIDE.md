# Provider Credentials Email - Test Guide

## Overview
This guide explains how to test the provider credentials email flow after deployment.

## What Was Changed

### 1. **Password is Permanent (Not Temporary)**
- ✅ Password generated when provider is created via CMS
- ✅ Password remains active until user changes it themselves
- ✅ Password is NOT cleared after credentials email is sent

### 2. **Email Template Updates**
- ✅ Changed "Temporary Password" → "Password"
- ✅ Changed "Email Address" → "Username (Email Address)" to clarify username = email
- ✅ Updated security warning to recommend (not require) password change

### 3. **Username = Email**
- ✅ Email address is used as username for login
- ✅ Email template clearly shows "Username (Email Address)"

## Testing Steps

### Step 1: Register a Provider via CMS
1. Login to CMS as admin
2. Navigate to User Management
3. Click "Add Provider"
4. Fill in:
   - First Name: `Test`
   - Last Name: `Provider`
   - Email: `test-provider-credentials@example.com` (use your test email)
   - Phone: `+27123456789`
5. Submit

**Expected Result:**
- Provider created successfully
- Welcome email sent with profile completion link
- Password stored in database (not cleared)

### Step 2: Complete Provider Profile
1. Open the profile completion link from welcome email
2. Fill in the form:
   - First Name: `Test`
   - Last Name: `Provider`
   - Phone: `+27123456789`
   - Experience Years: `5`
   - Skills: `Plumbing, Electrical`
3. Submit the form

**Expected Result:**
- Profile marked as complete
- Provider marked as verified
- **Credentials email sent automatically**

### Step 3: Check Credentials Email
Check the inbox for the email address you used.

**Expected Email Content:**
- ✅ Subject: "Welcome to SPANA - Your Service Provider Account & App Credentials 🎉"
- ✅ Shows "Username (Email Address): [email]"
- ✅ Shows "Password: [12-character password]"
- ✅ Security recommendation: "For your account security, we strongly recommend changing your password after your first login. You can update it anytime from your profile settings."
- ✅ App download link
- ✅ Login URL

### Step 4: Verify Password Persistence
1. Check database: `serviceProvider.temporaryPassword` should still contain the password
2. Password should NOT be cleared/null

**Expected Result:**
- Password remains in database
- User can login with the provided password
- Password stays active until user changes it

### Step 5: Test Login
1. Use the SPANA app or login endpoint
2. Login with:
   - Username (Email): The email you used
   - Password: The password from the credentials email
3. Should login successfully

**Expected Result:**
- Login successful
- User can access their account
- Password works as expected

## API Endpoints Used

1. **Register Provider (Admin)**
   ```
   POST /admin/providers/register
   Headers: Authorization: Bearer [admin_token]
   Body: {
     "firstName": "Test",
     "lastName": "Provider",
     "email": "test@example.com",
     "phone": "+27123456789"
   }
   ```

2. **Complete Profile**
   ```
   GET /complete-registration?token=[token]&uid=[uid]
   POST /complete-registration
   Body: {
     "token": "[token]",
     "uid": "[uid]",
     "firstName": "Test",
     "lastName": "Provider",
     "phone": "+27123456789",
     "experienceYears": 5,
     "skills": ["Plumbing", "Electrical"]
   }
   ```

## Database Verification

Check these fields after profile completion:

```sql
SELECT 
  u.email,
  u."firstName",
  u."lastName",
  sp."temporaryPassword",
  sp."isProfileComplete",
  sp."isVerified"
FROM "User" u
JOIN "ServiceProvider" sp ON sp."userId" = u.id
WHERE u.email = 'test-provider-credentials@example.com';
```

**Expected:**
- `temporaryPassword` should contain the password (NOT NULL)
- `isProfileComplete` should be `true`
- `isVerified` should be `true`

## Troubleshooting

### Email Not Received
- Check spam folder
- Verify email service is configured (`EMAIL_SERVICE_URL`, `EMAIL_SERVICE_SECRET`)
- Check server logs for email sending errors

### Password Cleared
- Should NOT happen - password should remain
- Check `registrationController.ts` - ensure no `temporaryPassword: null` update after email

### Login Fails
- Verify password matches what's in email
- Check if password was hashed correctly in database
- Verify email is used as username (not a separate username field)

## Summary

✅ **Password is permanent** - stays until user changes it
✅ **Email shows username = email** - clearly labeled
✅ **Security recommendation** - recommends (not requires) password change
✅ **Credentials sent automatically** - after profile completion
