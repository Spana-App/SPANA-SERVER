# Default System Services

## Overview

The SPANA platform comes with **default system services** that are automatically available to all users. These services are pre-configured and ready to use, and admins can add more custom services on top of them.

## Features

- ✅ **18 default services** across 6 categories
- ✅ **No provider assigned** initially (admins can assign providers later)
- ✅ **Auto-approved** and active by default
- ✅ **System-managed** (marked with `isSystemService: true`)
- ✅ **Cannot be deleted** (protected system services)

## Default Service Categories

### Plumbing (3 services)
- Emergency Plumbing - R450, 120 min
- Pipe Repair - R350, 90 min
- Drain Cleaning - R280, 60 min

### Electrical (3 services)
- Electrical Repair - R400, 90 min
- Wiring Installation - R550, 180 min
- Light Installation - R300, 75 min

### Cleaning (3 services)
- House Cleaning - R450, 180 min
- Office Cleaning - R600, 240 min
- Deep Cleaning - R750, 300 min

### Carpentry (3 services)
- Furniture Repair - R400, 120 min
- Cabinet Installation - R650, 240 min
- Door Repair - R350, 90 min

### Painting (2 services)
- Interior Painting - R500, 240 min
- Exterior Painting - R800, 360 min

### Gardening (3 services)
- Lawn Mowing - R250, 90 min
- Garden Design - R1200, 480 min
- Tree Trimming - R450, 120 min

---

## Setup Instructions

### 1. Run Database Migration

First, update your database schema to include the `isSystemService` field:

```bash
npm run db:push
```

### 2. Seed Default Services

Run the seed script to create all default services:

```bash
npm run seed:default-services
```

This will:
- Create 18 default services
- Mark them as system services (`isSystemService: true`)
- Auto-approve them (admin-approved and active)
- Leave `providerId` as `null` (admins can assign providers later)

---

## How It Works

### Service Creation Flow

1. **System Defaults** (Initial Setup)
   - Run `npm run seed:default-services`
   - Creates 18 default services
   - No providers assigned yet

2. **Admin Adds Custom Services**
   - Admins can create additional services via `/admin/services`
   - These are marked as `isSystemService: false`
   - Can be assigned to providers immediately or later

3. **Provider Assignment**
   - Admins can assign any service (default or custom) to providers
   - Use `/admin/services/:id/assign` endpoint
   - Services can be reassigned or unassigned as needed

### Service Identification

Services are identified by the `isSystemService` field:

```typescript
// System default service
{
  id: "...",
  title: "Emergency Plumbing",
  isSystemService: true,  // ← System service
  providerId: null        // ← Can be assigned later
}

// Admin-created service
{
  id: "...",
  title: "Custom Service",
  isSystemService: false, // ← Admin-created
  providerId: "..."       // ← Can have provider or null
}
```

---

## API Endpoints

### Get All Services (Including Defaults)

```http
GET /services
```

Returns all services (default + admin-created), filtered by user role.

### Get System Services Only

```http
GET /admin/services?systemOnly=true
```

Returns only system default services (admin only).

### Assign Provider to Service

```http
POST /admin/services/:id/assign
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "providerId": "provider-id-here"
}
```

Assigns a provider to any service (default or custom).

### Unassign Provider from Service

```http
POST /admin/services/:id/unassign
Authorization: Bearer <ADMIN_TOKEN>
```

Removes provider assignment from a service.

---

## Benefits

1. **Quick Start**: Platform launches with ready-to-use services
2. **Consistency**: Standard service catalog across all deployments
3. **Flexibility**: Admins can add custom services on top
4. **Provider Management**: Services can be assigned/unassigned dynamically
5. **No Duplicates**: Seed script checks for existing services before creating

---

## Maintenance

### Re-seeding Default Services

If you need to re-seed (e.g., after database reset):

```bash
npm run seed:default-services
```

The script will:
- Skip services that already exist
- Only create missing services
- Not duplicate existing ones

### Updating Default Services

To update default services:

1. Edit `scripts/seedDefaultServices.ts`
2. Modify the `defaultServices` array
3. Run `npm run seed:default-services` again
4. Existing services won't be updated (only new ones created)

### Adding New Default Services

Add new services to the `defaultServices` array in `scripts/seedDefaultServices.ts`:

```typescript
{
  title: 'New Service',
  description: 'Service description',
  category: 'Category',
  price: 400,
  duration: 120,
  mediaUrl: 'https://example.com/image.jpg'
}
```

---

## Database Schema

The `Service` model includes:

```prisma
model Service {
  // ... other fields
  isSystemService Boolean @default(false) // True for default system services
  providerId      String?  // Optional: Can be assigned later
  // ...
}
```

---

## Notes

- Default services are **read-only** from a user perspective
- Only admins can modify default services (price, description, etc.)
- Default services can be **archived** but not deleted
- When a provider is assigned, the service becomes available for booking
- Services without providers are visible but not bookable

---

## Example Usage

### Frontend Display

```typescript
// Get all services
const services = await fetch('/services');

// Filter system services
const systemServices = services.filter(s => s.isSystemService);

// Filter services with providers (bookable)
const bookableServices = services.filter(s => s.providerId !== null);
```

### Admin Dashboard

```typescript
// Show system services vs custom services
const systemServices = services.filter(s => s.isSystemService);
const customServices = services.filter(s => !s.isSystemService);

// Show unassigned services (need provider)
const unassignedServices = services.filter(s => s.providerId === null);
```

---

## Troubleshooting

### Services Not Showing

1. Check if services are seeded: `npm run seed:default-services`
2. Verify `adminApproved: true` and `status: 'active'`
3. Check user role permissions (customers only see approved services)

### Duplicate Services

The seed script automatically skips existing services. If you see duplicates:
1. Check for services with same title and category
2. Verify `isSystemService` field is set correctly
3. Manually remove duplicates if needed

---

## Summary

Default services provide a **foundation** for the platform, ensuring there's always a base catalog of services available. Admins can then:
- Add custom services
- Assign providers to services
- Manage the service catalog dynamically

This creates a flexible system where the platform starts with sensible defaults but remains fully customizable.

