# Admin Service Creation (Without Provider)

## Overview

Admins can now create services **without** requiring a `providerId`. Services can be created and assigned to providers later.

---

## Changes Made

### 1. Database Schema Update

**File**: `prisma/schema.prisma`

```prisma
// Before
providerId  String
provider    ServiceProvider @relation(...)

// After
providerId  String?  // Optional: Admin can create services without provider
provider    ServiceProvider? @relation(...)
```

**Migration**: `20251130092519_make_service_providerid_optional`
- Changed `providerId` column from `NOT NULL` to nullable

---

## API Endpoints

### 1. Create Service (Admin) - Without Provider

**Endpoint**: `POST /admin/services`

**Headers**: 
```
Authorization: Bearer <ADMIN_JWT>
Content-Type: application/json
```

**Request Body** (providerId is now optional):
```json
{
  "title": "Plumbing Repair",
  "description": "Fast and reliable plumbing services",
  "category": "Plumbing",
  "price": 500.00,
  "duration": 60,
  "mediaUrl": "https://example.com/image.jpg"
  // providerId is optional - can be omitted
}
```

**Response** (without providerId):
```json
{
  "message": "Service created successfully (no provider assigned yet)",
  "service": {
    "id": "service-123",
    "title": "Plumbing Repair",
    "description": "...",
    "category": "Plumbing",
    "price": 500.00,
    "duration": 60,
    "providerId": null,
    "status": "draft",
    "adminApproved": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Request Body** (with providerId - still supported):
```json
{
  "title": "Plumbing Repair",
  "description": "...",
  "category": "Plumbing",
  "price": 500.00,
  "duration": 60,
  "providerId": "provider-456"  // Optional: can still link immediately
}
```

**Response** (with providerId):
```json
{
  "message": "Service created successfully and linked to provider",
  "service": {
    "id": "service-123",
    "providerId": "provider-456",
    "provider": {
      "rating": 4.5,
      "user": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      }
    },
    ...
  }
}
```

---

### 2. Assign Service to Provider

**Endpoint**: `POST /admin/services/:id/assign`

**Headers**: 
```
Authorization: Bearer <ADMIN_JWT>
Content-Type: application/json
```

**Request Body**:
```json
{
  "providerId": "provider-456"
}
```

**Response**:
```json
{
  "message": "Service assigned to provider successfully",
  "service": {
    "id": "service-123",
    "providerId": "provider-456",
    "provider": {
      "rating": 4.5,
      "user": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      }
    },
    "adminApproved": false,  // Requires re-approval after assignment
    ...
  }
}
```

**Notes**:
- Service must exist
- Provider must exist
- After assignment, `adminApproved` is set to `false` (requires re-approval)

---

### 3. Unassign Service from Provider

**Endpoint**: `POST /admin/services/:id/unassign`

**Headers**: 
```
Authorization: Bearer <ADMIN_JWT>
```

**Response**:
```json
{
  "message": "Service unassigned from provider successfully",
  "service": {
    "id": "service-123",
    "providerId": null,
    ...
  }
}
```

**Notes**:
- Service must exist
- Service must currently have a provider assigned

---

### 4. Update Service (Can Update providerId)

**Endpoint**: `PUT /admin/services/:id`

**Headers**: 
```
Authorization: Bearer <ADMIN_JWT>
Content-Type: application/json
```

**Request Body** (can update providerId):
```json
{
  "title": "Updated Title",
  "providerId": "provider-789",  // Can assign/change provider
  // OR
  "providerId": null  // Can unassign provider
}
```

**Response**:
```json
{
  "message": "Service updated successfully",
  "service": {
    ...
  }
}
```

---

## Behavior Changes

### Service Creation

1. **Admin creates service without providerId**:
   - Service is created with `providerId: null`
   - `status` defaults to `'draft'`
   - `adminApproved` defaults to `true` (admin-created services are auto-approved)
   - Service is **not visible to customers** until assigned to a provider

2. **Admin creates service with providerId**:
   - Service is created with `providerId` set
   - `status` defaults to `'draft'`
   - `adminApproved` defaults to `false` (requires approval)
   - Works as before

### Service Visibility

- **Services without providerId**: Not visible to customers (cannot be booked)
- **Services with providerId**: Visible to customers if `adminApproved: true` AND `status: 'active'`

### Booking Creation

- **Before**: Could create booking for any approved service
- **After**: Must check if service has a provider before allowing booking

**Error Response**:
```json
{
  "message": "Service does not have a provider assigned yet. Please contact support."
}
```

---

## Code Changes

### Files Modified

1. **`prisma/schema.prisma`**
   - Made `providerId` optional (`String?`)
   - Made `provider` relation optional (`ServiceProvider?`)

2. **`controllers/adminController.ts`**
   - Updated `createService()` to allow creating without `providerId`
   - Added `assignServiceToProvider()` function
   - Added `unassignServiceFromProvider()` function
   - Updated `updateService()` to allow updating `providerId`

3. **`routes/admin.ts`**
   - Added `POST /admin/services/:id/assign` route
   - Added `POST /admin/services/:id/unassign` route

4. **`controllers/bookingController.ts`**
   - Added check to ensure service has a provider before allowing booking
   - Updated socket notification to handle optional provider

---

## Usage Examples

### Example 1: Create Service, Assign Later

```typescript
// 1. Admin creates service without provider
POST /admin/services
{
  "title": "Emergency Plumbing",
  "description": "24/7 emergency plumbing",
  "category": "Plumbing",
  "price": 800.00,
  "duration": 90
}
// Response: service with providerId: null

