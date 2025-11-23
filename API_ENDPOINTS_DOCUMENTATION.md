# Spana Backend API Endpoints Documentation

Base URL: `http://localhost:5003` (or your deployed URL)

## Authentication

All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 📊 Public Stats Endpoints (No Auth Required)

### 1. Platform Statistics
**GET** `/stats/platform`

**Response:**
```json
{
  "users": {
    "total": 18,
    "providers": 8,
    "customers": 8,
    "activeProviders": 8
  },
  "services": {
    "total": 16
  },
  "bookings": {
    "total": 30,
    "completed": 6,
    "completionRate": "20.00"
  },
  "revenue": {
    "total": 4500.50
  }
}
```

---

### 2. Provider Statistics by Location
**GET** `/stats/providers/location`

**Response:**
```json
{
  "locations": [
    {
      "city": "Johannesburg",
      "providerCount": 5,
      "totalServices": 10,
      "completedBookings": 15,
      "averageRating": "4.25"
    },
    {
      "city": "Cape Town",
      "providerCount": 3,
      "totalServices": 6,
      "completedBookings": 8,
      "averageRating": "4.50"
    }
  ],
  "total": 2
}
```

---

### 3. Service Category Statistics
**GET** `/stats/services/categories`

**Response:**
```json
{
  "categories": [
    {
      "category": "Plumbing",
      "serviceCount": 4,
      "totalBookings": 12,
      "totalRevenue": 4800.00,
      "averagePrice": "400.00"
    },
    {
      "category": "Cleaning",
      "serviceCount": 3,
      "totalBookings": 8,
      "totalRevenue": 2400.00,
      "averagePrice": "300.00"
    },
    {
      "category": "Painting",
      "serviceCount": 2,
      "totalBookings": 5,
      "totalRevenue": 2000.00,
      "averagePrice": "400.00"
    }
  ],
  "total": 3
}
```

---

### 4. Booking Trends (Last 30 Days)
**GET** `/stats/bookings/trends`

**Response:**
```json
{
  "trends": [
    {
      "date": "2024-11-01",
      "total": 5,
      "completed": 2,
      "revenue": 1200.00
    },
    {
      "date": "2024-11-02",
      "total": 3,
      "completed": 1,
      "revenue": 600.00
    }
  ],
  "period": "30 days"
}
```

---

### 5. Top Performing Providers
**GET** `/stats/providers/top?limit=10`

**Query Parameters:**
- `limit` (optional): Number of providers to return (default: 10)

**Response:**
```json
{
  "providers": [
    {
      "id": "cmic7dnxz000j4e7ccw1ez6ny",
      "name": "John Doe",
      "email": "john.doe@provider.com",
      "rating": 4.8,
      "totalReviews": 25,
      "totalBookings": 45,
      "totalRevenue": 18000.00,
      "location": {
        "type": "Point",
        "coordinates": [28.0473, -26.2041],
        "address": "123 Main Street, Johannesburg"
      }
    }
  ],
  "limit": 10
}
```

---

### 6. Revenue Statistics
**GET** `/stats/revenue`

**Response:**
```json
{
  "total": {
    "revenue": 50000.00,
    "commission": 7500.00,
    "payouts": 42500.00
  },
  "byCategory": {
    "Plumbing": 20000.00,
    "Cleaning": 15000.00,
    "Painting": 10000.00,
    "Electrical": 5000.00
  },
  "commissionRate": "15.00"
}
```

---

## 🔐 Authentication Endpoints

### 1. Register User
**POST** `/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+27123456789",
  "role": "customer"
}
```

**Note:** To send welcome/verification emails, add `?sendEmails=true` to the URL or include `"sendEmails": true` in the body.

