# System Wiring Summary

## ✅ All Systems Connected

### 1. Routes → Server
- **Location:** `server.ts` line 504
- **Mount:** `app.use('/admin', require('./routes/admin'));`
- **Status:** ✅ Connected

### 2. Routes → Controllers
- **File:** `routes/admin.ts`
- **Endpoints:**
  - `POST /admin/admins/register` → `adminController.registerAdmin`
  - `POST /admin/providers/register` → `adminController.registerServiceProvider`
  - `PUT /admin/profile` → `adminController.updateAdminProfile`
- **Status:** ✅ Connected

### 3. Controllers → Dependencies
- **File:** `controllers/adminController.ts`
- **Imports:**
  - ✅ `prisma` - Database
  - ✅ `bcrypt` - Password hashing
  - ✅ `nodeCrypto` - Token generation
  - ✅ `generateUserReferenceAsync` - User reference numbers
  - ✅ `sendAdminCredentialsEmail` - Admin email
  - ✅ `sendWelcomeEmail` - Provider email
- **Status:** ✅ All imports present

### 4. Email Functions
- **File:** `config/mailer.ts`
- **Exports:**
  - ✅ `sendAdminCredentialsEmail` - For admin credentials
  - ✅ `sendCustomerWelcomeEmail` - For customers (if needed)
  - ✅ `sendWelcomeEmail` - For service providers
- **Status:** ✅ All functions exported

### 5. Email Service Configuration
- **Primary:** Gmail SMTP (`noreply.spana@gmail.com`)
- **Service URL:** `http://localhost:3000` (dev) or Vercel (prod)
- **Status:** ✅ Configured

## Endpoint Flow

### Admin Creation Flow
```
POST /admin/admins/register
  ↓
adminController.registerAdmin()
  ↓
Generate password → Hash → Create user → Send email
  ↓
sendAdminCredentialsEmail()
  ↓
Email Service (Gmail SMTP)
  ↓
Email sent with credentials
```

### Service Provider Creation Flow
```
POST /admin/providers/register
  ↓
adminController.registerServiceProvider()
  ↓
Create user (placeholder password) → Create provider record → Send email
  ↓
sendWelcomeEmail()
  ↓
Email Service (Gmail SMTP)
  ↓
Email sent with profile completion link
```

### Admin Profile Update Flow
```
PUT /admin/profile
  ↓
adminController.updateAdminProfile()
  ↓
Update user record (password, firstName, lastName, phone)
  ↓
Return updated user
```

## Testing

### Test Admin Creation
```bash
# 1. Login as existing admin
POST /auth/login
{ "email": "xoli@spana.co.za", "password": "..." }

# 2. Get OTP (if required)
POST /admin/otp/verify
{ "email": "xoli@spana.co.za", "otp": "..." }

# 3. Create new admin
POST /admin/admins/register
Authorization: Bearer <admin_token>
{
  "firstName": "New",
  "lastName": "Admin",
  "email": "newadmin@gmail.com",
  "phone": "+27123456789"
}
```

### Test Service Provider Creation
```bash
# 1. Login as admin (same as above)

# 2. Create service provider
POST /admin/providers/register
Authorization: Bearer <admin_token>
{
  "firstName": "Service",
  "lastName": "Provider",
  "email": "provider@example.com",
  "phone": "+27123456789"
}
```

### Test Admin Profile Update
```bash
PUT /admin/profile
Authorization: Bearer <admin_token>
{
  "password": "NewPassword123!",
  "firstName": "Updated",
  "lastName": "Name"
}
```

## Environment Variables Required

### Backend (.env)
```env
ADMIN_EMAIL_DOMAINS=@spana.co.za,@gmail.com
USE_EMAIL_SERVICE=true
EMAIL_SERVICE_URL=http://localhost:3000
EMAIL_SERVICE_SECRET=e37cf6365bf1daa23bbb4dfd359a978117857dfabb5410478ca0f8c58880cbf3
```

### Email Service (.env)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply.spana@gmail.com
SMTP_PASS=yavsixtcnfxxdwkx
SMTP_FROM=noreply.spana@gmail.com
API_SECRET=e37cf6365bf1daa23bbb4dfd359a978117857dfabb5410478ca0f8c58880cbf3
```

## Status: ✅ FULLY WIRED

All components are connected and ready for testing!
