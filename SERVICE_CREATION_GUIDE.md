# Service Creation Guide

## Quick Overview

**Services** are offerings created by **Service Providers** (e.g., "Plumbing Repair", "Electrical Installation"). They must be **admin-approved** before customers can see and book them.

---

## Database Relationship

```
User (role: 'service_provider')
  ↓
ServiceProvider (created automatically on registration)
  ↓
Service (created by provider via API)
  ↓
Booking (created by customer)
```

**Key Point**: A `Service` belongs to a `ServiceProvider`, which belongs to a `User`.

---

## Step-by-Step: How Services Are Added

### 1. Provider Registration

When a user registers with `role: 'service_provider'`:

```typescript
// User record created
User {
  id: "user-123",
  email: "provider@example.com",
  role: "service_provider",
  ...
}

// ServiceProvider record automatically created
ServiceProvider {
  id: "provider-456",
  userId: "user-123",  // ← Links to User
  skills: [],
  rating: 0,
  isVerified: false,
  ...
}
```

**Code Location**: `controllers/authController.ts` → `register()` function

---

### 2. Provider Creates a Service

**API Endpoint**: `POST /services`

**Request**:
```json
{
  "title": "Emergency Plumbing Repair",
  "description": "Fast and reliable plumbing services for emergencies",
  "category": "Plumbing",
  "price": 500.00,
  "duration": 60,
  "mediaUrl": "https://example.com/image.jpg"
}
```

**Headers**: `Authorization: Bearer <PROVIDER_JWT>`

**Backend Process** (`controllers/serviceController.ts` → `createService()`):

```typescript
// 1. Find the ServiceProvider record for the authenticated user
const serviceProvider = await prisma.serviceProvider.findUnique({
  where: { userId: req.user.id }  // req.user.id comes from JWT
});

// 2. Create the Service record
const service = await prisma.service.create({
  data: {
    title: "Emergency Plumbing Repair",
    description: "...",
    category: "Plumbing",
    price: 500.00,
    duration: 60,
    providerId: serviceProvider.id,  // ← Links to ServiceProvider
    status: 'active',
    adminApproved: false  // ← Must be approved by admin
  }
});
```

**Database Result**:
```typescript
Service {
  id: "service-789",
  title: "Emergency Plumbing Repair",
  providerId: "provider-456",  // ← Foreign key to ServiceProvider
  adminApproved: false,         // ← Not visible to customers yet
  status: 'active',
  ...
}
```

---

### 3. Admin Approval (Required)

**Services are NOT visible to customers until admin approves them.**

**API Endpoint**: `POST /admin/services/:id/approve`

**Headers**: `Authorization: Bearer <ADMIN_JWT>`

**Backend Process** (`controllers/adminController.ts` → `approveService()`):

```typescript
const service = await prisma.service.update({
  where: { id: serviceId },
  data: {
    adminApproved: true,
    approvedBy: adminUserId,
    approvedAt: new Date()
  }
});
```

**After Approval**:
```typescript
Service {
  id: "service-789",
  adminApproved: true,    // ← Now visible to customers
  approvedBy: "admin-001",
  approvedAt: "2024-01-15T10:30:00Z",
  ...
}
```

---

### 4. Customer Views Services

**API Endpoint**: `GET /services`

**Backend Filter** (`controllers/serviceController.ts` → `getAllServices()`):

```typescript
// For customers, only show approved active services
const where = {
  adminApproved: true,  // ← Must be true
  status: 'active'      // ← Must be active
};

const services = await prisma.service.findMany({ where });
```

**Response** (for customers):
```json
[
  {
    "id": "service-789",
    "title": "Emergency Plumbing Repair",
    "description": "...",
    "category": "Plumbing",
    "price": 500.00,
    "duration": 60,
    "adminApproved": true
    // Note: Provider info is hidden until booking accepted (Uber-style)
  }
]
```

---

## Database Schema

### Service Table

