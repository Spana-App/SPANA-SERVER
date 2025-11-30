# SPANA Database Schema Documentation

## Overview
SPANA uses PostgreSQL with Prisma ORM. The database is designed to support a marketplace platform connecting customers with service providers.

---

## Core Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER (Base Entity)                            │
│  id, email, password, firstName, lastName, phone, role,                │
│  profileImage, location, walletBalance, status, etc.                    │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
        ┌───────────▼──────────┐  ┌──────▼──────────────┐
        │     CUSTOMER        │  │ SERVICE_PROVIDER    │
        │  - favouriteProviders│  │ - skills[]          │
        │  - totalBookings    │  │ - experienceYears   │
        │  - ratingGivenAvg   │  │ - rating            │
        └─────────────────────┘  │ - availability      │
                    │             │ - serviceArea       │
                    │             │ - isVerified        │
                    │             └──────────────────────┘
                    │                       │
                    │                       │
        ┌───────────▼──────────┐  ┌─────────▼──────────┐
        │      BOOKING         │  │      SERVICE        │
        │  - date, time        │  │  - title            │
        │  - location          │  │  - description     │
        │  - status            │  │  - category        │
        │  - calculatedPrice   │  │  - price           │
        │  - paymentStatus     │  │  - duration        │
        └──────────────────────┘  │  - adminApproved   │
                    │             └─────────────────────┘
                    │                       │
                    │                       │
        ┌───────────▼──────────┐  ┌─────────▼──────────┐
        │      PAYMENT         │  │ SERVICE_WORKFLOW    │
        │  - amount            │  │  - steps (JSON)     │
        │  - escrowStatus      │  └─────────────────────┘
        │  - commissionAmount  │
        └──────────────────────┘
