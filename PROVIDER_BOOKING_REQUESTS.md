# 📨 How Service Providers Receive Booking Requests

## Overview

Service providers receive booking requests through **two main methods**:
1. **Real-time Socket.io notifications** (instant)
2. **API endpoint polling** (`GET /bookings`)

---

## 🔴 Method 1: Real-Time Socket.io Notifications (Primary)

### How It Works

When a customer creates a booking:
1. System matches the best available provider
2. **Socket.io emits `new-booking-request` event** to the matched provider
3. Provider receives instant notification in their app

### Socket.io Event Details

**Event Name:** `new-booking-request`  
**Sent To:** Provider's user ID (room: `provider.user.id`)  
**When:** Immediately after booking is created

**Event Payload:**
```json
{
  "bookingId": "cmlfpuqup00474eakgyxzpast",
  "service": "Plumbing Service",
  "customer": "John Doe",
  "date": "2026-02-09T22:30:00.000Z",
  "time": "22:30",
  "location": {
    "type": "Point",
    "coordinates": [28.0473, -26.2041],
    "address": "123 Main Street, Johannesburg, South Africa"
  },
  "distance": 2.5,
  "adjustedPrice": 750.00
}
```

### Provider Requirements

For a provider to receive booking requests, they must:
- ✅ **Be online** (`isOnline: true`)
- ✅ **Not be busy** (no active bookings)
- ✅ **Have complete profile** (`isProfileComplete: true`)
- ✅ **Be verified** (`isVerified: true`, `isIdentityVerified: true`)
- ✅ **Have active application status** (`applicationStatus: 'active'`)
- ✅ **Be within service area** (customer location within `serviceAreaRadius`)

### Code Location

**File:** `controllers/bookingController.ts`  
**Function:** `exports.createBooking`  
**Lines:** 282-298

```typescript
// Notify matched provider via socket
try {
  const app = require('../server');
  const io = app.get && app.get('io');
  if (io && providerMatch && providerMatch.provider && providerMatch.provider.user) {
    io.to(providerMatch.provider.user.id).emit('new-booking-request', {
      bookingId: booking.id,
      service: service.title,
      customer: `${req.user.firstName} ${req.user.lastName}`,
      date: booking.date,
      time: booking.time,
      location: booking.location,
      distance: providerMatch.distance,
      adjustedPrice: calculatedPrice
    });
  }
} catch (_) {}
```

---

## 🔵 Method 2: API Endpoint Polling (Fallback/Refresh)

### Endpoint

**GET** `/bookings`  
**Auth:** Required (Provider JWT token)

### How It Works

Providers can fetch their booking requests via API:

```javascript
// Get all bookings for provider's services
GET /bookings
Headers: Authorization: Bearer <PROVIDER_JWT>
```

### Response

Returns array of bookings for services owned by the provider:

```json
[
  {
    "id": "booking_id",
    "referenceNumber": "SPANA-BK-000001",
    "status": "pending_payment",
    "requestStatus": "pending",
    "date": "2026-02-09T22:30:00.000Z",
    "time": "22:30",
    "location": {
      "type": "Point",
      "coordinates": [28.0473, -26.2041],
      "address": "123 Main Street, Johannesburg"
    },
    "calculatedPrice": 750.00,
    "service": {
      "id": "service_id",
      "title": "Plumbing Service",
      "category": "Plumbing"
    },
    "customer": {
      "id": "customer_id",
      "user": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "JohnDoe1770674387653@yahoo.com"
      }
    },
    "createdAt": "2026-02-09T22:00:00.000Z"
  }
]
```

### Filtering Pending Requests

Providers can filter for pending requests:

```javascript
// Get only pending booking requests
const bookings = await fetch('/bookings', {
  headers: { Authorization: `Bearer ${providerToken}` }
});
const pendingRequests = bookings.filter(b => b.requestStatus === 'pending');
```

### Code Location

**File:** `controllers/bookingController.ts`  
**Function:** `exports.getUserBookings`  
**Lines:** 984-1066

