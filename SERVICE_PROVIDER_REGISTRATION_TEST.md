# Service Provider Registration Flow - Test Guide

## 🎯 Test Overview
This guide walks you through testing the complete service provider registration flow, including email receipt and profile completion.

---

## 📋 Test Data
- **Email**: `eksnxiweni@gmail.com`
- **Password**: `TestPassword123!`
- **User ID**: `cmkpg9men00004exsl800lzel`
- **Token**: `aabe2994cf80d65a78580897777c8da6318466731b7ba1be76a154aeccf164ad`
- **Base URL**: `http://localhost:5003`

---

## 🔄 Complete Flow Steps

### **STEP 1: Register Service Provider**

**Request:**
```http
POST http://localhost:5003/auth/register?sendEmails=true
Content-Type: application/json
```

**Body:**
```json
{
  "email": "eksnxiweni@gmail.com",
  "password": "TestPassword123!",
  "firstName": "Eks",
  "lastName": "Nxiweni",
  "phone": "+27123456789",
  "role": "service_provider"
}
```

**Expected Response (201):**
```json
{
  "message": "User created successfully. Please login to get your access token.",
  "user": {
    "_id": "cmkpg9men00004exsl800lzel",
    "email": "eksnxiweni@gmail.com",
    "firstName": "Eks",
    "lastName": "Nxiweni",
    "role": "service_provider",
    "isProfileComplete": false,
    ...
  }
}
```

**✅ What happens:**
- User record created in database
- ServiceProvider record created
- Welcome email sent to `eksnxiweni@gmail.com`
- Email contains "Complete Profile" button with verification link

---

### **STEP 2: Check Email**

**Action:** Check your inbox at `eksnxiweni@gmail.com`

**Expected Email Content:**
- Subject: "Welcome to SPANA, Eks! 🎉"
- Contains SPANA logo (top-left, small)
- Welcome message for Service Provider
- **"Complete Profile" button** linking to:
  ```
  http://localhost:5003/complete-registration?token=aabe2994cf80d65a78580897777c8da6318466731b7ba1be76a154aeccf164ad&uid=cmkpg9men00004exsl800lzel
  ```

---

### **STEP 3: View Complete Registration Form (GET)**

**Request:**
```http
GET http://localhost:5003/complete-registration?token=aabe2994cf80d65a78580897777c8da6318466731b7ba1be76a154aeccf164ad&uid=cmkpg9men00004exsl800lzel
```

**Expected Response (200):**
- HTML form page
- Pre-filled fields (if available from registration)
- Form fields:
  - First Name
  - Last Name
  - Phone
  - Experience Years
  - Skills (dynamic list)
- Submit button: "Complete Profile"
- Message about uploading documents after login

**Note:** This is the page that opens when clicking the "Complete Profile" button in the email.

---

### **STEP 4: Complete Profile (POST)**

**Request:**
```http
POST http://localhost:5003/complete-registration
Content-Type: application/json
```

**Body:**
```json
{
  "firstName": "Eks",
  "lastName": "Nxiweni",
  "phone": "+27123456789",
  "experienceYears": 5,
  "skills": ["Plumbing", "Electrical", "Carpentry"],
  "token": "aabe2994cf80d65a78580897777c8da6318466731b7ba1be76a154aeccf164ad",
  "uid": "cmkpg9men00004exsl800lzel"
}
```

**Expected Response (200):**
```json
{
  "message": "Profile completed successfully! You can now start receiving bookings.",
  "user": {
    "id": "cmkpg9men00004exsl800lzel",
    "email": "eksnxiweni@gmail.com",
    "firstName": "Eks",
    "lastName": "Nxiweni"
  }
}
```

**✅ What happens:**
- User profile updated (firstName, lastName, phone)
- ServiceProvider profile updated:
  - `isProfileComplete`: `true`
  - `isVerified`: `true`
  - `experienceYears`: `5`
  - `skills`: `["Plumbing", "Electrical", "Carpentry"]`

---

### **STEP 5: Login After Profile Completion**

**Request:**
```http
POST http://localhost:5003/auth/login
Content-Type: application/json
```

**Body:**
```json
{
  "email": "eksnxiweni@gmail.com",
  "password": "TestPassword123!"
}
```

**Expected Response (200):**
```json
{
  "message": "Login successful",
  "token": "[JWT_TOKEN_HERE]",
  "user": {
    "_id": "cmkpg9men00004exsl800lzel",
    "email": "eksnxiweni@gmail.com",
    "role": "service_provider",
    "isProfileComplete": true,
    "isVerified": true,
    "skills": ["Plumbing", "Electrical", "Carpentry"],
    "experienceYears": 5,
    ...
  }
}
```

**✅ What happens:**
- JWT token generated
- User can now access protected endpoints
- Profile is complete and verified

---

## 🧪 Quick Test Commands

### Using PowerShell/curl:

**1. Register:**
```powershell
$body = @{
  email = "eksnxiweni@gmail.com"
  password = "TestPassword123!"
  firstName = "Eks"
  lastName = "Nxiweni"
  phone = "+27123456789"
  role = "service_provider"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5003/auth/register?sendEmails=true" -Method Post -Body $body -ContentType "application/json"
```

**2. View Form:**
```powershell
Invoke-WebRequest -Uri "http://localhost:5003/complete-registration?token=aabe2994cf80d65a78580897777c8da6318466731b7ba1be76a154aeccf164ad&uid=cmkpg9men00004exsl800lzel" -Method Get
```

**3. Complete Profile:**
```powershell
$body = @{
  firstName = "Eks"
  lastName = "Nxiweni"
  phone = "+27123456789"
  experienceYears = 5
  skills = @("Plumbing", "Electrical", "Carpentry")
  token = "aabe2994cf80d65a78580897777c8da6318466731b7ba1be76a154aeccf164ad"
  uid = "cmkpg9men00004exsl800lzel"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5003/complete-registration" -Method Post -Body $body -ContentType "application/json"
```

**4. Login:**
```powershell
$body = @{
  email = "eksnxiweni@gmail.com"
  password = "TestPassword123!"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5003/auth/login" -Method Post -Body $body -ContentType "application/json"
```

---

## ✅ Verification Checklist

After completing all steps, verify:

- [ ] Welcome email received in inbox
- [ ] Email contains "Complete Profile" button
- [ ] Button link works and opens form page
- [ ] Form can be submitted successfully
- [ ] Database shows `isProfileComplete: true`
- [ ] Database shows `isVerified: true`
- [ ] Skills and experience saved correctly
- [ ] Login works after profile completion
- [ ] JWT token received on login

---

## 🔧 Troubleshooting

**Email not received?**
- Check spam folder
- Verify `EMAIL_SERVICE_URL` is set correctly
- Check backend logs for email service status
- Verify `sendEmails=true` query parameter was included

**Form not loading?**
- Verify token and uid are correct
- Check token hasn't expired (24 hours)
- Verify user exists in database

**Profile completion fails?**
- Verify all required fields are provided
- Check token and uid match the user
- Verify user role is `service_provider`

**Login fails?**
- Verify email and password are correct
- Check user exists and is active
- Verify profile is completed (`isProfileComplete: true`)

---

## 📝 Notes

- The verification token expires after 24 hours
- Document upload happens **after** profile completion, within the app
- The "Complete Profile" link in email uses the Render backend URL in production
- All email links are dynamically generated using `EXTERNAL_API_URL` or fallback to Render URL