```

---

## Detailed Table Relationships

### 1. **USER** (Base User Model)
**Purpose**: Central authentication and profile entity for all user types.

**Key Fields**:
- `id` (String, Primary Key)
- `email` (String, Unique)
- `password` (String, Hashed)
- `role` (String): `'customer'`, `'service_provider'`, or `'admin'`
- `profileImage`, `location` (JSON), `walletBalance`, `status`

**Relationships**:
- **One-to-One** with `Customer` (if role = 'customer')
- **One-to-One** with `ServiceProvider` (if role = 'service_provider')
- **One-to-Many** with `Notification[]`
- **One-to-Many** with `Activity[]`

**Notes**:
- All users share common fields (email, password, profile, etc.)
- Role-specific data is stored in separate tables for data normalization

---

### 2. **CUSTOMER** (Customer-Specific Data)
**Purpose**: Stores customer-specific information and preferences.

**Key Fields**:
- `id` (String, Primary Key)
- `userId` (String, Foreign Key → User.id, Unique)
- `favouriteProviders` (String[]): Array of provider user IDs
- `totalBookings` (Int)
- `ratingGivenAvg` (Float): Average rating customer gives to providers

**Relationships**:
- **Many-to-One** with `User` (via `userId`)
- **One-to-Many** with `Booking[]`
- **One-to-Many** with `Payment[]`

**How it's created**:
- Automatically created when a user registers with `role: 'customer'`
- See `authController.register()` → creates `Customer` record after `User` creation

---

### 3. **SERVICE_PROVIDER** (Provider-Specific Data)
**Purpose**: Stores service provider business information, skills, and verification status.

**Key Fields**:
- `id` (String, Primary Key)
- `userId` (String, Foreign Key → User.id, Unique)
- `skills` (String[]): e.g., ["Plumbing", "Electrical"]
- `experienceYears` (Int)
- `rating` (Float): Average rating from customers
- `isVerified` (Boolean): Admin-verified provider
- `isIdentityVerified` (Boolean): ID documents verified
- `availability` (JSON): `{ days: string[], hours: { start, end } }`
- `serviceAreaRadius` (Float): Service coverage radius in km
- `serviceAreaCenter` (JSON): `{ type: "Point", coordinates: [lng, lat] }`
- `isProfileComplete` (Boolean): All required fields filled

**Relationships**:
- **Many-to-One** with `User` (via `userId`)
- **One-to-Many** with `Service[]`
- **One-to-Many** with `Document[]`
- **One-to-Many** with `ProviderPayout[]`
- **Optional** with `ServiceProviderApplication` (via `applicationId`)

**How it's created**:
- Automatically created when a user registers with `role: 'service_provider'`
- See `authController.register()` → creates `ServiceProvider` record after `User` creation

---

### 4. **SERVICE** (Service Listings)
**Purpose**: Services offered by providers (e.g., "Plumbing Repair", "Electrical Installation").

**Key Fields**:
- `id` (String, Primary Key)
- `title` (String): e.g., "Emergency Plumbing Repair"
- `description` (String)
- `category` (String): e.g., "Plumbing", "Electrical"
- `price` (Float): Base price in ZAR
- `duration` (Int): Estimated duration in minutes
- `mediaUrl` (String?): Image/video URL
- `status` (String): `'draft'`, `'pending_approval'`, `'active'`, `'archived'`
- `adminApproved` (Boolean): Must be `true` for customers to see
- `approvedBy` (String?): Admin user ID who approved
- `approvedAt` (DateTime?): When approved
- `rejectionReason` (String?): If admin rejects

**Relationships**:
- **Many-to-One** with `ServiceProvider` (via `providerId`)
- **One-to-Many** with `Booking[]`
- **One-to-Many** with `ServiceWorkflow[]`
- **One-to-Many** with `Complaint[]`

**How Services are Added**:

1. **Provider creates service**:
   ```typescript
   POST /services
   Headers: Authorization: Bearer <PROVIDER_JWT>
   Body: {
     "title": "Plumbing Repair",
     "description": "Fast and reliable plumbing services",
     "category": "Plumbing",
     "price": 500.00,
     "duration": 60,
     "mediaUrl": "https://..."
   }
   ```

2. **Backend flow** (`serviceController.createService`):
   ```typescript
   // 1. Find the ServiceProvider record for the authenticated user
   const serviceProvider = await prisma.serviceProvider.findUnique({
     where: { userId: req.user.id }
   });
   
   // 2. Create the Service record linked to the provider
   const service = await prisma.service.create({
     data: {
       title, description, category, price, duration,
       providerId: serviceProvider.id,  // ← Links to ServiceProvider
       status: 'active'
     }
   });
   ```

3. **Service approval flow**:
   - Service is created with `adminApproved: false` by default
   - Admin must approve via `POST /admin/services/:id/approve`
   - Only `adminApproved: true` services are visible to customers
   - See `adminController.approveService()` for approval logic

**Service Visibility Rules**:
- **Customers**: Only see `adminApproved: true` AND `status: 'active'` services
- **Providers**: See their own services (all statuses) + approved services from others
- **Admins**: See all services regardless of status

---

### 5. **BOOKING** (Service Bookings)
**Purpose**: Represents a customer's booking request for a service.

**Key Fields**:
- `id` (String, Primary Key)
- `date` (DateTime)
- `time` (String)
- `location` (JSON): `{ type: "Point", coordinates: [lng, lat], address: string }`
- `status` (String): `'pending'`, `'confirmed'`, `'in_progress'`, `'completed'`, `'cancelled'`
- `requestStatus` (String): `'pending'`, `'accepted'`, `'declined'`, `'expired'` (Uber-style)
- `paymentStatus` (String): `'pending'`, `'paid_to_escrow'`, `'released_to_provider'`, `'refunded'`
- `calculatedPrice` (Float): Final price after job size multiplier
- `jobSize` (String?): `'small'`, `'medium'`, `'large'`, `'custom'`
- `escrowAmount` (Float?): Amount held in escrow
- `rating`, `review` (Int?, String?): Customer's rating of provider
- `customerRating`, `customerReview` (Int?, String?): Provider's rating of customer

**Relationships**:
- **Many-to-One** with `Customer` (via `customerId`)
- **Many-to-One** with `Service` (via `serviceId`)
- **One-to-One** with `Payment` (via `bookingId`)
- **One-to-Many** with `Complaint[]`

**Booking Flow**:
1. Customer creates booking → `POST /bookings` → Status: `'pending_payment'`
2. Customer pays → Payment goes to escrow → Status: `'pending'` (waiting for provider)
3. Provider accepts/declines → Status: `'confirmed'` or `'declined'`
4. Provider starts job → Status: `'in_progress'`
5. Provider completes → Status: `'completed'` → Payment released from escrow

---

### 6. **PAYMENT** (Payment Transactions)
**Purpose**: Tracks payments for bookings with escrow support.

**Key Fields**:
- `id` (String, Primary Key)
- `amount` (Float)
- `currency` (String): Default `'ZAR'`
- `paymentMethod` (String): `'payfast'`, `'wallet'`, `'mobile_money'`
- `status` (String): `'pending'`, `'completed'`, `'failed'`, `'refunded'`
- `escrowStatus` (String): `'held'`, `'released'`, `'refunded'`
- `commissionRate` (Float): Default 0.15 (15%)
- `commissionAmount` (Float?): Platform commission
- `providerPayout` (Float?): Amount paid to provider after commission

**Relationships**:
- **Many-to-One** with `Customer` (via `customerId`)
- **One-to-One** with `Booking` (via `bookingId`, Unique)

**Payment Flow**:
1. Customer pays → Payment created with `escrowStatus: 'held'`
2. Booking completed → Admin releases funds → `escrowStatus: 'released'`
3. Commission deducted → `providerPayout = amount - commissionAmount`

---

### 7. **DOCUMENT** (Provider Verification Documents)
**Purpose**: Stores provider identity/qualification documents for verification.

**Key Fields**:
- `id` (String, Primary Key)
- `type` (String): `'id_number'`, `'id_picture'`, `'license'`, `'certification'`, etc.
- `url` (String): File URL
- `verified` (Boolean): Admin-verified status
- `verifiedBy` (String?): Admin user ID
- `verifiedAt` (DateTime?)
- `rejectionReason` (String?)

**Relationships**:
- **Many-to-One** with `ServiceProvider` (via `providerId`)
- **One-to-One** with `DocumentVerification` (optional)

**How Documents are Added**:
1. Provider uploads → `POST /uploads/documents` (form-data with files)
2. Document record created with `verified: false`
3. Admin verifies → `POST /uploads/documents/:docId/verify` → Sets `verified: true`
4. If any document verified → `ServiceProvider.isIdentityVerified = true`

---

### 8. **SERVICE_WORKFLOW** (Booking Workflow Steps)
**Purpose**: Tracks workflow steps for a service (e.g., "Booking Created", "Provider Assigned", "Service Completed").

**Key Fields**:
- `id` (String, Primary Key)
- `name` (String): Workflow name
- `description` (String?)
- `steps` (JSON): Array of step objects with status
- `isActive` (Boolean)

**Relationships**:
- **Many-to-One** with `Service` (via `serviceId`)

**Example steps JSON**:
```json
[
  { "name": "Booking Request Created", "status": "completed" },
  { "name": "Provider Assigned", "status": "pending" },
  { "name": "Payment Received", "status": "pending" },
  { "name": "Service In Progress", "status": "pending" },
  { "name": "Service Completed", "status": "pending" }
]
```

---

### 9. **COMPLAINT** (Issue/Complaint Tracking)
**Purpose**: Tracks complaints from customers or providers about bookings/services.

**Key Fields**:
- `id` (String, Primary Key)
- `bookingId` (String, Foreign Key → Booking.id)
- `serviceId` (String?, Foreign Key → Service.id)
- `reportedBy` (String): User ID
- `reportedByRole` (String): `'customer'` or `'service_provider'`
- `type` (String): `'service_quality'`, `'behavior'`, `'payment'`, `'sla_breach'`, `'other'`
- `severity` (String): `'low'`, `'medium'`, `'high'`, `'critical'`
- `status` (String): `'open'`, `'investigating'`, `'resolved'`, `'dismissed'`

**Relationships**:
- **Many-to-One** with `Booking` (via `bookingId`)
- **Many-to-One** with `Service` (via `serviceId`, optional)

---

### 10. **NOTIFICATION** (User Notifications)
**Purpose**: In-app notifications for users.

**Key Fields**:
- `id` (String, Primary Key)
- `message` (String)
- `type` (String): `'system'`, `'reminder'`, `'promo'`
- `status` (String): `'sent'`, `'read'`, `'unread'`

**Relationships**:
- **Many-to-One** with `User` (via `userId`)

---

### 11. **ACTIVITY** (Activity Log)
**Purpose**: Audit log of user actions.

**Key Fields**:
- `id` (String, Primary Key)
- `actionType` (String): `'register'`, `'login'`, `'service_create'`, `'booking_create'`, etc.
- `contentId` (String?): Related entity ID
- `contentModel` (String?): Entity type
- `details` (JSON?): Additional data

**Relationships**:
- **Many-to-One** with `User` (via `userId`)

---

### 12. **ADMIN_VERIFICATION** (Admin Account Verification)
**Purpose**: Tracks admin email verification status.

**Key Fields**:
- `id` (String, Primary Key)
- `adminEmail` (String, Unique)
- `verified` (Boolean)
- `verifiedAt` (DateTime?)
- `verifiedBy` (String?): Admin ID who verified

**How it works**:
- Created when admin registers (email ending in `@spana.co.za`)
- Admin must verify via OTP link
- See `authController.register()` and `adminController.verifyAdmin()`

---

### 13. **ADMIN_OTP** (Admin OTP Sessions)
**Purpose**: Stores OTP codes for password-less admin login.

**Key Fields**:
- `id` (String, Primary Key)
- `adminEmail` (String)
- `otp` (String): 6-digit code
- `expiresAt` (DateTime): 5 hours from creation
- `used` (Boolean)
- `usedAt` (DateTime?)

**Index**: `[adminEmail, otp]` for fast lookups

---

### 14. **SPANA_WALLET** (Escrow Account)
**Purpose**: Platform escrow wallet tracking.

**Key Fields**:
- `id` (String, Primary Key)
- `totalHeld` (Float): Total funds in escrow
- `totalReleased` (Float): Total released to providers
- `totalCommission` (Float): Total commission earned

**Relationships**:
- **One-to-Many** with `WalletTransaction[]`

---

### 15. **WALLET_TRANSACTION** (Escrow Transactions)
**Purpose**: Transaction log for escrow wallet.

**Key Fields**:
- `id` (String, Primary Key)
- `walletId` (String, Foreign Key → SpanaWallet.id)
- `type` (String): `'deposit'`, `'release'`, `'commission'`, `'refund'`
- `amount` (Float)
- `bookingId` (String?)
- `paymentId` (String?)

**Relationships**:
- **Many-to-One** with `SpanaWallet` (via `walletId`)

---

### 16. **PROVIDER_PAYOUT** (Provider Earnings)
**Purpose**: Tracks provider payouts (periodic or per-booking).

**Key Fields**:
- `id` (String, Primary Key)
- `providerId` (String, Foreign Key → ServiceProvider.id)
- `periodStart`, `periodEnd` (DateTime)
- `totalEarnings` (Float)
- `commission` (Float)
- `netAmount` (Float): `totalEarnings - commission`
- `status` (String): `'pending'`, `'processing'`, `'paid'`, `'failed'`
- `bookingIds` (String[]): Array of booking IDs included

**Relationships**:
- **Many-to-One** with `ServiceProvider` (via `providerId`)

---

### 17. **SERVICE_PROVIDER_APPLICATION** (Provider Applications)
**Purpose**: Tracks provider applications before account creation.

**Key Fields**:
- `id` (String, Primary Key)
- `email` (String, Unique)
- `firstName`, `lastName`, `phone`
- `status` (String): `'pending'`, `'approved'`, `'rejected'`, `'invited'`
- `skills` (String[])
- `experienceYears` (Int)
- `invitationToken` (String?, Unique)

**Relationships**:
- **Optional One-to-One** with `ServiceProvider` (via `applicationId`)

---

### 18. **DOCUMENT_VERIFICATION** (Third-Party Document Verification)
**Purpose**: Tracks third-party document verification (e.g., DataNamix).

**Key Fields**:
- `id` (String, Primary Key)
- `documentId` (String, Foreign Key → Document.id, Unique)
- `provider` (String): `'datanamix'`, `'manual'`, `'other'`
- `externalId` (String?): ID from third-party service
- `status` (String): `'pending'`, `'verified'`, `'failed'`, `'rejected'`
- `verificationData` (JSON?): Response from third-party
- `adminVerified` (Boolean): Admin override
- `adminVerifiedBy` (String?)

**Relationships**:
- **One-to-One** with `Document` (via `documentId`)

---

### 19. **MESSAGE** (Chat Messages)
**Purpose**: Stores chat messages between users (within bookings or direct).

**Key Fields**:
- `id` (String, Primary Key)
- `content` (String)
- `senderId` (String)
- `receiverId` (String)
- `bookingId` (String?): If message is within a booking
- `isRead` (Boolean)

**Note**: No foreign key constraints (flexible for real-time chat)

---

### 20. **RECOMMENDATION** (Service Recommendations)
**Purpose**: Stores AI/ML service recommendations for users.

**Key Fields**:
- `id` (String, Primary Key)
- `userId` (String)
- `serviceId` (String)
- `score` (Float): Recommendation score
- `reason` (String?)

**Note**: No foreign key constraints (can reference any user/service)

---

### 21. **SESSION** (User Sessions)
**Purpose**: Tracks active user sessions (for future session management).

**Key Fields**:
- `id` (String, Primary Key)
- `userId` (String)
- `token` (String, Unique)
- `expiresAt` (DateTime)
- `isActive` (Boolean)

---

## Key Relationships Summary

### One-to-One:
- `User` ↔ `Customer` (if role = 'customer')
- `User` ↔ `ServiceProvider` (if role = 'service_provider')
- `Booking` ↔ `Payment`
- `Document` ↔ `DocumentVerification`
- `ServiceProvider` ↔ `ServiceProviderApplication` (optional)

### One-to-Many:
- `User` → `Notification[]`
- `User` → `Activity[]`
- `Customer` → `Booking[]`
- `Customer` → `Payment[]`
- `ServiceProvider` → `Service[]`
- `ServiceProvider` → `Document[]`
- `ServiceProvider` → `ProviderPayout[]`
- `Service` → `Booking[]`
- `Service` → `ServiceWorkflow[]`
- `Service` → `Complaint[]`
- `Booking` → `Complaint[]`
- `SpanaWallet` → `WalletTransaction[]`

---

## Service Creation Flow (Detailed)

### Step 1: Provider Registration
```
User registers with role: 'service_provider'
  ↓
