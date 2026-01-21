# Booking Flow Documentation

## Overview
SPANA uses an **Uber-style booking system** where customers pay first, then providers accept. All bookings are **same-day/immediate** - no future date bookings allowed.

---

## 📱 **CUSTOMER PERSPECTIVE**

### **Step 1: Create Booking Request**
**Endpoint:** `POST /bookings`  
**Auth:** Required (Customer)

**What Customer Does:**
1. Browse services or search by service title
2. Select service (or provide service title + required skills)
3. Provide:
   - **Location** (coordinates + address) - **REQUIRED**
   - **Date & Time** (must be today, cannot be in past)
   - **Job Size** (small/medium/large/custom)
   - **Notes** (optional)
   - **Estimated Duration** (optional, defaults to service duration)

**What Happens Behind the Scenes:**
- System finds best available provider using:
  - Service title/skills matching
  - Provider availability (online + not busy)
  - Location proximity
  - Location multiplier (price adjustment based on area)
- **Booking created** with status: `pending_payment`
- **Provider notified** via Socket.io (but cannot see customer details yet)
- **Workflow created** with steps:
  1. ✅ Booking Request Created
  2. ⏳ Provider Assigned
  3. ⏳ Payment Received
  4. ⏳ Provider En Route
  5. ⏳ Service In Progress
  6. ⏳ Service Completed

**Response:**
```json
{
  "message": "Booking created. Provider matched and notified. Payment required before service starts.",
  "booking": { ... },
  "providerMatched": true,
  "providerDistance": 2.5,
  "locationMultiplier": 1.2,
  "paymentRequired": true,
  "amount": 600.00,
  "nextStep": "payment"
}
```

**Key Points:**
- Customer **does NOT see provider details** until provider accepts (Uber-style privacy)
- Booking is **queued** if no providers available
- Price calculated: `basePrice × jobSizeMultiplier × locationMultiplier`

---

### **Step 2: Make Payment**
**Endpoint:** `POST /payments/intent`  
**Auth:** Required (Customer)

**What Customer Does:**
1. Review booking details and price
2. Add optional tip
3. Complete payment via PayFast (or simulation mode)

**What Happens Behind the Scenes:**
- Payment created with `escrowStatus: 'held'`
- Commission calculated (15% of base amount, tip goes 100% to provider)
- **Customer chat token generated** (for booking chat)
- Booking status updated: `pending_acceptance`
- Payment status: `paid_to_escrow`
- **Workflow updated:** "Payment Received" → completed

**Response:**
```json
{
  "message": "Payment processed successfully. Booking confirmed.",
  "payment": {
    "escrowStatus": "held",
    "commissionAmount": 90.00,
    "providerPayout": 510.00
  },
  "booking": {
    "status": "pending_acceptance",
    "paymentStatus": "paid_to_escrow"
  }
}
```

**Key Points:**
- Payment held in escrow (not released to provider yet)
- Customer can chat once payment confirmed (but provider must also accept)
- Invoice sent to customer email

---

### **Step 3: Wait for Provider Acceptance**
**Status:** `pending_acceptance` → `confirmed`

**What Customer Sees:**
- Booking status: "Waiting for provider to accept"
- Can track provider location (once provider accepts and starts en route)
- Can chat with provider (once both tokens exist)

**What Happens:**
- Provider receives notification
- Provider can accept or decline
- If accepted: Status → `confirmed`, chat activated
- If declined: Refund processed, booking cancelled

---

### **Step 4: Service Execution**
**Status:** `confirmed` → `in_progress` → `completed`

**What Customer Does:**
- Track provider location in real-time
- Chat with provider during service
- Wait for provider to complete work

**What Happens:**
- Provider must be within **2 meters** for **5 minutes** before starting
- Provider calls `POST /bookings/:id/start` → Status: `in_progress`
- SLA timer starts (countdown from estimated duration)
- Provider completes work → Calls `POST /bookings/:id/complete`
- Escrow funds released to provider
- Chat terminated

---

### **Step 5: Rate & Review**
**Endpoint:** `POST /bookings/:id/rate`  
**Auth:** Required (Customer)

**What Customer Does:**
- Rate provider (1-5 stars)
- Write review
- Provider rating updated

---

## 🔧 **SERVICE PROVIDER PERSPECTIVE**

### **Step 1: Receive Booking Request**
**Notification:** Socket.io event `new-booking-request`

