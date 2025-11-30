Spana Backend - API Reference

Base URL
- Local development: http://localhost:5003

Auth Overview
- Authentication uses JWT (Bearer tokens) issued on successful register/login
- Include header for protected routes: Authorization: Bearer <JWT>
- Email is sent on registration (welcome; provider verification if role=service provider)

Roles
- customer: consumers booking services
- service provider: providers offering services
- admin / System_admin: elevated privileges for admin endpoints

User Model Fields (subset relevant to auth)
- Common: _id, email, firstName, lastName, phone, role, profileImage, location, walletBalance, status, paymentMethods, createdAt, updatedAt
- Verification flags: isEmailVerified, isPhoneVerified, isIdentityVerified (provider)
- Analytics: lastLoginAt
- Customer-only: customerDetails { favouriteProviders[], totalBookings, ratingGivenAvg }
- Provider-only: skills[], experienceYears, isOnline, documents[], rating, totalReviews, availability { days[], hours{start,end} }, serviceArea { radiusInKm, baseLocation Point }

Endpoints

1) Register
- POST /auth/register
- Public

Request (JSON)
{
  "email": "user@example.com",
  "password": "Passw0rd!",
  "firstName": "First",
  "lastName": "Last",
  "phone": "+15551234567",
  "role": "customer" // or "service provider"
}

Responses
- 201 Created
  - customer: returns token and customer-shaped user (no provider-only fields), includes customerDetails
  - service provider: returns token and provider-shaped user; sends verification email

Example (customer)
{
  "message": "User created successfully",
  "token": "<JWT>",
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "firstName": "First",
    "lastName": "Last",
    "phone": "+15551234567",
    "role": "customer",
    "isVerified": false,
    "isEmailVerified": false,
    "isPhoneVerified": false,
    "profileImage": "",
    "location": { "type": "Point", "coordinates": [0,0] },
    "walletBalance": 0,
    "status": "active",
    "paymentMethods": [],
    "customerDetails": { "favouriteProviders": [], "totalBookings": 0, "ratingGivenAvg": 0 },
    "createdAt": "...",
    "updatedAt": "...",
    "__v": 0
  }
}

Example (service provider)
{
  "message": "User created successfully",
  "token": "<JWT>",
  "user": {
    "_id": "...",
    "email": "sp@example.com",
    "firstName": "First",
    "lastName": "Last",
    "phone": "+15551234567",
    "role": "service provider",
    "isVerified": false,
    "isEmailVerified": false,
    "isPhoneVerified": false,
    "isIdentityVerified": false,
    "profileImage": "",
    "skills": [],
    "experienceYears": 0,
    "isOnline": false,
    "documents": [],
    "rating": 0,
    "totalReviews": 0,
    "availability": { "days": [], "hours": {"start":"","end":""} },
    "serviceArea": { "radiusInKm": 0, "baseLocation": {"type":"Point","coordinates":[0,0]} },
    "location": { "type": "Point", "coordinates": [0,0] },
    "walletBalance": 0,
    "status": "active",
    "paymentMethods": [],
    "createdAt": "...",
    "updatedAt": "...",
    "__v": 0
  }
}

Errors
- 400: validation errors or duplicate email
- 500: server error

Notes
- Provider registrations trigger a verification email to complete provider verification.

2) Login
- POST /auth/login
- Public

Request (JSON)
{
  "email": "user@example.com",
  "password": "Passw0rd!"
}

Responses
- 200 OK: returns token and role-shaped user (same shapes as register)
- Side effects: updates lastLoginAt; logs an Activity(login)

Errors
- 400: invalid credentials
- 500: server error

3) Get Current User ("me")
- GET /auth/me
- Protected (Authorization header required)

Headers
- Authorization: Bearer <JWT>

Response
- 200 OK: returns role-shaped user (complete profile with role-specific fields)
  - Customer: includes customerDetails
  - Service Provider: includes skills, experienceYears, isOnline, rating, availability, serviceArea, etc.
  - Admin: excludes walletBalance
- 401: missing/invalid token
- 404: user not found

4) Update Current User Profile
- PUT /auth/profile OR PATCH /auth/profile
- Protected (Authorization header required)
- Supports partial updates - only send fields you want to update

Headers
- Authorization: Bearer <JWT>

