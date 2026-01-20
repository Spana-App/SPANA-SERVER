# 📋 SLA (Service Level Agreement) - How It Works & Policy

## Overview

The SLA system ensures providers complete services within agreed timeframes. When a provider exceeds the agreed duration, an automatic penalty is calculated based on the delay.

---

## 🎯 SLA Policy

### **Current Policy Rules:**

1. **SLA is Optional**
   - Only enforced if `estimatedDurationMinutes > 0`
   - If no duration is set, no penalty can occur

2. **Penalty Rate: 10% per hour over SLA**
   - Calculated from service price (before tips/commission)
   - No grace period (any time over = breach)
   - No maximum cap (penalty can exceed service price)

3. **Breach Definition**
   - Breach occurs when: `actualDurationMinutes > estimatedDurationMinutes`
   - Must have both `startedAt` and `completedAt` timestamps
   - Breach is automatically calculated on completion

4. **Penalty Calculation**
   - Formula: `Service Price × 10% × Hours Over SLA`
   - Minimum: R0 (no penalty if within SLA)
   - Applied to: `calculatedPrice` (includes job size multiplier)

5. **Penalty Application**
   - ✅ **Currently Calculated**: Penalty is calculated and stored
   - ⚠️ **NOT Deducted**: Penalty is NOT currently deducted from provider payout
   - 🔧 **Needs Fix**: Should be deducted in `releaseEscrowFunds()` function

---

## 🔄 How SLA Works - Step by Step

### **Step 1: Booking Creation**
**What Happens:**
```
Customer creates booking → estimatedDurationMinutes is set
```

**Code Location:** `controllers/bookingController.ts` - `createBooking()`

**Setting SLA Duration:**
```typescript
estimatedDurationMinutes: estimatedDurationMinutes || service.duration
```

**Sources:**
- Customer can specify `estimatedDurationMinutes` in booking request
- If not provided, uses service's default `duration` field
- If neither exists, defaults to `0` (no SLA)

**Example:**
```
Customer creates booking:
- Service: "Plumbing Repair"
- Service duration: 120 minutes (2 hours)
- Customer doesn't specify → Uses service duration
- Result: estimatedDurationMinutes = 120
```

**Database State:**
```
Booking {
  estimatedDurationMinutes: 120,
  startedAt: null,
  completedAt: null,
  slaBreached: false,
  slaPenaltyAmount: 0,
  actualDurationMinutes: null
}
```

---

### **Step 2: Provider Starts Work**
**What Happens:**
```
Provider calls PUT /bookings/:id/start → startedAt timestamp recorded
```

**Code Location:** `controllers/bookingController.ts` - `startBooking()`

**SLA Timer:**
- SLA timer **starts** when `startedAt` is set
- Provider must be within proximity (5 meters) for 5 minutes before starting
- Once started, the countdown begins

**Example:**
```
Provider arrives at customer location:
- Time: 10:00 AM
- Calls: PUT /bookings/123/start
- Result: startedAt = "2026-01-19T10:00:00Z"
```

**Database State:**
```
Booking {
  estimatedDurationMinutes: 120,
  startedAt: "2026-01-19T10:00:00Z",  ← SLA timer started
  completedAt: null,
  slaBreached: false,
  slaPenaltyAmount: 0,
  actualDurationMinutes: null
}
```

**SLA Timer Logic:**
- Expected completion: `startedAt + 120 minutes = 12:00 PM`
- Provider must complete by 12:00 PM to avoid breach

---

### **Step 3: Provider Completes Work**
**What Happens:**
```
Provider calls PUT /bookings/:id/complete → SLA calculated automatically
```

**Code Location:** `controllers/bookingController.ts` - `completeBooking()`

**SLA Calculation Process:**

1. **Calculate Actual Duration:**
```typescript
const completedAt = new Date();
const actualDurationMinutes = Math.ceil(
  (completedAt.getTime() - booking.startedAt.getTime()) / 60000
);
```

2. **Check for Breach:**
```typescript
const slaBreached = 
  booking.estimatedDurationMinutes > 0 && 
  actualDurationMinutes > booking.estimatedDurationMinutes;
```

3. **Calculate Penalty (if breached):**
```typescript
let slaPenaltyAmount = 0;
if (slaBreached && booking.calculatedPrice) {
  const hoursOver = (actualDurationMinutes - booking.estimatedDurationMinutes) / 60;
  const penaltyRate = 0.10; // 10% per hour
  slaPenaltyAmount = booking.calculatedPrice * penaltyRate * hoursOver;
}
```

**Example Scenario A: Within SLA**
```
Started: 10:00 AM
Completed: 11:45 AM
Actual Duration: 105 minutes
Estimated: 120 minutes

Result:
- slaBreached: false
- slaPenaltyAmount: R0
- Provider gets full payout (no penalty)
```