**Response (201):**
```json
{
  "message": "User created successfully. Please login to get your access token.",
  "user": {
    "_id": "cmic7dnxz000j4e7ccw1ez6ny",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+27123456789",
    "role": "customer",
    "isEmailVerified": false,
    "isPhoneVerified": false,
    "profileImage": "",
    "walletBalance": 0,
    "status": "active",
    "customerDetails": {
      "favouriteProviders": [],
      "totalBookings": 0,
      "ratingGivenAvg": 0
    },
    "createdAt": "2024-11-23T12:00:00.000Z",
    "updatedAt": "2024-11-23T12:00:00.000Z"
  }
}
```

---

### 2. Login (Customer/Provider)
**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "cmic7dnxz000j4e7ccw1ez6ny",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "customer",
    "isEmailVerified": true,
    "walletBalance": 0,
    "status": "active"
  }
}
```

**Note:** For admin users, this will return `requiresOTP: true` - see Admin OTP endpoints below.

---

### 3. Admin OTP Request
**POST** `/admin/otp/request`

**Request Body:**
```json
{
  "email": "admin@spana.co.za"
}
```

**Response (200):**
```json
{
  "message": "OTP sent to your email. Please check your inbox.",
  "expiresIn": "5 hours"
}
```

---

### 4. Admin OTP Verify
**POST** `/admin/otp/verify`

**Request Body:**
```json
{
  "email": "admin@spana.co.za",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "message": "OTP verified successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "cmic7dnxz000j4e7ccw1ez6ny",
    "email": "admin@spana.co.za",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin"
  },
  "expiresIn": "5 hours"
}
```

---

## 📅 Booking Endpoints

### 1. Create Booking (Customer Pays First)
**POST** `/bookings`
**Auth Required:** Yes (Customer)

**Request Body:**
```json
{
  "serviceId": "cmic7dnxz000j4e7ccw1ez6ny",
  "date": "2024-12-01T10:00:00.000Z",
  "time": "14:00",
  "location": {
    "type": "Point",
    "coordinates": [28.0473, -26.2041],
    "address": "123 Customer Street, Johannesburg"
  },
  "notes": "Please arrive on time",
  "jobSize": "medium"
}
```

**Response (201):**
```json
{
  "message": "Booking created. Payment required.",
  "booking": {
    "id": "cmic7dnxz000j4e7ccw1ez6ny",
    "status": "pending",
    "requestStatus": "pending",
    "paymentStatus": "pending",
    "calculatedPrice": 600.00,
    "basePrice": 500.00,
    "jobSizeMultiplier": 1.2,
    "estimatedDurationMinutes": 120
  },
  "paymentRequired": true,
  "amount": 600.00
}
```

---

### 2. Process Payment (Customer Pays First)
**POST** `/payments`
**Auth Required:** Yes (Customer)

**Request Body:**
```json
{
  "bookingId": "cmic7dnxz000j4e7ccw1ez6ny",
  "paymentMethod": "payfast",
  "amount": 600.00
}
```

**Response (201):**
```json
{
  "message": "Payment processed successfully. Booking confirmed.",
  "payment": {
    "id": "cmic7dnxz000j4e7ccw1ez6ny",
    "amount": 600.00,
    "currency": "ZAR",
    "status": "completed",
    "transactionId": "TXN1234567890",
    "escrowStatus": "held",
    "commissionAmount": 90.00,
    "providerPayout": 510.00
  },
  "booking": {
    "id": "cmic7dnxz000j4e7ccw1ez6ny",
    "status": "confirmed",
    "paymentStatus": "paid_to_escrow"
  }
}
```

**Note:** After payment, the booking is sent to providers for acceptance.

---

### 3. Provider Accept/Decline Booking
**PUT** `/bookings/:bookingId/respond`
**Auth Required:** Yes (Service Provider)

**Request Body (Accept):**
```json
{
  "action": "accept"
}
```

**Request Body (Decline):**
```json
{
  "action": "decline",
  "reason": "Schedule conflict"
}
```

**Response (200) - Accept:**
```json
{
  "message": "Booking accepted",
  "booking": {
    "id": "cmic7dnxz000j4e7ccw1ez6ny",
    "status": "confirmed",
    "requestStatus": "accepted",
    "providerAcceptedAt": "2024-11-23T12:00:00.000Z"
  }
}
```

**Response (200) - Decline:**
```json
{
  "message": "Booking declined",
  "booking": {
    "id": "cmic7dnxz000j4e7ccw1ez6ny",
    "status": "pending",
    "requestStatus": "declined",
    "providerDeclinedAt": "2024-11-23T12:00:00.000Z",
    "declineReason": "Schedule conflict"
  },
  "refund": {
    "status": "processing",
    "amount": 600.00,
    "estimatedTime": "3-5 business days"
  }
}
```

---

### 4. Cancel Booking
**PUT** `/bookings/:bookingId/cancel`
**Auth Required:** Yes (Customer or Provider)

**Request Body:**
```json
{
  "reason": "Change of plans"
}
```

**Response (200):**
```json
{
  "message": "Booking cancelled. Refund processing.",
  "booking": {
    "id": "cmic7dnxz000j4e7ccw1ez6ny",
    "status": "cancelled",
    "paymentStatus": "refunded"
  },
  "refund": {
    "status": "processing",
    "amount": 600.00,
    "refundMethod": "original_payment_method",
    "estimatedTime": "3-5 business days"
  }
}
```

---

### 5. Complete Booking
**PUT** `/bookings/:bookingId/complete`
**Auth Required:** Yes (Service Provider)

**Response (200):**
```json
{
  "message": "Booking completed",
  "booking": {
    "id": "cmic7dnxz000j4e7ccw1ez6ny",
    "status": "completed",
    "completedAt": "2024-11-23T14:30:00.000Z",
    "paymentStatus": "released_to_provider"
  },
  "payment": {
    "escrowStatus": "released",
    "providerPayout": 510.00
  }
}
```

---

### 6. Rate Booking
**POST** `/bookings/:bookingId/rate`
**Auth Required:** Yes (Customer)

**Request Body:**
```json
{
  "rating": 5,
  "review": "Excellent service! Very professional."
}
```

**Response (200):**
```json
{
  "message": "Rating submitted",
  "booking": {
    "id": "cmic7dnxz000j4e7ccw1ez6ny",
    "rating": 5,
    "review": "Excellent service! Very professional."
  }
}
```

---

## 👤 User Endpoints

### 1. Get Current User
**GET** `/auth/me`
**Auth Required:** Yes

**Response (200):**
```json
{
  "_id": "cmic7dnxz000j4e7ccw1ez6ny",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "customer",
  "isEmailVerified": true,
  "profileImage": "https://i.pravatar.cc/150?img=1",
  "walletBalance": 0,
  "status": "active"
}
```

---

### 2. Get Service Providers (Public)
**GET** `/users/providers`

**Query Parameters:**
- `category` (optional): Filter by service category
- `location` (optional): Filter by location (lat,lng)
- `radius` (optional): Search radius in km (default: 25)

**Response (200):**
```json
{
  "providers": [
    {
      "_id": "cmic7dnxz000j4e7ccw1ez6ny",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@provider.com",
      "profileImage": "https://i.pravatar.cc/150?img=1",
      "rating": 4.8,
      "totalReviews": 25,
      "skills": ["Plumbing", "Electrical"],
      "experienceYears": 8,
      "isOnline": true,
      "isVerified": true,
      "isProfileComplete": true,
      "location": {
        "type": "Point",
        "coordinates": [28.0473, -26.2041],
        "address": "123 Main Street, Johannesburg"
      }
    }
  ],
  "total": 8
}
```

---

## 🛠️ Service Endpoints

### 1. Get All Services (Public)
**GET** `/services`

**Query Parameters:**
- `category` (optional): Filter by category
- `providerId` (optional): Filter by provider
- `minPrice` (optional): Minimum price
- `maxPrice` (optional): Maximum price

**Response (200):**
```json
{
  "services": [
    {
      "id": "cmic7dnxz000j4e7ccw1ez6ny",
      "title": "Emergency Plumbing",
      "description": "Professional emergency plumbing services",
      "category": "Plumbing",
      "price": 500.00,
      "duration": 120,
      "mediaUrl": "https://example.com/services/plumbing.jpg",
      "status": "active",
      "adminApproved": true,
      "provider": {
        "id": "cmic7dnxz000j4e7ccw1ez6ny",
        "firstName": "John",
        "lastName": "Doe",
        "rating": 4.8,
        "totalReviews": 25
      }
    }
  ],
  "total": 16
}
```

---

### 2. Get Service by ID
**GET** `/services/:id`

**Response (200):**
```json
{
  "id": "cmic7dnxz000j4e7ccw1ez6ny",
  "title": "Emergency Plumbing",
  "description": "Professional emergency plumbing services",
  "category": "Plumbing",
  "price": 500.00,
  "duration": 120,
  "mediaUrl": "https://example.com/services/plumbing.jpg",
  "status": "active",
  "adminApproved": true,
  "provider": {
    "id": "cmic7dnxz000j4e7ccw1ez6ny",
    "firstName": "John",
    "lastName": "Doe",
    "rating": 4.8,
    "totalReviews": 25,
    "skills": ["Plumbing", "Electrical"],
    "experienceYears": 8
  },
  "bookings": {
    "total": 12,
    "completed": 8,
    "averageRating": 4.5
  }
}
```

---

## 💰 Payment Endpoints

### 1. Get Payment by Booking ID
**GET** `/payments/booking/:bookingId`
**Auth Required:** Yes (Customer or Provider)

**Response (200):**
```json
{
  "id": "cmic7dnxz000j4e7ccw1ez6ny",
  "amount": 600.00,
  "currency": "ZAR",
  "status": "completed",
  "transactionId": "TXN1234567890",
  "escrowStatus": "released",
  "commissionAmount": 90.00,
  "providerPayout": 510.00,
  "createdAt": "2024-11-23T12:00:00.000Z"
}
```

---

### 2. Process Refund
**POST** `/payments/:paymentId/refund`
**Auth Required:** Yes (Admin or Customer)

**Request Body:**
```json
{
  "reason": "Customer requested cancellation",
  "amount": 600.00
}
```

**Response (200):**
```json
{
  "message": "Refund processed",
  "refund": {
    "id": "cmic7dnxz000j4e7ccw1ez6ny",
    "amount": 600.00,
    "status": "processing",
    "refundMethod": "original_payment_method",
    "estimatedTime": "3-5 business days"
  },
  "payment": {
    "status": "refunded",
    "escrowStatus": "refunded"
  }
}
```

---

## 📋 Admin Endpoints

### 1. Get All Bookings
**GET** `/admin/bookings`
**Auth Required:** Yes (Admin)

**Query Parameters:**
- `status` (optional): Filter by status
- `dateFrom` (optional): Start date
- `dateTo` (optional): End date

**Response (200):**
```json
{
  "bookings": [
    {
      "id": "cmic7dnxz000j4e7ccw1ez6ny",
      "status": "completed",
      "date": "2024-11-23T14:00:00.000Z",
      "calculatedPrice": 600.00,
      "paymentStatus": "released_to_provider",
      "customer": {
        "firstName": "Alice",
        "lastName": "Cooper",
        "email": "alice@example.com"
      },
      "service": {
        "title": "Emergency Plumbing",
        "category": "Plumbing"
      },
      "provider": {
        "firstName": "John",
        "lastName": "Doe"
      }
    }
  ],
  "total": 30
}
```

---

### 2. Get Pending Documents
**GET** `/admin/documents/pending`
**Auth Required:** Yes (Admin)

**Response (200):**
```json
{
  "documents": [
    {
      "id": "cmic7dnxz000j4e7ccw1ez6ny",
      "type": "id_picture",
      "url": "https://example.com/uploads/id.jpg",
      "verified": false,
      "provider": {
        "id": "cmic7dnxz000j4e7ccw1ez6ny",
        "user": {
          "firstName": "John",
          "lastName": "Doe",
          "email": "john.doe@provider.com"
        }
      },
      "verification": {
        "status": "pending",
        "provider": "datanamix"
      }
    }
  ],
  "total": 5
}
```

---

### 3. Verify Document
**PUT** `/admin/documents/:docId/verify`
**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "verified": true,
  "notes": "Document verified via Datanamix"
}
```