**What Provider Sees:**
- Service title
- Customer name (first name only initially)
- Date & time
- Location & distance
- Adjusted price (with location multiplier)
- **Booking ID**

**What Provider Does NOT See:**
- Full customer details (until accepting)
- Customer contact info
- Exact address (until accepting)

**Key Points:**
- Provider must be **online** (`isOnline: true`)
- Provider must **not be busy** (no active bookings)
- Provider must have **complete profile** (`isProfileComplete: true`)

---

### **Step 2: Accept or Decline Booking**
**Endpoint:** `POST /bookings/:id/accept` or `POST /bookings/:id/decline`  
**Auth:** Required (Service Provider)  
**Middleware:** `providerReady` (checks profile completeness)

**Accept Booking:**
**Requirements:**
- Payment must be completed (`paymentStatus: 'paid_to_escrow'`)
- Request status must be `pending`
- Provider must own the service

**What Happens:**
- Booking status: `pending_acceptance` → `confirmed`
- Request status: `pending` → `accepted`
- **Provider chat token generated**
- If customer already paid: Chat activated (`chatActive: true`)
- **Workflow updated:** "Provider Assigned" → completed
- Customer notified via Socket.io

**Response:**
```json
{
  "message": "Booking accepted",
  "booking": {
    "status": "confirmed",
    "requestStatus": "accepted",
    "providerAcceptedAt": "2026-01-21T12:00:00Z",
    "chatActive": true
  }
}
```

**Decline Booking:**
- Request status: `pending` → `declined`
- Customer refund processed
- Booking cancelled
- Alternative provider matched (if available)

---

### **Step 3: Navigate to Customer Location**
**Status:** `confirmed`

**What Provider Does:**
- Update live location via `POST /bookings/:id/location`
- Navigate to customer location
- Customer can track provider in real-time

**Proximity Check:**
- Provider and customer must be within **2 meters** for **5 minutes**
- System tracks proximity automatically
- `canStartJob: true` when proximity requirement met

---

### **Step 4: Start Service**
**Endpoint:** `POST /bookings/:id/start`  
**Auth:** Required (Service Provider)  
**Middleware:** `providerReady`

**Requirements:**
- Booking must be `accepted`
- Payment must be `paid_to_escrow`
- Proximity requirement met (`canStartJob: true`)

**What Happens:**
- Booking status: `confirmed` → `in_progress`
- `startedAt` timestamp recorded
- **SLA timer starts** (countdown from `estimatedDurationMinutes`)
- **Workflow updated:**
  - "Provider En Route" → completed
  - "Service In Progress" → in_progress
- Customer notified

**SLA Logic:**
- Expected completion: `startedAt + estimatedDurationMinutes`
- If exceeded: SLA breach penalty (10% per hour over)

---

### **Step 5: Complete Service**
**Endpoint:** `POST /bookings/:id/complete`  
**Auth:** Required (Service Provider)  
**Middleware:** `providerReady`

**What Happens:**
- Booking status: `in_progress` → `completed`
- `completedAt` timestamp recorded
- **SLA calculated:**
  - `actualDurationMinutes` = time between `startedAt` and `completedAt`
  - `slaBreached` = `actualDurationMinutes > estimatedDurationMinutes`
  - `slaPenaltyAmount` = 10% of price per hour over SLA
- **Escrow funds released** to provider (minus commission & SLA penalty)
- **Chat terminated** (`chatActive: false`, `chatTerminatedAt` set)
- **Workflow updated:** "Service Completed" → completed
- Customer notified

**Response:**
```json
{
  "booking": {
    "status": "completed",
    "completedAt": "2026-01-21T14:30:00Z",
    "actualDurationMinutes": 125,
    "slaBreached": true,
    "slaPenaltyAmount": 12.50
  },
  "payment": {
    "escrowStatus": "released",
    "providerPayout": 497.50
  }
}
```

**Payment Calculation:**
```
Total Amount: R600.00
Commission (15%): R90.00
SLA Penalty: R12.50
Provider Payout: R497.50
```

---

### **Step 6: Rate Customer**
**Endpoint:** `POST /bookings/:id/rate-customer`  
**Auth:** Required (Service Provider)

**What Provider Does:**
- Rate customer (1-5 stars)
- Write review
- Customer rating updated

---

## 🔄 **BOOKING STATUS FLOW**

```
pending_payment
    ↓ (Customer pays)
pending_acceptance
    ↓ (Provider accepts)
confirmed
    ↓ (Provider starts)
in_progress
    ↓ (Provider completes)
completed
```