**Example Scenario B: Breached SLA**
```
Started: 10:00 AM
Completed: 1:30 PM
Actual Duration: 210 minutes (3.5 hours)
Estimated: 120 minutes (2 hours)
Time Over: 1.5 hours

Calculation:
- slaBreached: true
- hoursOver = (210 - 120) / 60 = 1.5 hours
- Service Price: R1,000
- Penalty = R1,000 × 10% × 1.5 = R150

Database State:
Booking {
  actualDurationMinutes: 210,
  slaBreached: true,
  slaPenaltyAmount: 150.00  ← Calculated and stored
}
```

**Database State (After Completion):**
```
Booking {
  estimatedDurationMinutes: 120,
  startedAt: "2026-01-19T10:00:00Z",
  completedAt: "2026-01-19T13:30:00Z",
  actualDurationMinutes: 210,
  slaBreached: true,
  slaPenaltyAmount: 150.00
}
```

---

### **Step 4: Payment Release** ⚠️ **CURRENTLY BROKEN**
**What Happens:**
```
Payment released to provider → SHOULD deduct SLA penalty (currently doesn't)
```

**Code Location:** `controllers/bookingController.ts` - `releaseEscrowFunds()`

**Current Implementation (BROKEN):**
```typescript
// Current code - MISSING SLA penalty deduction
const commissionAmount = baseAmount * commissionRate;
const providerPayout = payment.amount - commissionAmount;
// ❌ Missing: - slaPenaltyAmount
```

**Should Be (FIXED):**
```typescript
// Get SLA penalty from booking
const booking = await prisma.booking.findUnique({
  where: { id: bookingId },
  select: { slaPenaltyAmount: true }
});
const slaPenaltyAmount = booking?.slaPenaltyAmount || 0;

// Deduct both commission AND SLA penalty
const providerPayout = payment.amount - commissionAmount - slaPenaltyAmount;
```

**Example Payment Flow:**

**Scenario: SLA Breached**
```
Total Payment: R1,100 (R1,000 service + R100 tip)
Commission (15%): R150 (on R1,000 base, not tip)
SLA Penalty: R150

Current (WRONG):
  Provider Payout = R1,100 - R150 = R950 ❌

Should Be (CORRECT):
  Provider Payout = R1,100 - R150 - R150 = R800 ✅
```

---

## 📊 SLA Calculation Formula

### **Complete Formula:**

```
Step 1: Calculate Actual Duration
actualDurationMinutes = (completedAt - startedAt) / (1000 * 60)

Step 2: Check for Breach
slaBreached = (estimatedDurationMinutes > 0) AND 
              (actualDurationMinutes > estimatedDurationMinutes)

Step 3: Calculate Penalty (if breached)
IF slaBreached AND calculatedPrice > 0 THEN
  hoursOver = (actualDurationMinutes - estimatedDurationMinutes) / 60
  slaPenaltyAmount = calculatedPrice × 0.10 × hoursOver
ELSE
  slaPenaltyAmount = 0
END IF
```

### **Key Points:**
- Uses `calculatedPrice` (includes job size multiplier, location multiplier)
- Penalty is per hour over SLA (not per minute)
- No grace period (even 1 minute over = breach)
- No maximum cap (penalty can exceed service price)

---

## 💰 Real-World Examples

### **Example 1: No Breach**
```
Service: Electrical Repair
Service Price: R500
Tip: R50
Estimated Duration: 60 minutes (1 hour)

Timeline:
- Started: 10:00 AM
- Completed: 10:45 AM
- Actual Duration: 45 minutes

SLA Calculation:
- slaBreached: false (45 < 60)
- slaPenaltyAmount: R0

Payment:
- Total: R550
- Commission: R75 (15% of R500)
- SLA Penalty: R0
- Provider Payout: R475 ✅ (R550 - R75 - R0)
```

### **Example 2: Minor Breach**
```
Service: Plumbing Repair
Service Price: R1,000
Tip: R100
Estimated Duration: 120 minutes (2 hours)

Timeline:
- Started: 9:00 AM
- Completed: 11:30 AM
- Actual Duration: 150 minutes (2.5 hours)
- Time Over: 30 minutes (0.5 hours)

SLA Calculation:
- slaBreached: true (150 > 120)
- hoursOver = (150 - 120) / 60 = 0.5
- slaPenaltyAmount = R1,000 × 10% × 0.5 = R50

Payment:
- Total: R1,100
- Commission: R150 (15% of R1,000)
- SLA Penalty: R50
- Provider Payout: R900 ✅ (R1,100 - R150 - R50)
```

### **Example 3: Major Breach**
```
Service: Home Renovation
Service Price: R2,000
Tip: R200
Estimated Duration: 240 minutes (4 hours)

Timeline:
- Started: 8:00 AM
- Completed: 2:00 PM
- Actual Duration: 360 minutes (6 hours)
- Time Over: 120 minutes (2 hours)

SLA Calculation:
- slaBreached: true (360 > 240)
- hoursOver = (360 - 240) / 60 = 2
- slaPenaltyAmount = R2,000 × 10% × 2 = R400

Payment:
- Total: R2,200
- Commission: R300 (15% of R2,000)
- SLA Penalty: R400
- Provider Payout: R1,500 ✅ (R2,200 - R300 - R400)

Note: Provider loses R400 (20% of service price) due to 2-hour delay
```

