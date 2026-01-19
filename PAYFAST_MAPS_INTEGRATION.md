# PayFast & Google Maps Integration Guide

## Overview
This document describes the integration of PayFast payment gateway and Google Maps API into the SPANA platform.

---

## PayFast Payment Gateway Integration

### Setup Instructions

1. **Get PayFast Credentials**
   - Sign up at: https://www.payfast.co.za/
   - Navigate to: Settings → API Credentials
   - Copy your Merchant ID, Merchant Key, and Passphrase

2. **Configure Environment Variables**
   Add to your `.env` file:
   ```env
   PAYFAST_MERCHANT_ID=your_merchant_id_here
   PAYFAST_MERCHANT_KEY=your_merchant_key_here
   PAYFAST_PASSPHRASE=your_passphrase_here
   PAYFAST_URL=https://sandbox.payfast.co.za/eng/process  # Sandbox for testing
   # PAYFAST_URL=https://www.payfast.co.za/eng/process     # Production
   ```

3. **Payment Flow**
   ```
   Customer creates booking → Payment required → Customer pays via PayFast → 
   Payment held in escrow → Provider accepts → Service starts → Service completes → 
   Admin releases funds → Provider receives payout (minus commission)
   ```

### API Endpoints

#### Create Payment Intent
```http
POST /payments/intent
Authorization: Bearer {customer_token}
Content-Type: application/json

{
  "bookingId": "cmkl...",
  "amount": 1000.00,
  "tipAmount": 100.00  // Optional
}
```

**Response:**
```json
{
  "paymentId": "payment_id",
  "payfastUrl": "https://sandbox.payfast.co.za/eng/process?...",
  "amount": 1100.00,
  "baseAmount": 1000.00,
  "tipAmount": 100.00,
  "currency": "ZAR"
}
```

**Note:** If `PAYFAST_MERCHANT_ID` is not set or `simulate=true`, payment is simulated for testing.

#### PayFast Webhook
```http
POST /payments/payfast-webhook
Content-Type: application/x-www-form-urlencoded
```
PayFast automatically calls this endpoint when payment is completed.

### Testing

**Sandbox Mode:**
- Use sandbox credentials from PayFast dashboard
- Test cards: https://www.payfast.co.za/sandbox/
- Webhook testing: Use ngrok or similar to expose local server

**Simulation Mode:**
- If PayFast credentials not configured, payment is automatically simulated
- Set `simulate: true` in request body for testing

---

## Google Maps API Integration

### Setup Instructions

1. **Get Google Maps API Key**
   - Go to: https://console.cloud.google.com/
   - Create a project or select existing
   - Navigate to: APIs & Services → Credentials
   - Create API Key
   - **Enable these APIs:**
     - Maps JavaScript API
     - Geocoding API
     - Directions API
     - Distance Matrix API

2. **Configure Environment Variable**
   Add to your `.env` file:
   ```env
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   ```

3. **Restrict API Key (Recommended)**
   - In Google Cloud Console → Credentials
   - Click on your API key
   - Under "API restrictions", select "Restrict key"
   - Choose: Maps JavaScript API, Geocoding API, Directions API, Distance Matrix API
   - Under "Application restrictions", add your domain/IP

### API Endpoints

#### Geocode Address
```http
GET /maps/geocode?address=Sandton,+Johannesburg
```

**Response:**
```json
{
  "address": "Sandton, Johannesburg, South Africa",
  "coordinates": {
    "lng": 28.0473,
    "lat": -26.2041
  },
  "placeId": "ChIJ...",
  "types": ["locality", "political"]
}
```

#### Reverse Geocode
```http
GET /maps/reverse-geocode?lat=-26.2041&lng=28.0473
```

**Response:**
```json
{
  "address": "Sandton, Johannesburg, South Africa",
  "coordinates": {
    "lng": 28.0473,
    "lat": -26.2041
  },
  "placeId": "ChIJ...",
  "components": [...]
}
```