// 2. Later, assign to provider
POST /admin/services/{serviceId}/assign
{
  "providerId": "provider-123"
}
// Response: service now linked to provider
```

### Example 2: Create Service with Provider Immediately

```typescript
// Admin creates service and links immediately
POST /admin/services
{
  "title": "Electrical Repair",
  "description": "Professional electrical services",
  "category": "Electrical",
  "price": 600.00,
  "duration": 60,
  "providerId": "provider-456"
}
// Response: service linked to provider immediately
```

### Example 3: Update Service to Change Provider

```typescript
// Update service to assign different provider
PUT /admin/services/{serviceId}
{
  "providerId": "provider-789"
}
// Response: service now linked to new provider
```

### Example 4: Unassign Provider from Service

```typescript
// Remove provider assignment
POST /admin/services/{serviceId}/unassign
// Response: service.providerId = null
```

---

## Important Notes

1. **Services without providers cannot be booked** - Customers will see an error if they try to book a service without a provider.

2. **Auto-approval for admin-created services** - Services created by admin without a provider are auto-approved (`adminApproved: true`), but still not visible to customers until assigned.

3. **Re-approval after assignment** - When a service is assigned to a provider, `adminApproved` is set to `false`, requiring re-approval.

4. **Backward compatibility** - Existing services with `providerId` continue to work as before.

5. **Provider queries** - All service queries now handle optional providers gracefully (Prisma returns `null` if no provider).

---

## Migration

**Migration Name**: `20251130092519_make_service_providerid_optional`

**SQL**:
```sql
ALTER TABLE "services" ALTER COLUMN "providerId" DROP NOT NULL;
```

**Status**: ✅ Applied successfully

---

## Testing

### Test Cases

1. ✅ Admin creates service without `providerId` → Service created with `providerId: null`
2. ✅ Admin creates service with `providerId` → Service created and linked
3. ✅ Admin assigns service to provider → Service linked, `adminApproved: false`
4. ✅ Admin unassigns service from provider → Service `providerId: null`
5. ✅ Customer tries to book service without provider → Error returned
6. ✅ Customer books service with provider → Booking created successfully
7. ✅ Service queries handle optional provider → No errors, `provider: null` returned

---

## Future Enhancements

- Bulk assign multiple services to a provider
- Auto-assign services based on provider skills/category
- Service templates that can be cloned and assigned to providers

