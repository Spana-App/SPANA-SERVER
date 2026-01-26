# Admin Routes Documentation

Complete list of all admin routes, their methods, authentication requirements, and functionality.

**Base URL:** `/admin`

**Authentication:** Most routes require:
- `Authorization: Bearer <admin_token>` header
- Admin role verification via `authorize('admin')` middleware

---

## 🔐 Authentication & Verification Routes

### 1. **GET `/admin/verify`**
- **Auth Required:** ❌ No
- **Description:** Admin email verification endpoint. Displays verification page with OTP input.
- **Query Parameters:**
  - `token` (required): Verification token from email
  - `email` (required): Admin email address
  - `otp` (optional): OTP code (can be entered on page)
- **Response:** HTML page with verification form or confetti success page
- **Status Codes:**
  - `200`: Verification successful
  - `400`: Missing/invalid token or email

### 2. **POST `/admin/resend-verification`**
- **Auth Required:** ❌ No
- **Description:** Resends admin verification email with new verification token.
- **Body:**
  ```json
  {
    "email": "admin@spana.co.za"
  }
  ```
- **Response:**
  ```json
  {
    "message": "Verification email sent successfully",
    "email": "admin@spana.co.za",
    "expiresIn": "24 hours"
  }
  ```
- **Status Codes:**
  - `200`: Email sent successfully
  - `400`: Missing email or invalid admin email domain
  - `404`: User not found

---

## 🔑 OTP Authentication Routes

### 3. **POST `/admin/otp/request`**
- **Auth Required:** ❌ No
- **Description:** Requests OTP for admin login. Generates 6-digit OTP, stores in database, and sends via email.
- **Body:**
  ```json
  {
    "email": "admin@spana.co.za"
  }
  ```
- **Requirements:**
  - Email must end with `@spana.co.za` (or configured admin domain)
  - User must exist and have `admin` role
- **Response:**
  ```json
  {
    "message": "OTP sent to your email. Please check your inbox.",
    "expiresIn": "5 hours"
  }
  ```
- **Status Codes:**
  - `200`: OTP generated and sent
  - `400`: Invalid email domain or missing email
  - `404`: Admin user not found
  - `500`: Email sending failed

### 4. **POST `/admin/otp/verify`**
- **Auth Required:** ❌ No
- **Description:** Verifies OTP and returns admin JWT token (5-hour expiry).
- **Body:**
  ```json
  {
    "email": "admin@spana.co.za",
    "otp": "123456"
  }
  ```