#### Calculate Route
```http
GET /maps/route?origin=-26.2041,28.0473&destination=-26.2100,28.0500&mode=driving
```

**Parameters:**
- `origin`: "lat,lng" or address
- `destination`: "lat,lng" or address
- `mode`: "driving" | "walking" | "bicycling" | "transit"

**Response:**
```json
{
  "distance": {
    "text": "2.5 km",
    "value": 2500
  },
  "duration": {
    "text": "5 mins",
    "value": 300
  },
  "startAddress": "Sandton, Johannesburg",
  "endAddress": "Rosebank, Johannesburg",
  "polyline": "encoded_polyline_string",
  "steps": [...]
}
```

#### Get Map Embed URL for Booking
```http
GET /maps/booking/{bookingId}/embed
Authorization: Bearer {token}
```

**Response:**
```json
{
  "embedUrl": "https://www.google.com/maps/embed/v1/view?...",
  "bookingLocation": {
    "coordinates": [28.0473, -26.2041],
    "address": "Sandton, Johannesburg"
  },
  "providerLocation": {
    "coordinates": [28.0500, -26.2100],
    "address": "Rosebank, Johannesburg"
  },
  "customerLocation": {
    "coordinates": [28.0473, -26.2041],
    "address": "Sandton, Johannesburg"
  },
  "distanceApart": 500.5
}
```

#### Get Directions for Booking
```http
GET /maps/booking/{bookingId}/directions
Authorization: Bearer {token}
```

**Response:**
```json
{
  "distance": {
    "text": "2.5 km",
    "value": 2500
  },
  "duration": {
    "text": "5 mins",
    "value": 300
  },
  "directionsUrl": "https://www.google.com/maps/dir/?api=1&origin=...&destination=...",
  "polyline": "encoded_polyline_string",
  "steps": [
    {
      "instruction": "Head north on Main St",
      "distance": "500 m",
      "duration": "1 min"
    }
  ]
}
```

### Fallback Behavior

If Google Maps API is not configured:
- **Geocoding:** Returns error with message to provide coordinates directly
- **Reverse Geocoding:** Returns error with message to provide address directly
- **Route Calculation:** Falls back to Haversine distance calculation
- **Directions:** Returns basic distance and opens Google Maps URL

---

## Integration Status

### ✅ Completed
- PayFast payment intent creation
- PayFast webhook handler
- Payment simulation mode for testing
- Google Maps geocoding
- Google Maps reverse geocoding
- Route calculation
- Map embed URL generation
- Booking directions API
- Fallback to Haversine when API not configured

### 🔄 Next Steps
1. Test PayFast webhook with ngrok/local tunnel
2. Integrate map visualization in mobile app
3. Add real-time location updates on map
4. Add payment success/failure callbacks
5. Add payment history with PayFast transaction IDs

---

## Testing Checklist

### PayFast
- [ ] Create payment intent
- [ ] Redirect to PayFast payment page
- [ ] Complete payment in sandbox
- [ ] Verify webhook receives payment confirmation
- [ ] Verify booking status updates to `pending_acceptance`
- [ ] Verify payment record created with transaction ID

### Google Maps
- [ ] Geocode address to coordinates
- [ ] Reverse geocode coordinates to address
- [ ] Calculate route between two points
- [ ] Get map embed URL for booking
- [ ] Get directions for booking
- [ ] Test fallback when API key not configured

---

## Security Notes

1. **PayFast:**
   - Webhook signature verification is implemented
   - Never expose passphrase in client-side code
   - Use HTTPS in production

2. **Google Maps:**
   - Restrict API key to specific domains/IPs
   - Monitor API usage in Google Cloud Console
   - Set up billing alerts

---

## Support

- PayFast Documentation: https://www.payfast.co.za/documentation/
- Google Maps API Docs: https://developers.google.com/maps/documentation
- PayFast Sandbox: https://www.payfast.co.za/sandbox/
