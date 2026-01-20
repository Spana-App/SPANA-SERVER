# 📋 SLA (Service Level Agreement) Information

## Overview

The SPANA platform implements comprehensive SLA (Service Level Agreement) tracking to ensure providers complete services within agreed timeframes. SLA breaches result in automatic penalty calculations that are deducted from provider payouts.

---

## 📊 SLA Database Schema

### Booking Model Fields (SLA Tracking)

```prisma
model Booking {
  // SLA tracking fields
  estimatedDurationMinutes Int     @default(0)  // Agreed SLA duration in minutes
  startedAt                DateTime?            // When provider started work
  completedAt              DateTime?            // When provider completed work
  actualDurationMinutes    Int?                // Actual time taken (calculated)
  slaBreached              Boolean @default(false)  // Whether SLA was breached
  slaPenaltyAmount         Float?  @default(0)     // Penalty amount (in ZAR)
}
```

---

## ⏱️ SLA Calculation Logic

### 1. **Estimated Duration**
- Set when booking is created
- Based on service `duration` field or provided by customer
- Stored in `estimatedDurationMinutes` (in minutes)

### 2. **Actual Duration**
- Calculated when booking is completed
- Formula: `(completedAt - startedAt) / (1000 * 60)` (converts milliseconds to minutes)
- Stored in `actualDurationMinutes`

### 3. **SLA Breach Detection**
```typescript
const slaBreached = estimatedDurationMinutes > 0 && 
                    actualDurationMinutes > estimatedDurationMinutes;
```

**Conditions:**
- ✅ Breach detected if `actualDurationMinutes > estimatedDurationMinutes`
- ✅ Only checked if `estimatedDurationMinutes > 0` (SLA was set)
- ✅ Breach flag stored in `slaBreached` field

### 4. **SLA Penalty Calculation**

**Penalty Formula:**
```typescript
if (slaBreached && calculatedPrice) {
  const hoursOver = (actualDurationMinutes - estimatedDurationMinutes) / 60;
  const penaltyRate = 0.10; // 10% per hour over SLA
  slaPenaltyAmount = calculatedPrice * penaltyRate * hoursOver;
}
```

**Penalty Details:**
- **Rate:** 10% of service price per hour over SLA
- **Minimum:** R0 (no penalty if within SLA)
- **Maximum:** No cap (penalty increases with time over)

**Example:**
```
Service Price: R1,000
Estimated Duration: 2 hours (120 minutes)
Actual Duration: 3 hours (180 minutes)
Time Over: 1 hour

Penalty = R1,000 × 10% × 1 hour = R100
```

---

## 🔄 SLA Tracking Workflow

### Step 1: Booking Creation
- Customer creates booking with service
- `estimatedDurationMinutes` is set (from service or custom)
- `slaBreached = false` (default)
- `slaPenaltyAmount = 0` (default)

### Step 2: Provider Starts Work
- Provider calls `PUT /bookings/:id/start`
- `startedAt` timestamp is recorded
- SLA timer begins

### Step 3: Provider Completes Work
- Provider calls `PUT /bookings/:id/complete`
- `completedAt` timestamp is recorded
- **SLA calculations occur automatically:**

```typescript
// Calculate actual duration
const actualDurationMinutes = Math.ceil(
  (completedAt.getTime() - startedAt.getTime()) / 60000
);

// Check if SLA was breached
const slaBreached = estimatedDurationMinutes > 0 && 
                    actualDurationMinutes > estimatedDurationMinutes;

// Calculate penalty if breached
let slaPenaltyAmount = 0;
if (slaBreached && calculatedPrice) {
  const hoursOver = (actualDurationMinutes - estimatedDurationMinutes) / 60;
  const penaltyRate = 0.10; // 10% per hour
  slaPenaltyAmount = calculatedPrice * penaltyRate * hoursOver;
}
```

### Step 4: Payment Release
- When payment is released to provider
- `slaPenaltyAmount` is deducted from payout
- Provider receives: `calculatedPrice - slaPenaltyAmount`

---

## 📈 Provider Performance Metrics

### SLA Compliance Tracking

Admins can view provider SLA performance via:
```
GET /admin/providers/:providerId/performance
```

**Metrics Returned:**
```json
{
  "provider": {
    "id": "provider_id",
    "name": "Provider Name",
    "email": "provider@email.com",
    "rating": 4.5,
    "totalReviews": 50
  },
  "metrics": {
    "totalBookings": 100,
    "totalRevenue": 50000,
    "slaBreaches": 5,
    "slaComplianceRate": "95.00",  // Percentage
    "averageRating": 4.5
  }
}
```

**SLA Compliance Rate:**
```
slaComplianceRate = ((totalBookings - slaBreaches) / totalBookings) × 100
```

---

## 🎯 SLA Rules & Policies

### 1. **SLA Duration**
- Minimum: 0 minutes (no SLA required)
- Maximum: Unlimited
- Default: Service's `duration` field

### 2. **Penalty Rates**
- **Current:** 10% per hour over SLA
- **Minimum Penalty:** R0 (if within SLA)
- **No Maximum:** Penalty increases proportionally