- **Response:**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "...",
      "email": "admin@spana.co.za",
      "firstName": "Admin",
      "lastName": "User",
      "role": "admin"
    }
  }
  ```
- **Status Codes:**
  - `200`: OTP verified, token returned
  - `400`: Invalid or expired OTP, or missing fields

---

## 📄 Document Verification Routes

### 5. **GET `/admin/documents/pending`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Retrieves all pending document verification requests from service providers.
- **Response:** Array of pending documents with user information
- **Status Codes:**
  - `200`: Success
  - `401`: Unauthorized
  - `403`: Not an admin

### 6. **PUT `/admin/documents/:docId/verify`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Verifies or rejects a provider document.
- **URL Parameters:**
  - `docId`: Document ID
- **Body:**
  ```json
  {
    "userId": "user_id",
    "verified": true
  }
  ```
- **Response:**
  ```json
  {
    "message": "Document verification updated",
    "isIdentityVerified": true,
    "documents": [...]
  }
  ```
- **Status Codes:**
  - `200`: Document verification updated
  - `400`: Invalid request
  - `404`: Document or user not found

---

## 💰 Wallet Management Routes

### 7. **GET `/admin/wallet/transactions`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Retrieves all wallet transactions (last 100).
- **Response:** Array of wallet transactions with wallet information
- **Status Codes:**
  - `200`: Success
  - `401`: Unauthorized
  - `403`: Not an admin

### 8. **GET `/admin/wallet/summary`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Retrieves wallet summary including total held, released, commission, and recent transactions.
- **Response:**
  ```json
  {
    "totalHeld": 0,
    "totalReleased": 0,
    "totalCommission": 0,
    "transactions": [...]
  }
  ```
- **Status Codes:**
  - `200`: Success
  - `401`: Unauthorized
  - `403`: Not an admin

---

## 📊 Dashboard Data Routes

### 9. **GET `/admin/bookings`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Retrieves all bookings with full details (service, provider, customer, payment).
- **Response:** Array of bookings with nested relationships
- **Status Codes:**
  - `200`: Success
  - `401`: Unauthorized
  - `403`: Not an admin

### 10. **GET `/admin/users`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Retrieves all users with customer and service provider relationships.
- **Response:** Array of users with role-specific data
- **Status Codes:**
  - `200`: Success
  - `401`: Unauthorized
  - `403`: Not an admin

### 11. **GET `/admin/services`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Retrieves all services with provider information.
- **Response:** Array of services with provider details
- **Status Codes:**
  - `200`: Success
  - `401`: Unauthorized
  - `403`: Not an admin

---

## 🛠️ Service Management Routes

### 12. **POST `/admin/services`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Creates a new service. Admin can create services without assigning a provider initially.
- **Body:**
  ```json
  {
    "title": "Service Name",
    "description": "Service description",
    "price": 100.00,
    "duration": 60,
    "category": "cleaning",
    "providerId": "optional_provider_id"
  }
  ```
- **Response:**
  ```json
  {
    "message": "Service created successfully",
    "service": { ... }
  }
  ```
- **Status Codes:**
  - `201`: Service created
  - `400`: Validation error
  - `401`: Unauthorized
  - `403`: Not an admin

### 13. **PUT `/admin/services/:id`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Updates an existing service.
- **URL Parameters:**
  - `id`: Service ID
- **Body:** Partial service data (title, description, price, duration, category, etc.)
- **Response:**
  ```json
  {
    "message": "Service updated successfully",
    "service": { ... }
  }
  ```
- **Status Codes:**
  - `200`: Service updated
  - `400`: Validation error
  - `404`: Service not found

### 14. **POST `/admin/services/:id/approve`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Approves a service (changes status to 'approved').
- **URL Parameters:**
  - `id`: Service ID
- **Response:**
  ```json
  {
    "message": "Service approved",
    "service": { ... }
  }
  ```
- **Status Codes:**
  - `200`: Service approved
  - `400`: Service already approved or invalid state
  - `404`: Service not found

### 15. **POST `/admin/services/:id/assign`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Assigns a service to a provider.
- **URL Parameters:**
  - `id`: Service ID
- **Body:**
  ```json
  {
    "providerId": "provider_user_id"
  }
  ```
- **Response:**
  ```json
  {
    "message": "Service assigned to provider",
    "service": { ... }
  }
  ```
- **Status Codes:**
  - `200`: Service assigned
  - `400`: Provider not found or invalid
  - `404`: Service not found

### 16. **POST `/admin/services/:id/unassign`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Unassigns a service from its current provider.
- **URL Parameters:**
  - `id`: Service ID
- **Response:**
  ```json
  {
    "message": "Service unassigned from provider",
    "service": { ... }
  }
  ```
- **Status Codes:**
  - `200`: Service unassigned
  - `400`: Service not assigned or invalid state
  - `404`: Service not found

### 17. **DELETE `/admin/services/:id`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Deletes a service.
- **URL Parameters:**
  - `id`: Service ID
- **Response:**
  ```json
  {
    "message": "Service deleted successfully"
  }
  ```
- **Status Codes:**
  - `200`: Service deleted
  - `404`: Service not found

---

## 👥 Provider Management Routes

### 18. **GET `/admin/providers/:providerId/performance`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Retrieves performance metrics for a specific provider.
- **URL Parameters:**
  - `providerId`: Provider user ID
- **Response:** Provider performance data (ratings, bookings, revenue, etc.)
- **Status Codes:**
  - `200`: Success
  - `404`: Provider not found

---

## 🚨 Complaints Management Routes

### 19. **GET `/admin/complaints`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Retrieves all complaints with optional filtering.
- **Query Parameters:**
  - `status` (optional): Filter by status (pending, resolved, etc.)
  - `severity` (optional): Filter by severity
  - `type` (optional): Filter by complaint type
  - `reportedByRole` (optional): Filter by reporter role
- **Response:** Array of complaints with booking and service information
- **Status Codes:**
  - `200`: Success
  - `401`: Unauthorized
  - `403`: Not an admin

### 20. **PUT `/admin/complaints/:id/resolve`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Resolves a complaint.
- **URL Parameters:**
  - `id`: Complaint ID
- **Body:**
  ```json
  {
    "status": "resolved",
    "resolution": "Resolution details"
  }
  ```
- **Response:**
  ```json
  {
    "message": "Complaint resolved",
    "complaint": { ... }
  }
  ```
- **Status Codes:**
  - `200`: Complaint resolved
  - `400`: Invalid request
  - `404`: Complaint not found

---

## 👤 User Registration Routes (CMS)

### 21. **POST `/admin/providers/register`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Creates a new service provider via CMS. Provider receives email with profile completion link to set their own password.
- **Body:**
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "provider@example.com",
    "phone": "+27123456789"
  }
  ```