User record created
  ↓
ServiceProvider record created (linked via userId)
  ↓
Provider can now create services
```

### Step 2: Provider Creates Service
```
POST /services
  ↓
Backend finds ServiceProvider by userId
  ↓
Service record created with:
  - providerId = ServiceProvider.id
  - adminApproved = false (default)
  - status = 'active' (or 'draft')
  ↓
Service saved to database
```

### Step 3: Admin Approval
```
Admin reviews service
  ↓
POST /admin/services/:id/approve
  ↓
Service updated:
  - adminApproved = true
  - approvedBy = admin user ID
  - approvedAt = current timestamp
  ↓
Service now visible to customers
```

### Step 4: Customer Views Services
```
GET /services
  ↓
Backend filters:
  - adminApproved = true
  - status = 'active'
  ↓
Returns services (provider info hidden until booking accepted)
```

---

## Database Indexes

**Unique Constraints**:
- `User.email`
- `Customer.userId`
- `ServiceProvider.userId`
- `Payment.bookingId`
- `AdminVerification.adminEmail`
- `AdminOTP.[adminEmail, otp]` (composite index)
- `DocumentVerification.documentId`
- `Session.token`
- `ServiceProviderApplication.email`
- `ServiceProviderApplication.invitationToken`

**Foreign Key Constraints**:
- All relationships use `onDelete: Cascade` or `onDelete: SetNull` for data integrity

---

## Geospatial Data

**PostGIS Extension Required**:
- `User.location`: Point coordinates for user location
- `ServiceProvider.serviceAreaCenter`: Point for service area center
- `Booking.location`: Point for booking location
- `ServiceProviderApplication.location`: Point for application location

**Note**: Currently stored as JSON, but can be migrated to PostGIS geometry types for advanced queries.

---

## Data Flow Example: Complete Booking Lifecycle

```
1. Customer registers
   User (role: 'customer') → Customer record created