### 3. **Breach Conditions**
- ✅ Must have `estimatedDurationMinutes > 0`
- ✅ Must have `startedAt` and `completedAt` timestamps
- ✅ Breach occurs when `actualDuration > estimatedDuration`

### 4. **Penalty Application**
- Applied automatically on booking completion
- Deducted from provider payout
- Recorded in booking `slaPenaltyAmount` field
- Tracked in provider performance metrics

---

## 🔍 API Endpoints Related to SLA

### Get Booking (includes SLA info)
```
GET /bookings/:id
```

**Response includes:**
```json
{
  "id": "booking_id",
  "estimatedDurationMinutes": 120,
  "actualDurationMinutes": 180,
  "startedAt": "2026-01-19T10:00:00Z",
  "completedAt": "2026-01-19T13:00:00Z",
  "slaBreached": true,
  "slaPenaltyAmount": 100.00,
  "status": "completed"
}
```

### Complete Booking (triggers SLA calculation)
```
PUT /bookings/:id/complete
```

**Automatic SLA calculation on completion:**
- Calculates `actualDurationMinutes`
- Determines `slaBreached` status
- Calculates `slaPenaltyAmount` if breached
- Updates booking record

---

## 📝 SLA Implementation Code

### Location: `controllers/bookingController.ts`

**Function: `completeBooking`** (Lines 594-731)

```typescript
// Calculate actual duration and SLA
if (!booking.startedAt) {
  return res.status(400).json({ 
    message: 'Booking must be started before completion' 
  });
}

const completedAt = new Date();
const actualDurationMinutes = Math.ceil(
  (completedAt.getTime() - booking.startedAt.getTime()) / 60000
);

const slaBreached = 
  booking.estimatedDurationMinutes > 0 && 
  actualDurationMinutes > booking.estimatedDurationMinutes;

// Calculate SLA penalty (10% of calculated price per hour over SLA)
let slaPenaltyAmount = 0;
if (slaBreached && booking.calculatedPrice) {
  const hoursOver = 
    (actualDurationMinutes - booking.estimatedDurationMinutes) / 60;
  const penaltyRate = 0.10; // 10% per hour
  slaPenaltyAmount = booking.calculatedPrice * penaltyRate * hoursOver;
}

// Update booking with SLA data
booking = await prisma.booking.update({
  where: { id: req.params.id },
  data: {
    status: 'completed',
    completedAt,
    actualDurationMinutes,
    slaBreached,
    slaPenaltyAmount
  }
});
```

---

## 💰 Penalty Examples

### Example 1: No Breach
```
Service Price: R500
Estimated: 1 hour (60 minutes)
Actual: 45 minutes
Result: No penalty (R0)
```

### Example 2: Minor Breach
```
Service Price: R500
Estimated: 1 hour (60 minutes)
Actual: 90 minutes (1.5 hours)
Time Over: 0.5 hours
Penalty: R500 × 10% × 0.5 = R25
```

### Example 3: Major Breach
```
Service Price: R2,000
Estimated: 2 hours (120 minutes)
Actual: 4 hours (240 minutes)
Time Over: 2 hours
Penalty: R2,000 × 10% × 2 = R400
```

---

## 📊 SLA Reporting (Admin)

### Provider Performance Endpoint
```
GET /admin/providers/:providerId/performance
```

**Returns:**
- Total bookings completed
- SLA breaches count
- SLA compliance rate (percentage)
- Total revenue
- Average rating

### All Bookings (Admin View)
```
GET /admin/bookings
```

**Includes SLA data for all bookings:**
- `slaBreached`: Boolean flag
- `slaPenaltyAmount`: Penalty amount
- `actualDurationMinutes`: Actual time taken
- `estimatedDurationMinutes`: Agreed SLA duration

---

## ⚙️ Configuration

### Current Settings
- **Penalty Rate:** 10% per hour over SLA (hardcoded)
- **Breach Threshold:** Any time over `estimatedDurationMinutes`
- **Calculation:** Automatic on booking completion

### Future Enhancements (Not Implemented)
- Configurable penalty rates per service category
- Grace period (e.g., 5 minutes over SLA = no penalty)
- Escalating penalties (e.g., 10% first hour, 15% second hour)
- SLA warnings before breach
- Customer notification on SLA breach

---

## 🚨 Important Notes

1. **SLA is Optional:**
   - If `estimatedDurationMinutes = 0`, no SLA is enforced
   - No penalty calculated if no SLA was set

2. **Timer Accuracy:**
   - SLA timer starts when provider calls `/bookings/:id/start`
   - Timer ends when provider calls `/bookings/:id/complete`
   - Provider controls when to start/complete (self-reported)

3. **Penalty Deduction:**
   - Penalty is calculated but not automatically deducted
   - Should be deducted during payment release process
   - Ensure payment controller includes penalty deduction

4. **Provider Notification:**
   - Providers can see `slaPenaltyAmount` in booking details
   - SLA breach status visible in booking response
   - No automatic notification on breach (could be added)

---

## 📞 Support & Questions

For questions about SLA implementation or to request changes:
- Check `controllers/bookingController.ts` for implementation
- Review `prisma/schema.prisma` for database schema
- See `controllers/adminController.ts` for performance metrics

---

**Last Updated:** 2026-01-19
**Version:** 1.0.0