- **Response:**
  ```json
  {
    "message": "Service provider created successfully",
    "user": { ... },
    "profileCompletionLink": "https://..."
  }
  ```
- **Status Codes:**
  - `201`: Provider created
  - `400`: Validation error or user exists
  - `401`: Unauthorized
  - `403`: Not an admin

### 22. **POST `/admin/admins/register`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Creates a new admin user via CMS. Admin receives email with auto-generated password.
- **Body:**
  ```json
  {
    "firstName": "Admin",
    "lastName": "User",
    "email": "newadmin@spana.co.za",
    "phone": "+27123456789"
  }
  ```
- **Requirements:**
  - Email must be from admin domain (`@spana.co.za` or configured domain)
- **Response:**
  ```json
  {
    "message": "Admin created successfully. Credentials email sent with auto-generated password.",
    "user": { ... }
  }
  ```
- **Status Codes:**
  - `201`: Admin created
  - `400`: Validation error, invalid email domain, or user exists
  - `401`: Unauthorized
  - `403`: Not an admin

---

## ⚙️ Admin Profile Management

### 23. **PUT `/admin/profile`**
- **Auth Required:** ✅ Yes (Admin)
- **Description:** Updates the authenticated admin's profile (firstName, lastName, phone, password).
- **Body:**
  ```json
  {
    "firstName": "Updated",
    "lastName": "Name",
    "phone": "+27987654321",
    "password": "NewSecurePassword123!"
  }
  ```
- **Password Requirements:**
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
- **Response:**
  ```json
  {
    "message": "Profile updated successfully",
    "user": { ... }
  }
  ```
- **Status Codes:**
  - `200`: Profile updated
  - `400`: Validation error or weak password
  - `401`: Unauthorized
  - `403`: Not an admin

---

## 📝 Summary

### Route Categories:
1. **Authentication & Verification** (2 routes) - No auth required
2. **OTP Authentication** (2 routes) - No auth required
3. **Document Verification** (2 routes) - Admin auth required
4. **Wallet Management** (2 routes) - Admin auth required
5. **Dashboard Data** (3 routes) - Admin auth required
6. **Service Management** (6 routes) - Admin auth required
7. **Provider Management** (1 route) - Admin auth required
8. **Complaints Management** (2 routes) - Admin auth required
9. **User Registration** (2 routes) - Admin auth required
10. **Profile Management** (1 route) - Admin auth required

### Total Routes: **23**

### Authentication Summary:
- **No Auth Required:** 4 routes (verification, OTP request/verify)
- **Admin Auth Required:** 19 routes (all CMS operations)

### Key Features:
- ✅ OTP-based admin login (email domain restricted)
- ✅ Admin can create other admins (auto-generated passwords)
- ✅ Admin can create service providers (profile completion flow)
- ✅ Full service CRUD operations
- ✅ Document verification workflow
- ✅ Complaints management
- ✅ Wallet/financial oversight
- ✅ Dashboard data aggregation

---

## 🔒 Security Notes

1. **Email Domain Restriction:** Admin operations require `@spana.co.za` email (or configured admin domains)
2. **OTP Expiry:** OTPs expire after 5 hours
3. **Token Expiry:** Admin tokens expire after 5 hours
4. **Password Requirements:** Strong password validation for admin profile updates
5. **Role-Based Access:** All CMS routes verify admin role via middleware

---

## 📧 Email Notifications

The following operations trigger email notifications:
- ✅ OTP request → OTP sent via email
- ✅ Admin registration → Credentials email with auto-generated password
- ✅ Service provider registration → Profile completion link email
- ✅ Admin verification → Verification email with link
