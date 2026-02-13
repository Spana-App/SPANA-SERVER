# 📍 Where Bookings Are Recorded

## 🗄️ Database Storage

**Database Type:** PostgreSQL  
**Table Name:** `bookings` (mapped via Prisma schema)

### Database Connection
- **Environment Variable:** `DATABASE_URL`
- **Format:** `postgresql://user:password@host:port/database?sslmode=require`
- **Current Setup:** Render PostgreSQL (production) or local PostgreSQL (development)

### Database Location Options:
1. **Render PostgreSQL** (Production)
   - Host: `dpg-d3p2ooc9c44c738ksb8g-a.frankfurt-postgres.render.com`
   - Database: `spana_db`
   - User: `spana_users`

2. **Supabase PostgreSQL** (Alternative)
   - Format: `postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres?sslmode=require`

3. **Local PostgreSQL** (Development)
   - Format: `postgresql://postgres:password@localhost:5432/spana_db`

---

## 💻 Code Location

### Primary Creation Point
**File:** `controllers/bookingController.ts`  
**Function:** `exports.createBooking`  
**Line:** ~234

```typescript
const booking = await prisma.booking.create({
  data: {
    referenceNumber,        // SPANA-BK-000001
    customerId: customer.id,
    serviceId: service.id,
    date: bookingDateTime,
    time,
    location: bookingLocation,
    notes,
    estimatedDurationMinutes,
    jobSize: selectedJobSize,
    basePrice,
    jobSizeMultiplier: multiplier,
    calculatedPrice,
    status: 'pending_payment',
    requestStatus: 'pending',
    paymentStatus: 'pending',
    locationMultiplier: providerMatch.locationMultiplier,
    providerDistance: providerMatch.distance
  },
  include: {
    service: { include: { provider: { include: { user: true } } } },
    customer: { include: { user: true } }
  }
});
```

### API Endpoint
**Route:** `POST /bookings`  
**File:** `routes/bookings.ts`  
**Middleware:** `auth` (requires authentication)

---

## 📊 Database Schema

**Prisma Model:** `Booking`  
**File:** `prisma/schema.prisma`  
**Lines:** 155-233

### Key Fields Stored:
- `id` - Unique booking ID (CUID)
- `referenceNumber` - Human-readable reference (SPANA-BK-000001)
- `customerId` - Foreign key to Customer
- `serviceId` - Foreign key to Service
- `date` - Booking date/time
- `time` - Time string
- `location` - GeoJSON Point (coordinates + address)
- `status` - Booking status (pending, confirmed, in_progress, completed, cancelled)
- `paymentStatus` - Payment status (pending, paid_to_escrow, released_to_provider, refunded)
- `requestStatus` - Provider request status (pending, accepted, declined, expired)
- `calculatedPrice` - Final calculated price
- `createdAt` - Timestamp
- `updatedAt` - Timestamp

---

## 🔍 How to Query Bookings

### Via Code (Prisma)
```typescript
import prisma from './lib/database';

// Get all bookings
const bookings = await prisma.booking.findMany();

// Get booking by ID
const booking = await prisma.booking.findUnique({
  where: { id: 'booking_id' },
  include: {
    service: true,
    customer: { include: { user: true } },
    payment: true
  }
});

// Count bookings
const count = await prisma.booking.count();
```

### Via API
- **Admin Endpoint:** `GET /admin/bookings` (requires admin token)
- **Customer Endpoint:** `GET /bookings` (returns customer's own bookings)

### Via Database Directly
```sql
-- Connect to PostgreSQL
psql "postgresql://spana_users:[PASSWORD]@dpg-d3p2ooc9c44c738ksb8g-a.frankfurt-postgres.render.com/spana_db?sslmode=require"

-- Query bookings
SELECT COUNT(*) FROM bookings;
SELECT * FROM bookings ORDER BY "createdAt" DESC LIMIT 10;
```

---

## 📝 Summary

**Bookings are recorded in:**
1. ✅ **PostgreSQL database** → `bookings` table
2. ✅ **Created via** → `controllers/bookingController.ts` → `createBooking()` function
3. ✅ **Accessed via** → `POST /bookings` API endpoint
4. ✅ **Database connection** → Configured via `DATABASE_URL` environment variable

**Current Status:**
- Local database: **0 bookings** (development database is empty)
- Production database: Check via admin API or direct database connection
