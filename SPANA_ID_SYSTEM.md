# SPANA ID System

## Overview

All entities in the SPANA system now use human-readable IDs with SPANA prefixes. The ID format is: `{PREFIX}-{randomCode}` where the code is 6 characters (3 letters + 3 numbers).

## ID Prefixes

| Entity | Prefix | Example | Generator Function |
|--------|--------|---------|-------------------|
| Users | `SPN` | `SPN-abc123` | `generateUserId()` |
| Bookings | `SPB` | `SPB-xyz789` | `generateBookingId()` |
| Payments | `SPP` | `SPP-def456` | `generatePaymentId()` |
| Services | `SPS` | `SPS-ghi012` | `generateServiceId()` |
| Messages | `SPM` | `SPM-jkl345` | `generateMessageId()` |
| Documents | `SPD` | `SPD-mno678` | `generateDocumentId()` |
| Customers | `SPC` | `SPC-pqr901` | `generateCustomerId()` |
| Service Providers | `SPR` | `SPR-stu234` | `generateProviderId()` |
| Complaints | `SPX` | `SPX-vwx567` | `generateComplaintId()` |
| Applications | `SPA` | `SPA-yza890` | `generateApplicationId()` |
| Payouts | `SPY` | `SPY-bcd123` | `generatePayoutId()` |

## Implementation Status

### ✅ Completed
- **Users**: SPANA IDs generated and returned as primary `id` in API responses
- **ID Generator**: Created `lib/spanaIdGenerator.ts` with all entity generators
- **Admin Controller**: Updated `registerServiceProvider` and `verifyApplicationAndCreateProvider` to use SPANA IDs
- **Auth Controller**: Updated registration to use SPANA IDs and return them in responses

### 🔄 In Progress / To Do
- **Bookings**: Update booking creation to use `SPB-{code}` IDs
- **Payments**: Update payment creation to use `SPP-{code}` IDs
- **Services**: Update service creation to use `SPS-{code}` IDs
- **Messages**: Update message creation to use `SPM-{code}` IDs
- **Documents**: Update document creation to use `SPD-{code}` IDs
- **Other Entities**: Update remaining entities (Customers, Providers, Complaints, Applications, Payouts)

## How It Works

1. **ID Generation**: When creating a new entity, call the appropriate generator function:
   ```typescript
   const spanaUserId = await generateUserId(); // Returns: SPN-abc123
   ```

2. **Storage**: Store the SPANA ID in the `referenceNumber` field:
   ```typescript
   const user = await prisma.user.create({
     data: {
       email: 'user@example.com',
       referenceNumber: spanaUserId // Store SPANA ID here
     }
   });
   ```

3. **API Response**: Return SPANA ID as the primary `id` field:
   ```typescript
   res.json({
     user: {
       id: user.referenceNumber || user.id, // SPANA ID as primary ID
       referenceNumber: user.referenceNumber || user.id
     }
   });
   ```

## Database Schema

The Prisma schema uses `cuid()` for internal database IDs (for relationships), but stores SPANA IDs in `referenceNumber` fields:

```prisma
model User {
  id              String  @id @default(cuid())  // Internal DB ID
  referenceNumber String? @unique              // SPANA ID (SPN-abc123)
  // ... other fields
}
```

## Migration Notes

- Existing records without `referenceNumber` will still work (fallback to internal ID)
- New records will always have SPANA IDs
- API responses prioritize `referenceNumber` as the `id` field
- Internal database relationships still use `cuid()` IDs

## Usage Examples

### Creating a User
```typescript
import { generateUserId } from '../lib/spanaIdGenerator';

const spanaUserId = await generateUserId(); // SPN-abc123
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    referenceNumber: spanaUserId
  }
});

// Response uses SPANA ID
res.json({
  user: {
    id: spanaUserId, // SPN-abc123
    referenceNumber: spanaUserId
  }
});
```

### Finding by SPANA ID
```typescript
import { findUserBySpanaId } from '../lib/spanaIdHelper';

const user = await findUserBySpanaId('SPN-abc123');
// Works with both SPANA ID and internal ID
```

## Next Steps

1. Update booking controller to use `generateBookingId()`
2. Update payment controller to use `generatePaymentId()`
3. Update service controller to use `generateServiceId()`
4. Update message/chat controller to use `generateMessageId()`
5. Update document controller to use `generateDocumentId()`
6. Update all API responses to return SPANA IDs as primary `id` field
7. Update frontend to use SPANA IDs instead of internal IDs

## Benefits

- **Human-readable**: IDs like `SPN-abc123` are easier to read and share
- **Brand identity**: All IDs contain "SPANA" branding
- **Type identification**: Prefix indicates entity type
- **Professional**: More professional than random cuid strings
- **Traceable**: Easier to reference in support tickets and logs