```prisma
model Service {
  id          String   @id @default(cuid())
  title       String
  description String
  category    String
  price       Float
  duration    Int      // in minutes
  mediaUrl    String?
  status      String   @default("draft") // 'draft', 'pending_approval', 'active', 'archived'
  adminApproved Boolean @default(false) // ← KEY FIELD: Must be true for customers
  approvedBy   String?  // Admin user ID
  approvedAt   DateTime?
  rejectionReason String?
  
  // Foreign Key Relationship
  providerId  String
  provider    ServiceProvider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  
  // Related Records
  bookings    Booking[]
  workflows   ServiceWorkflow[]
  complaints  Complaint[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### ServiceProvider Table (Related)

```prisma
model ServiceProvider {
  id                String   @id @default(cuid())
  userId            String   @unique  // ← Links to User
  skills            String[]
  experienceYears   Int
  rating            Float
  isVerified        Boolean
  // ... other fields
  
  // Foreign Key Relationship
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // One-to-Many: One provider can have many services
  services          Service[]  // ← Services belong to this provider
  documents         Document[]
  payouts           ProviderPayout[]
}
```

---

## Key Relationships

### Service → ServiceProvider → User

```
Service.providerId → ServiceProvider.id
ServiceProvider.userId → User.id
```

**Query Example**:
```typescript
// Get all services for a provider
const services = await prisma.service.findMany({
  where: {
    provider: {
      userId: providerUserId  // Find via User ID
    }
  },
  include: {
    provider: {
      include: {
        user: true  // Include User data
      }
    }
  }
});
```

---

## Service Visibility Rules

| User Role | Can See Services With |
|-----------|----------------------|
| **Customer** | `adminApproved: true` AND `status: 'active'` |
| **Provider** | Their own services (all statuses) + approved services from others |
| **Admin** | All services (regardless of status/approval) |

**Code Location**: `controllers/serviceController.ts` → `getAllServices()`

---

## Service Status Flow

```
draft → pending_approval → active → archived
         ↑
         └── (if rejected, can be edited and resubmitted)
```

- **draft**: Provider is still editing
- **pending_approval**: Waiting for admin review
- **active**: Approved and visible to customers
- **archived**: Deactivated (not visible)

---

## Common Operations

### Create Service
```typescript
POST /services
Body: { title, description, category, price, duration, mediaUrl }
```

### Update Service
```typescript
PUT /services/:id
Body: { title?, description?, category?, price?, duration?, mediaUrl?, status? }
```

### Delete Service
```typescript
DELETE /services/:id
```

### Approve Service (Admin Only)
```typescript
POST /admin/services/:id/approve
```

### Reject Service (Admin Only)
```typescript
POST /admin/services/:id/reject
Body: { rejectionReason: "..." }
```

---

## Important Notes

1. **Provider Must Exist**: A `ServiceProvider` record must exist before creating services. This is created automatically on registration.

2. **Admin Approval Required**: Services are invisible to customers until `adminApproved: true`.

3. **Cascade Delete**: If a `ServiceProvider` is deleted, all their `Service` records are automatically deleted (due to `onDelete: Cascade`).

4. **Provider Info Hidden**: Customers don't see provider details until a booking is accepted (Uber-style model).

5. **Profile Completion**: Providers must have `isProfileComplete: true` before creating services (enforced by `providerReady` middleware).

---

## Code References

- **Service Creation**: `controllers/serviceController.ts` → `createService()`
- **Service Listing**: `controllers/serviceController.ts` → `getAllServices()`
- **Service Approval**: `controllers/adminController.ts` → `approveService()`
- **Routes**: `routes/services.ts`
- **Schema**: `prisma/schema.prisma` → `model Service`

---

## Example: Complete Flow

```typescript
// 1. Provider registers
POST /auth/register
{ email: "plumber@example.com", role: "service_provider", ... }
→ User created
→ ServiceProvider created (userId links to User)

// 2. Provider creates service
POST /services
{ title: "Plumbing Repair", price: 500, ... }
→ Service created (providerId links to ServiceProvider, adminApproved: false)

// 3. Admin approves
POST /admin/services/:id/approve
→ Service updated (adminApproved: true)

// 4. Customer sees service
GET /services
→ Returns service (adminApproved: true, status: 'active')

// 5. Customer books service
POST /bookings
{ serviceId: "...", date: "...", ... }
→ Booking created (serviceId links to Service)
```

---

## Troubleshooting

**Q: Why can't customers see my service?**
- Check `adminApproved` is `true`
- Check `status` is `'active'`
- Verify admin has approved the service

**Q: How do I link a service to a provider?**
- Services are automatically linked via `providerId` when created
- The `providerId` comes from the authenticated user's `ServiceProvider` record

**Q: Can a provider have multiple services?**
- Yes! `ServiceProvider` has a one-to-many relationship with `Service[]`

**Q: What happens if I delete a provider?**
- All their services are automatically deleted (cascade delete)