Request Body (all fields optional, send only what you want to update)
```json
{
  "firstName": "Updated First Name",
  "lastName": "Updated Last Name",
  "phone": "+15551234567",
  "location": { "type": "Point", "coordinates": [-26.2041, 28.0473] },
  "profileImage": "/uploads/profile-image.jpg",
  "customerDetails": {
    "favouriteProviders": ["provider-id-1", "provider-id-2"]
  },
  "providerDetails": {
    "skills": ["Plumbing", "Electrical"],
    "experienceYears": 5,
    "isOnline": true,
    "availability": {
      "days": ["Monday", "Tuesday", "Wednesday"],
      "hours": { "start": "08:00", "end": "17:00" }
    },
    "serviceArea": {
      "radiusInKm": 25,
      "baseLocation": { "type": "Point", "coordinates": [-26.2041, 28.0473] }
    },
    "isProfileComplete": true
  }
}
```

Note: For service providers, you can also use direct fields (backward compatible):
```json
{
  "skills": ["Plumbing", "Electrical"],
  "experienceYears": 5,
  "isOnline": true,
  "availability": {...},
  "serviceArea": {...}
}
```

Response
- 200 OK: returns updated role-shaped user (same format as GET /auth/me)
- 400: validation errors
- 401: missing/invalid token
- 404: user not found
- 500: server error

5) Upload Profile Image
- POST /auth/profile/image OR POST /uploads/profile
- Protected (Authorization header required)
- Content-Type: multipart/form-data

Headers
- Authorization: Bearer <JWT>

Request Body (form-data)
- Key: "image" (for /auth/profile/image) or "avatar" (for /uploads/profile)
- Value: Image file (max 5MB)

Response
- 200 OK: 
```json
{
  "message": "Profile image uploaded successfully",
  "url": "/uploads/profile-1234567890.jpg",
  "user": { /* full user object */ }
}
```
- 400: no file uploaded or invalid file type
- 401: missing/invalid token
- 500: server error

6) Get User by ID
- GET /users/:id
- Protected (Authorization header required)

Headers
- Authorization: Bearer <JWT>

Response
- 200 OK: returns user profile (excludes walletBalance for admin users)
- 401: missing/invalid token
- 404: user not found

7) Update User by ID
- PUT /users/:id
- Protected (Authorization header required)
- Can only update own profile unless you're an admin

Headers
- Authorization: Bearer <JWT>

Request Body: Same as PUT /auth/profile (supports all profile fields)

Response
- 200 OK: returns updated user
- 403: not authorized (can only update own profile unless admin)
- 404: user not found

8) Verify Provider (Admin)
- POST /users/verify
- Protected (admin/System_admin)

Headers
- Authorization: Bearer <ADMIN_JWT>

Request (JSON)
{
  "userId": "<provider_user_id>",
  "token": "<verification_token_from_email>"
}

Response
- 200 OK: { message: "Provider verified", user: { _id, isVerified: true } }
- 400: invalid/expired token
- 404: provider not found

SMTP & Emails
- Welcome email on all registrations
- Provider verification email on provider registration
- Configure environment variables for SMTP:
  - SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM

JWT
- Sign secret: JWT_SECRET
- Expiry: JWT_EXPIRES_IN (default 7d)

Environment Variables (auth-related)
- JWT_SECRET, JWT_EXPIRES_IN
- CLIENT_URL (used to build verification link)
- SMTP_* variables (for email sending)

Examples (curl)
Register customer
curl -X POST http://localhost:5003/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer1@example.com",
    "password": "Passw0rd!",
    "firstName": "Casey",
    "lastName": "Customer",
    "phone": "+15557654321",
    "role": "customer"
  }'

Login
curl -X POST http://localhost:5003/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer1@example.com",
    "password": "Passw0rd!"
  }'

Get me
curl -X GET http://localhost:5003/auth/me \
  -H "Authorization: Bearer <JWT>"

Admin verify provider
curl -X POST http://localhost:5003/users/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -d '{
    "userId": "<PROVIDER_USER_ID>",
    "token": "<VERIFICATION_TOKEN>"
  }'

Status Codes Summary
- 200 OK: success
- 201 Created: resource created
- 400 Bad Request: validation/auth errors
- 401 Unauthorized: missing/invalid token
- 403 Forbidden: insufficient role/rights
- 404 Not Found: resource missing
- 500 Internal Server Error: unexpected failure

Payments
- Base path: /payments

