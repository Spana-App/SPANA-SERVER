# Integration Status

## Overview
This document tracks the status of third-party integrations in the SPANA platform.

---

## Payment Gateway: PayFast

**Status:** ⚠️ **DISABLED** (Credentials not configured)

### Current Behavior
- Payment endpoints return `503 Service Unavailable` with clear error message
- Error includes instructions on how to enable PayFast
- Payment simulation is **disabled** when credentials are missing
- System continues to function normally for other features

### To Enable PayFast:
1. Sign up at https://www.payfast.co.za/
2. Get your Merchant ID, Merchant Key, and Passphrase
3. Add to `.env`:
   ```env
   PAYFAST_MERCHANT_ID=your_merchant_id
   PAYFAST_MERCHANT_KEY=your_merchant_key
   PAYFAST_PASSPHRASE=your_passphrase
   PAYFAST_URL=https://sandbox.payfast.co.za/eng/process
   ```
4. Restart server

### API Response When Disabled:
```json
{
  "message": "PayFast payment gateway is not configured. Payment simulation is disabled.",
  "error": "PAYFAST_NOT_CONFIGURED",
  "instructions": "To enable PayFast payments, add PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, and PAYFAST_PASSPHRASE to your .env file",
  "paymentId": "...",
  "amount": 1000.00,
  "simulated": false
}
```

---

## Maps: Google Maps API

**Status:** ⚠️ **DISABLED** (API key not configured)

### Current Behavior
- Map endpoints return `503 Service Unavailable` with clear error message
- Error includes instructions on how to enable Google Maps
- System falls back to basic Haversine distance calculation where possible
- Other features continue to work normally

### To Enable Google Maps:
1. Go to https://console.cloud.google.com/
2. Create/select a project
3. Enable APIs:
   - Maps JavaScript API
   - Geocoding API
   - Directions API
   - Distance Matrix API
4. Create API Key
5. Add to `.env`:
   ```env
   GOOGLE_MAPS_API_KEY=your_api_key_here
   ```
6. Restart server

### API Response When Disabled:
```json
{
  "message": "Google Maps API is not configured",
  "error": "GOOGLE_MAPS_NOT_CONFIGURED",
  "instructions": "To enable Google Maps features, add GOOGLE_MAPS_API_KEY to your .env file",
  "fallback": "Please provide coordinates directly or configure GOOGLE_MAPS_API_KEY"
}
```

---

## Features That Work Without Integrations

### ✅ Fully Functional:
- User registration and authentication
- Service creation and management
- Booking creation (same-day, immediate)
- Provider matching (online status, skills, location)
- Location tracking (coordinates stored, Haversine distance calculation)
- Chat functionality
- Rating and reviews
- Admin operations
- Email notifications (SMTP)

### ⚠️ Limited Functionality:
- **Payment:** Cannot process real payments (but booking flow works)
- **Maps:** No geocoding, no route visualization (but coordinates work)

---

## Testing Without Integrations

The system is designed to work without these integrations:

1. **Payment Testing:**
   - Create bookings normally
   - Payment endpoints will return clear error messages
   - Use direct database updates for testing payment flow

2. **Maps Testing:**
   - Provide coordinates directly (no geocoding)
   - Use Haversine distance calculation (basic distance only)
   - Map visualization endpoints will return errors

---

## Enabling Integrations Later

When ready to enable:

1. **PayFast:**
   - Get credentials from PayFast dashboard
   - Add to `.env` file
   - Restart server
   - Test with sandbox credentials first

2. **Google Maps:**
   - Get API key from Google Cloud Console
   - Add to `.env` file
   - Restart server
   - Monitor API usage in Google Cloud Console

---

## Environment Variables Reference

### Required for Full Functionality:
```env
# Database (Required)
DATABASE_URL=...

# JWT (Required)
JWT_SECRET=...

# SMTP (Required for emails)
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...

# PayFast (Optional - for payments)
PAYFAST_MERCHANT_ID=...
PAYFAST_MERCHANT_KEY=...
PAYFAST_PASSPHRASE=...
PAYFAST_URL=...

# Google Maps (Optional - for maps)
GOOGLE_MAPS_API_KEY=...
```

---

## Support

- PayFast Setup: See `PAYFAST_MAPS_INTEGRATION.md`
- Google Maps Setup: See `PAYFAST_MAPS_INTEGRATION.md`
- General Issues: Check server logs for specific error messages
