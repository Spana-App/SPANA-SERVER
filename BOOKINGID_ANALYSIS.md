# BookingId Analysis: Where it's defined, how it links, and why it's undefined

## 1. Where is bookingId defined?

### In Prisma Schema (`prisma/schema.prisma`)

```prisma
model ServiceWorkflow {
  id          String  @id @default(cuid())
  name        String
  description String?
  steps       Json
  isActive    Boolean @default(true)

  // Relations
  serviceId  String
  service    Service  @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  bookingId  String?  @unique // When set, this workflow is for one booking only
  booking    Booking? @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("service_workflows")
}
```

**Key points:**
- `bookingId` is **optional** (`String?`) - can be `null`
- `bookingId` is **unique** (`@unique`) - only one workflow can have a specific bookingId
- When `bookingId` is set → workflow is **booking-specific**
- When `bookingId` is `null` → workflow is **service-level** (shared)

### In Booking Model

```prisma
model Booking {
  // ... other fields ...
  
  workflow   ServiceWorkflow? // One workflow per booking (when created with bookingId)
  
  // ... other relations ...
}
```

## 2. How does it link?

### Database Relation
- `ServiceWorkflow.bookingId` → `Booking.id` (one-to-one relation)
- Foreign key constraint: `bookingId` references `Booking.id`
- Cascade delete: If booking is deleted, workflow is deleted

### Code Flow

1. **Workflow Creation** (`createWorkflowForBooking`):
   ```typescript
   const wf = await prisma.serviceWorkflow.create({
     data: {
       serviceId: booking.serviceId,
       bookingId,  // ← Sets the bookingId here
       name: 'Booking Workflow',
       steps: steps,
       isActive: true
     }
   });
   ```

2. **Workflow Lookup** (`getWorkflow`):
   ```typescript
   // Try to find booking-specific workflow
   let wf = await prisma.serviceWorkflow.findFirst({
     where: { bookingId: bookingId }
   });
   
   // Fallback to service-level workflow
   if (!wf) {
     wf = await prisma.serviceWorkflow.findFirst({
       where: { serviceId: booking.serviceId, bookingId: null }
     });
   }
   ```

## 3. Why is bookingId undefined in the GET response?

### The Problem

The test shows:
- **Step 4**: Workflow created with `bookingId: cmlrtij3r00014ep85g3doz42` ✅
- **Step 6**: GET endpoint returns workflow with `bookingId: undefined` ❌

This means the GET endpoint is returning a **service-level workflow** (where `bookingId` is `null`) instead of the **booking-specific workflow**.

### Root Cause Analysis

The issue is likely in the query logic. When using `findFirst` with a nullable unique field:

```typescript
// This query might not work correctly with nullable unique fields
let wf = await prisma.serviceWorkflow.findFirst({
  where: { bookingId: bookingId }
});
```

**Possible reasons:**
1. Prisma's `findFirst` with nullable unique fields may not work as expected
2. The query might be matching `null` values incorrectly
3. There might be multiple workflows and it's finding the wrong one

### Solution

Since `bookingId` is `@unique`, we should use `findUnique` when we know the bookingId exists:

```typescript
// For booking-specific workflows (bookingId is set)
let wf = await prisma.serviceWorkflow.findUnique({
  where: { bookingId: bookingId }
});

// For service-level workflows (bookingId is null)
if (!wf) {
  wf = await prisma.serviceWorkflow.findFirst({
    where: { 
      serviceId: booking.serviceId, 
      bookingId: null 
    }
  });
}
```

However, Prisma's `findUnique` requires the field to be in a `@@unique` constraint or be the primary key. Since `bookingId` is `@unique` (single field unique), `findUnique` should work.

### Alternative: Use explicit null check

```typescript
// Explicitly check for non-null bookingId
let wf = await prisma.serviceWorkflow.findFirst({
  where: {
    AND: [
      { bookingId: { not: null } },
      { bookingId: bookingId }
    ]
  }
});
```

## 4. Current Implementation Issues

Looking at the current `getWorkflow` function:

```typescript
// Current code has redundant queries
let wf = await prisma.serviceWorkflow.findFirst({
  where: { 
    AND: [
      { bookingId: { not: null } },
      { bookingId: bookingId }
    ]
  }
});

// Alternative: try direct match
if (!wf) {
  wf = await prisma.serviceWorkflow.findFirst({
    where: { bookingId: bookingId }
  });
}
```

**Problem:** The second query is redundant and might be finding a different workflow.

## 5. Recommended Fix

Use `findUnique` since `bookingId` is `@unique`:

```typescript
exports.getWorkflow = async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    if (!bookingId) {
      return res.status(400).json({ message: 'Booking ID is required' });
    }
    
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { serviceId: true }
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Try to find booking-specific workflow using findUnique (since bookingId is @unique)
    let wf = null;
    try {
      wf = await prisma.serviceWorkflow.findUnique({
        where: { bookingId: bookingId }
      });
    } catch (e) {
      // If findUnique fails (e.g., bookingId is null in DB), fall through to findFirst
    }
    
    // Fallback to service-level workflow (bookingId is null)
    if (!wf) {
      wf = await prisma.serviceWorkflow.findFirst({
        where: { 
          serviceId: booking.serviceId, 
          bookingId: null 
        }
      });
    }
    
    if (!wf) {
      return res.status(404).json({ message: 'Workflow not found' });
    }
    
    res.json(wf);
  } catch (e) {
    console.error('Get workflow error', e);
    res.status(500).json({ message: 'Server error' });
  }
};
```

## Summary

- **bookingId** is defined in `ServiceWorkflow` model as `String? @unique`
- It links `ServiceWorkflow` → `Booking` via foreign key relation
- It's undefined in GET response because the query is finding a service-level workflow (`bookingId: null`) instead of the booking-specific one
- Fix: Use `findUnique` for booking-specific lookups since `bookingId` is `@unique`