**Response (200):**
```json
{
  "message": "Document verification updated",
  "document": {
    "id": "cmic7dnxz000j4e7ccw1ez6ny",
    "verified": true,
    "verifiedBy": "admin_user_id",
    "verifiedAt": "2024-11-23T12:00:00.000Z"
  }
}
```

---

### 4. Activate Service Provider
**PUT** `/admin/providers/:providerId/activate`
**Auth Required:** Yes (Admin)

**Response (200):**
```json
{
  "message": "Provider activated successfully",
  "provider": {
    "id": "cmic7dnxz000j4e7ccw1ez6ny",
    "applicationStatus": "active",
    "isVerified": true,
    "isIdentityVerified": true,
    "isProfileComplete": true
  }
}
```

---

## 🚨 Complaint Endpoints

### 1. File Complaint
**POST** `/complaints`
**Auth Required:** Yes (Customer or Provider)

**Request Body:**
```json
{
  "bookingId": "cmic7dnxz000j4e7ccw1ez6ny",
  "type": "service_quality",
  "severity": "high",
  "title": "Poor service quality",
  "description": "The service provider did not complete all tasks as promised.",
  "attachments": ["https://example.com/evidence.jpg"]
}
```

**Response (201):**
```json
{
  "message": "Complaint filed successfully",
  "complaint": {
    "id": "cmic7dnxz000j4e7ccw1ez6ny",
    "type": "service_quality",
    "severity": "high",
    "status": "open",
    "createdAt": "2024-11-23T12:00:00.000Z"
  }
}
```