**Alternative Paths:**
- `pending_payment` → `cancelled` (Customer cancels before payment)
- `pending_acceptance` → `cancelled` (Provider declines → refund)
- `confirmed` → `cancelled` (Either party cancels → refund)

---

## 💰 **PAYMENT & ESCROW FLOW**

1. **Customer Pays** → Funds held in escrow (`escrowStatus: 'held'`)
2. **Provider Accepts** → Booking confirmed, funds still held
3. **Provider Starts** → Service begins, funds still held
4. **Provider Completes** → Funds released (`escrowStatus: 'released'`)
   - Commission deducted (15%)
   - SLA penalty deducted (if breached)
   - Remaining → Provider payout

**Refund Scenarios:**
- Provider declines → Full refund to customer
- Customer cancels → Full refund (minus cancellation fee if applicable)
- Service not completed → Refund processed by admin

---

## 📍 **LOCATION & PROXIMITY**

**Requirements:**
- Customer must provide location (coordinates + address)
- Provider must update live location during service
- **Proximity check:** Provider and customer within 2 meters for 5 minutes before starting
- Real-time tracking via Socket.io

---

## ⏱️ **SLA (Service Level Agreement)**

**How It Works:**
1. Customer provides `estimatedDurationMinutes` (or uses service default)
2. SLA timer starts when provider calls `start`
3. Provider must complete within estimated time
4. If exceeded: Penalty = 10% of price per hour over

**Example:**
- Estimated: 120 minutes (2 hours)
- Actual: 150 minutes (2.5 hours)
- Over by: 30 minutes (0.5 hours)
- Penalty: R600 × 10% × 0.5 = R30.00

---

## 💬 **CHAT SYSTEM**

**Activation:**
- Customer chat token generated when payment confirmed
- Provider chat token generated when provider accepts
- Chat activated when both tokens exist (`chatActive: true`)

**Termination:**
- Chat terminated when booking completed (`chatTerminatedAt` set)
- No chat after service completion

**Access:**
- Both customer and provider can chat during active booking
- Chat room: `booking:{bookingId}`
- Messages broadcast to booking room

---

## 🔔 **NOTIFICATIONS**

**Customer Receives:**
- Booking created confirmation
- Payment confirmation
- Provider accepted notification
- Provider en route notification
- Service started notification
- Service completed notification

**Provider Receives:**
- New booking request (Socket.io)
- Payment received notification
- Customer location updates
- Booking status updates

---

## 📊 **WORKFLOW STEPS**

1. ✅ **Booking Request Created** - Customer creates booking
2. ✅ **Provider Assigned** - Provider accepts booking
3. ✅ **Payment Received** - Customer pays
4. ✅ **Provider En Route** - Provider starts navigating
5. ⏳ **Service In Progress** - Provider starts work
6. ✅ **Service Completed** - Provider completes work

---

## 🚫 **RESTRICTIONS**

**Customer:**
- Must have location set in profile
- Can only book for today (no future dates)
- Cannot book in the past
- Must pay before provider accepts

**Provider:**
- Must have complete profile (`isProfileComplete: true`)
- Must be online (`isOnline: true`)
- Must not be busy (no active bookings)
- Must be within proximity before starting
- Must complete within SLA or face penalty

---

## 📝 **KEY ENDPOINTS**

### Customer Endpoints:
- `POST /bookings` - Create booking
- `POST /payments/intent` - Make payment
- `GET /bookings` - View my bookings
- `GET /bookings/:id` - View booking details
- `POST /bookings/:id/rate` - Rate provider
- `PUT /bookings/:id/cancel` - Cancel booking

### Provider Endpoints:
- `POST /bookings/:id/accept` - Accept booking
- `POST /bookings/:id/decline` - Decline booking
- `POST /bookings/:id/start` - Start service
- `POST /bookings/:id/complete` - Complete service
- `POST /bookings/:id/location` - Update location
- `POST /bookings/:id/rate-customer` - Rate customer

---

## 🎯 **SUMMARY**

**Customer Flow:**
1. Create booking → 2. Pay → 3. Wait for acceptance → 4. Track provider → 5. Service → 6. Rate

**Provider Flow:**
1. Receive request → 2. Accept → 3. Navigate → 4. Start → 5. Complete → 6. Get paid → 7. Rate customer

**Key Principle:** **Pay First, Service Later** (Uber-style escrow system)