**Provider Logic:**
```typescript
// Get provider's services
const serviceProvider = await prisma.serviceProvider.findUnique({
  where: { userId: req.user.id }
});

// Get services offered by provider
const services = await prisma.service.findMany({ 
  where: { providerId: serviceProvider.id }
});

// Get bookings for those services
const bookings = await prisma.booking.findMany({ 
  where: { serviceId: { in: serviceIds } }
});
```

---

## 📱 Mobile App Integration

### Socket.io Connection

**File:** `spana-mobile-app/screens/provider/BookingRequestsScreen.js`

Providers connect to Socket.io and listen for booking requests:

```javascript
// Connect to Socket.io
const socket = io(API_BASE_URL, {
  auth: { token: providerToken }
});

// Listen for new booking requests
socket.on('new-booking-request', (data) => {
  console.log('New booking request received:', data);
  // Update UI, show notification, etc.
  setBookingRequests(prev => [data, ...prev]);
});

// Join provider's personal room
socket.on('connect', () => {
  socket.emit('authenticate', { token: providerToken });
});
```

### API Polling (Fallback)

If Socket.io connection fails, providers can poll the API:

```javascript
// Poll for new booking requests every 30 seconds
setInterval(async () => {
  const response = await fetch('/bookings', {
    headers: { Authorization: `Bearer ${providerToken}` }
  });
  const bookings = await response.json();
  const pending = bookings.filter(b => b.requestStatus === 'pending');
  setBookingRequests(pending);
}, 30000);
```

---

## 🔄 Complete Flow

### Step-by-Step Process

1. **Customer Creates Booking**
   - `POST /bookings` with `serviceId` or `serviceTitle`
   - System matches best available provider

2. **Provider Matching**
   - Checks provider availability (`isOnline: true`)
   - Checks provider not busy
   - Checks location proximity
   - Checks skills match
   - Checks profile completeness

3. **Real-Time Notification**
   - Socket.io emits `new-booking-request` to provider
   - Provider receives instant notification in app

4. **Provider Views Request**
   - Via Socket.io event (real-time)
   - Via `GET /bookings` API (on app refresh)

5. **Provider Accepts/Declines**
   - `POST /bookings/:id/accept` - Accept booking
   - `POST /bookings/:id/decline` - Decline booking

---

## 📊 Booking Request Status

### Request Status Values

- `pending` - Waiting for provider response
- `accepted` - Provider accepted the request
- `declined` - Provider declined the request
- `expired` - Request expired (timeout)

### Booking Status Values

- `pending_payment` - Waiting for customer payment
- `confirmed` - Payment received, provider accepted
- `in_progress` - Provider started the job
- `completed` - Job completed
- `cancelled` - Booking cancelled

---

## 🔔 Additional Notifications

### Email Notifications

Providers also receive email notifications for:
- New booking request
- Booking accepted confirmation
- Booking declined confirmation
- Payment received
- Job completion

**Email Template:** `config/mailer.ts` → `sendNewBookingRequestEmail()`

### Push Notifications (Future)

Push notifications can be added for:
- New booking request
- Booking status updates
- Payment confirmations

---

## 🛠️ Testing Provider Request Reception

### Test Socket.io Connection

```javascript
// Connect as provider
const socket = io('http://localhost:5003', {
  auth: { token: providerToken }
});

socket.on('connect', () => {
  console.log('✅ Connected to Socket.io');
});

socket.on('new-booking-request', (data) => {
  console.log('📨 New booking request:', data);
});
```

### Test API Endpoint

```bash
# Get provider bookings
curl -X GET http://localhost:5003/bookings \
  -H "Authorization: Bearer <PROVIDER_TOKEN>"
```

---

## 📝 Summary

**Primary Method:** Socket.io real-time notifications (`new-booking-request` event)  
**Fallback Method:** API polling (`GET /bookings`)  
**Requirements:** Provider must be online, verified, and have complete profile  
**Response:** Provider accepts/declines via `POST /bookings/:id/accept` or `/decline`

---

**Last Updated:** February 4, 2026