---

### 2. Get Complaints
**GET** `/complaints`
**Auth Required:** Yes

**Response (200):**
```json
{
  "complaints": [
    {
      "id": "cmic7dnxz000j4e7ccw1ez6ny",
      "type": "service_quality",
      "severity": "high",
      "status": "open",
      "title": "Poor service quality",
      "description": "The service provider did not complete all tasks.",
      "booking": {
        "id": "cmic7dnxz000j4e7ccw1ez6ny",
        "service": {
          "title": "Emergency Plumbing"
        }
      },
      "createdAt": "2024-11-23T12:00:00.000Z"
    }
  ],
  "total": 2
}
```

---

## Error Responses

All endpoints may return these error responses:

**400 Bad Request:**
```json
{
  "message": "Validation error",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
```

**401 Unauthorized:**
```json
{
  "message": "Access denied. No token provided."
}
```

**403 Forbidden:**
```json
{
  "message": "Access denied. Insufficient permissions."
}
```

**404 Not Found:**
```json
{
  "message": "Resource not found"
}
```

**500 Internal Server Error:**
```json
{
  "message": "Server error"
}
```

---

## Notes

1. **Email Sending:** Emails are only sent when `sendEmails=true` is included in registration requests or when explicitly calling email endpoints.

2. **Payment Flow:** Customers must pay first before a booking is sent to providers for acceptance.

3. **Cancellations:** When a booking is cancelled, refunds are automatically processed (3-5 business days).

4. **Admin OTP:** Admin login requires OTP verification. OTP expires in 5 hours, and admin tokens also expire in 5 hours.

5. **Provider Profiles:** All providers have 100% complete profiles with verified documents.