Create payment intent
- POST /payments/intent (auth)
- Request: { bookingId, amount, currency, paymentMethod }
- Response: { id, client_secret, amount, currency, paymentMethod }

Confirm payment (creates Payment, updates Booking -> confirmed, sends receipts)
- POST /payments/confirm (auth)
- Request: { paymentIntentId, bookingId, amount, paymentMethod, currency }
- Response: { message: "Payment confirmed", payment }

Payment history
- GET /payments/history (auth)
- Response: array of Payment records with populated booking and service

Refund payment
- POST /payments/refund (auth)
- Request: { paymentId }
- Response: { message: "Payment refunded", payment }

Notifications
- Base path: /notifications

List my notifications
- GET /notifications (auth)
- Response: array of Notification

Mark notification as read
- POST /notifications/:id/read (auth)
- Response: updated Notification

Activities
- Base path: /activities

List my activity
- GET /activities?limit=50 (auth)
- Response: array of Activity sorted by most recent

Bookings (SLA, live tracking)
- Base path: /bookings

Create booking
- POST /bookings (auth)
- Request: { serviceId, date, time, location, notes, estimatedDurationMinutes }
- Response: Booking

Get my bookings
- GET /bookings (auth)
- Response: array of Booking

Get booking by id
- GET /bookings/:id (auth)

Update status
- PUT /bookings/:id/status (auth)
- Request: { status: 'pending'|'confirmed'|'in_progress'|'completed'|'cancelled' }

Cancel
- PUT /bookings/:id/cancel (auth)

Rate booking
- POST /bookings/:id/rate (auth)
- Request: { rating, review }

Start booking (provider)
- POST /bookings/:id/start (auth)
- Response: Booking (status=in_progress, startedAt set)

Complete booking (provider)
- POST /bookings/:id/complete (auth)
- Response: Booking (status=completed, completedAt set, slaBreached calculated if estimate provided)

Update live location
- POST /bookings/:id/location (auth)
- Request: { coordinates: [lng, lat] } (customer or provider updates their own live location)

Realtime (Socket.io)
- Connect and authenticate client-side.
- Join a booking room: emit 'join-booking' with { bookingId }
- Chat within booking: emit 'booking-chat' with { bookingId, message }
- Live location broadcast: emit 'booking-location' with { bookingId, role, coordinates }
- Server broadcasts to room subscribers for tracking and chat.

Services (search)
- Base path: /services

List/search services
- GET /services?q=<text>
- Response: array of services; search matches title/description

Provider profile completeness (gatekeeper)
- A service provider must have a complete profile before creating/updating/deleting services or starting/completing bookings.
- The following must be true for isProfileComplete=true:
  - profileImage present
  - skills has at least 1 entry
  - experienceYears > 0
  - at least one verified document (documents[].verified=true)
  - isEmailVerified, isPhoneVerified, isIdentityVerified are true
  - availability.days has entries and availability.hours has start/end
  - serviceArea.radiusInKm > 0 and baseLocation set (non-zero coordinates)

Protected routes requiring profile completeness
- POST /services (providerReady)
- PUT /services/:id (providerReady)
- DELETE /services/:id (providerReady)
- POST /bookings/:id/start (providerReady)
- POST /bookings/:id/complete (providerReady)

Uploads (profile images & provider documents)
- Base path: /uploads

Upload profile image
- POST /uploads/profile (auth)
- Body: form-data with key: avatar (File)
- Response: { message, url }

Upload provider documents (images/PDF)
- POST /uploads/documents (auth)
- Body: form-data with key: documents (File) — you can attach up to 5
- Response: { message, documents: [{ _id, type, url, verified:false }] }

Verify provider document (admin)
- POST /uploads/documents/:docId/verify (admin)
- Body: { userId, verified: true|false }
- Effect: toggles doc verified; updates user.isIdentityVerified if any doc is verified

Delete provider document
- DELETE /uploads/documents/:docId (auth provider)
- Effect: removes DB entry and deletes the file from disk if present

Caching
- Services GET responses cached for 5 minutes
- In local dev, Redis is disabled by default and an in-memory TTL cache is used
- Control via env: USE_REDIS=true to enable Redis; otherwise shows redis: disabled in /health

Data hygiene and role separation
- Role-based update sanitization: PUT /users/:id only applies fields valid for the user role
- Cleanup script to fix historical data pollution:
  - Run: npm run cleanup:users
  - Removes provider-only fields from customers and customer-only fields from providers/admins