2. Provider registers
   User (role: 'service_provider') → ServiceProvider record created

3. Provider creates service
   ServiceProvider → Service created (adminApproved: false)

4. Admin approves service
   Admin → Service.adminApproved = true

5. Customer books service
   Customer → Booking created (status: 'pending_payment')
   Booking → Service (via serviceId)
   Booking → Customer (via customerId)

6. Customer pays
   Customer → Payment created (escrowStatus: 'held')
   Payment → Booking (one-to-one)
   Payment → Customer (via customerId)

7. Provider accepts booking
   Booking.requestStatus = 'accepted'
   Booking.status = 'confirmed'

8. Provider starts job
   Booking.status = 'in_progress'
   Booking.startedAt = now()

9. Provider completes job
   Booking.status = 'completed'
   Booking.completedAt = now()

10. Payment released
    Payment.escrowStatus = 'released'
    Payment.providerPayout = amount - commission
    ProviderPayout record created
```

---

## Common Queries

### Get all services for a provider:
```typescript
const services = await prisma.service.findMany({
  where: {
    provider: {
      userId: providerUserId
    }
  }
});
```

### Get all bookings for a customer:
```typescript
const bookings = await prisma.booking.findMany({
  where: {
    customer: {
      userId: customerUserId
    }
  },
  include: {
    service: true,
    payment: true
  }
});
```

### Get provider with all services:
```typescript
const provider = await prisma.serviceProvider.findUnique({
  where: { userId: providerUserId },
  include: {
    services: true,
    user: true,
    documents: true
  }
});
```

---

## Notes

1. **Role-Based Access**: The `User.role` field determines which related table is populated (`Customer` or `ServiceProvider`).

2. **Service Approval**: Services must be admin-approved before customers can see them (`adminApproved: true`).

3. **Escrow System**: Payments are held in escrow until service completion, then released to providers minus commission.

4. **Profile Completion**: Providers must have `isProfileComplete: true` before creating services or starting bookings.

5. **Cascade Deletes**: Most relationships use `onDelete: Cascade`, so deleting a user deletes related records (customer/provider, bookings, etc.).

6. **JSON Fields**: Several fields use JSON for flexibility (location, availability, metadata).

---

## Migration Notes

- Run `npx prisma migrate dev` to apply schema changes
- Run `npx prisma generate` to regenerate Prisma Client
- Enable PostGIS extension: `CREATE EXTENSION postgis;` in PostgreSQL