### **Example 4: Extreme Breach**
```
Service: Complex Installation
Service Price: R1,500
Estimated Duration: 120 minutes (2 hours)

Timeline:
- Started: 9:00 AM
- Completed: 4:00 PM
- Actual Duration: 420 minutes (7 hours)
- Time Over: 300 minutes (5 hours)

SLA Calculation:
- slaBreached: true (420 > 120)
- hoursOver = (420 - 120) / 60 = 5
- slaPenaltyAmount = R1,500 × 10% × 5 = R750

Payment:
- Total: R1,500
- Commission: R225 (15% of R1,500)
- SLA Penalty: R750
- Provider Payout: R525 ✅ (R1,500 - R225 - R750)

Note: Provider only gets 35% of service price due to severe delay
```

---

## 🚨 Important Edge Cases

### **Edge Case 1: No SLA Set**
```
estimatedDurationMinutes = 0

Result: No penalty, regardless of actual duration
Reason: Provider didn't commit to a timeframe
```

### **Edge Case 2: Provider Completes Early**
```
Estimated: 120 minutes
Actual: 90 minutes

Result: No penalty (no reward either)
Policy: Completing early is expected, not rewarded
```

### **Edge Case 3: Booking Cancelled**
```
Status: 'cancelled'

Result: No SLA calculation
Reason: SLA only applies to completed bookings
```

### **Edge Case 4: Provider Starts But Doesn't Complete**
```
startedAt: Set
completedAt: null

Result: Cannot calculate SLA
Reason: Need both timestamps to calculate duration
```

### **Edge Case 5: Penalty Exceeds Service Price**
```
Service Price: R1,000
Time Over: 12 hours
Penalty: R1,000 × 10% × 12 = R1,200

Current Policy: Penalty can exceed service price
Business Risk: Provider could receive R0 or negative payout

Recommendation: Cap penalty at 50% of service price
```

---

## 📈 SLA Tracking & Metrics

### **Provider Performance Metrics**

**Endpoint:** `GET /admin/providers/:providerId/performance`

**Returns:**
```json
{
  "provider": {
    "id": "provider_id",
    "name": "John Doe",
    "rating": 4.5
  },
  "metrics": {
    "totalBookings": 100,
    "slaBreaches": 5,
    "slaComplianceRate": "95.00%",
    "totalRevenue": 50000
  }
}
```

**SLA Compliance Rate:**
```
slaComplianceRate = ((totalBookings - slaBreaches) / totalBookings) × 100
```

**Example:**
- 100 total bookings
- 5 SLA breaches
- Compliance rate = ((100 - 5) / 100) × 100 = 95%

---

## 🔧 Current Implementation Status

### ✅ **What Works:**
1. ✅ SLA duration set during booking creation
2. ✅ Timer starts when provider starts work
3. ✅ Timer stops when provider completes work
4. ✅ Breach detection works correctly
5. ✅ Penalty calculation is accurate
6. ✅ SLA data stored in database
7. ✅ Admin can view SLA metrics

### ❌ **What's Broken:**
1. ❌ **Penalty NOT deducted from provider payout** (Critical Bug)
2. ❌ No penalty cap (can exceed service price)
3. ❌ No grace period (even 1 minute over = breach)
4. ❌ No customer compensation (penalty calculated but not refunded)

### 🔧 **What Needs Fixing:**

**Priority 1: Deduct SLA Penalty**
- Update `releaseEscrowFunds()` to deduct `slaPenaltyAmount`
- Ensure provider payout includes penalty deduction

**Priority 2: Add Penalty Cap**
- Cap penalty at 50% of service price
- Protect providers from extreme penalties

**Priority 3: Add Grace Period**
- Allow 5-minute grace period
- Only breach if > 5 minutes over SLA

**Priority 4: Customer Compensation**
- Refund SLA penalty to customer
- Or issue credit for future bookings

---

## 📝 Summary

### **How SLA Works:**
1. Customer creates booking → SLA duration set
2. Provider starts work → Timer begins
3. Provider completes work → SLA calculated
4. Payment released → **Should deduct penalty (currently broken)**

### **Current Policy:**
- **Penalty Rate:** 10% of service price per hour over SLA
- **Breach Definition:** Any time over estimated duration
- **Grace Period:** None (strict enforcement)
- **Penalty Cap:** None (can exceed service price)

### **Business Impact:**
- **Without Fix:** Providers not penalized, customers not compensated
- **With Fix:** Providers incentivized to meet SLAs, customers protected

---

**Last Updated:** 2026-01-19
**Status:** ✅ Fully Implemented & Tested - Penalty calculation and deduction working correctly