Users

Base Path: /users

- GET / (admin)
  - Headers: Authorization: Bearer <ADMIN_JWT>
  - Description: List all users (sans password)
  - Responses: 200 array of users

- GET /:id (auth)
  - Headers: Authorization: Bearer <JWT>
  - Description: Get profile by user id
  - Responses: 200 user, 404 if not found

- PUT /:id (auth)
  - Headers: Authorization: Bearer <JWT>
  - Description: Update own profile (or admin can update any)
  - Body (any subset): { firstName, lastName, phone, location, skills, profileImage }
  - Responses: 200 updated user

- DELETE /:id (admin)
  - Headers: Authorization: Bearer <ADMIN_JWT>
  - Responses: 200 { message }

- GET /providers/all (public)
  - Description: List verified providers
  - Responses: 200 array of providers


- POST /verify (admin)
  - Headers: Authorization: Bearer <ADMIN_JWT>
  - Body: { userId, token }
  - Description: Verify provider using email token
  - Responses: 200 { message, user: { _id, isVerified: true } }

Services

Base Path: /services

- GET /
  - Description: List services (cached 5m). Add any query string to bypass warm cache during dev.
  - Responses: 200 array of services

- GET /:id
  - Description: Get a single service
  - Responses: 200 service, 404 if not found

- POST / (auth provider)
  - Headers: Authorization: Bearer <PROVIDER_JWT>
  - Body: { title, description, category, price, duration, mediaUrl?, status? }
  - Responses: 201 created service

- PUT /:id (auth provider/admin)
  - Headers: Authorization: Bearer <JWT>
  - Body: { title?, description?, category?, price?, duration?, mediaUrl?, status? }
  - Responses: 200 updated service

- DELETE /:id (auth provider/admin)
  - Responses: 200 { message }


Bookings

Base Path: /bookings

- POST / (auth customer)
  - Headers: Authorization: Bearer <CUSTOMER_JWT>
  - Body: { serviceId, date, time, location, notes? }
  - Responses: 201 booking created (Activity booking_create logged)

- GET / (auth)
  - Description: List bookings for current user; providers see bookings for their services; admins see all
  - Responses: 200 array of bookings

- GET /:id (auth)
  - Description: Get one booking if involved (customer or the service provider) or admin

- PUT /:id/status (auth customer/provider)
  - Body: { status } where status in [pending, confirmed, in_progress, completed, cancelled]
  - Responses: 200 updated booking (Activity booking_update logged)

- PUT /:id/cancel (auth customer/provider)
  - Responses: 200 updated booking with status=cancelled (Activity booking_cancel logged)

- POST /:id/rate (auth customer)
  - Body: { rating: 1..5, review? }
  - Responses: 200 booking rated; provider rating recalculated

Payments

Base Path: /payments

- POST /intent (auth)
  - Simulates payment intent
  - Body: { bookingId, amount, currency, paymentMethod }
  - Responses: 200 simulated intent { id, client_secret, ... }

- POST /confirm (auth)
  - Body: { paymentIntentId, bookingId, amount, paymentMethod, currency }
  - Side effects: creates Payment, sets Booking.status=confirmed, logs Activity(payment_confirm), emails receipts to customer and provider
  - Responses: 200 { message, payment }

- GET /history (auth)
  - Description: Payment history for current user
  - Responses: 200 array of payments (with booking and service nested)

- POST /refund (auth)
  - Body: { paymentId }
  - Side effects: marks payment refunded, sets booking cancelled, logs Activity(payment_refund)
  - Responses: 200 { message, payment }

Notifications

Base Path: /notifications

- GET / (auth)
  - Returns notifications for current user (newest first)

- POST /:id/read (auth)
  - Marks a notification as read

Authorization Summary
- Use Authorization: Bearer <JWT> where required
- Admin endpoints accept role "admin" or "System_admin"

Environment Summary
- PORT, NODE_ENV, CLIENT_URL
- MONGODB_URI
- JWT_SECRET, JWT_EXPIRES_IN
- USE_REDIS ("true" to enable Redis); REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
- SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM

Changelog (Auth-related)
- Role-shaped responses for register/login/me
- Provider verification flow via emailed token
- lastLoginAt tracked on successful login
- In-memory cache fallback for services when Redis disabled


