# Admin Profile Update & Email Domain Fix

## Issues Fixed

### 1. ✅ Email Domain Restriction
**Problem:** Test scripts were using `@spana.co.za` for customers and providers, causing them to be auto-detected as admins and receive OTP emails.

**Fix:** Updated test scripts to use `@gmail.com` for customers and providers. Only admins should use `@spana.co.za` domain.

**Files Changed:**
- `scripts/testCompleteServiceFlow.ts` - Changed customer and provider emails to `@gmail.com`

### 2. ✅ Admin Profile Image Upload
**Problem:** Admins couldn't upload profile photos. The `/admin/profile` endpoint only supported `password`, `firstName`, `lastName`, and `phone`.

**Fix:** 
- Added `profileImage` support to `/admin/profile` endpoint (PUT)
- Added dedicated admin profile image upload route: `POST /admin/profile/image`

**Files Changed:**
- `controllers/adminController.ts` - Added `profileImage` field to `updateAdminProfile`
- `routes/admin.ts` - Added `POST /admin/profile/image` route

### 3. ✅ Admin Profile Update
**Problem:** Admins couldn't update their profile properly.

**Fix:** Admin profile update endpoint now supports:
- `firstName`
- `lastName`
- `phone`
- `password`
- `profileImage` (URL string)

## API Endpoints

### Update Admin Profile
**Endpoint:** `PUT /admin/profile`  
**Auth:** Admin only  
**Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+27123456789",
  "password": "NewPassword123!",
  "profileImage": "https://example.com/image.jpg"
}
```

### Upload Admin Profile Image
**Endpoint:** `POST /admin/profile/image`  
**Auth:** Admin only  
**Content-Type:** `multipart/form-data`  
**Body:** Form data with `image` field (file)

**Alternative:** Admins can also use `POST /auth/profile/image` (works for all authenticated users)

## Email Domain Policy

### ✅ Correct Usage:
- **Admins:** `@spana.co.za` (or configured admin domains)
- **Customers:** Any email domain (e.g., `@gmail.com`, `@yahoo.com`, etc.)
- **Providers:** Any email domain (e.g., `@gmail.com`, `@yahoo.com`, etc.)

### ❌ Incorrect Usage:
- **Customers/Providers:** Should NOT use `@spana.co.za` (will be auto-detected as admin)

## Testing

Updated test script uses proper email domains:
```typescript
const CUSTOMER_EMAIL = `customer.${Date.now()}@gmail.com`;
const PROVIDER_EMAIL = `provider.${Date.now()}@gmail.com`;
const ADMIN_EMAIL = 'xoli@spana.co.za';
```

## Notes

- Only admins receive OTP emails (for `@spana.co.za` emails)
- Customers and providers use standard password authentication
- Admin profile updates are now fully functional
- Profile image uploads work for admins via both `/admin/profile/image` and `/auth/profile/image`
