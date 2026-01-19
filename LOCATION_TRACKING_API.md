# Location Tracking API

## Overview
Location endpoints accept coordinates as **query parameters** (for easy testing) or in the **request body** (for production use with real GPS coordinates).

## Endpoints

### 1. Update Provider Location
**Endpoint:** `PUT /provider/location`

**Query Parameters (for testing):**
```
PUT /provider/location?lng=28.0473&lat=-26.2041&address=Sandton
```

**Request Body (for production):**
```json
{
  "lng": 28.0473,
  "lat": -26.2041,
  "address": "Sandton, Johannesburg"
}
```

**Or using coordinates array:**
```json
{
  "coordinates": [28.0473, -26.2041],
  "address": "Sandton, Johannesburg"
}
```

**Response:**
```json
{
  "message": "Location updated successfully",
  "location": {
    "type": "Point",
    "coordinates": [28.0473, -26.2041],
    "address": "Sandton, Johannesburg"
  }
}
```

---

### 2. Update Customer Location
**Endpoint:** `PUT /provider/customer/location`

**Query Parameters (for testing):**
```
PUT /provider/customer/location?lng=28.0473&lat=-26.2041&address=Soweto
```

**Request Body (for production):**
```json
{
  "lng": 28.0473,
  "lat": -26.2041,
  "address": "Soweto, Johannesburg"
}
```

**Or using coordinates array:**
```json
{
  "coordinates": [28.0473, -26.2041],
  "address": "Soweto, Johannesburg"
}
```

**Response:**
```json
{
  "message": "Location updated successfully",
  "location": {
    "type": "Point",
    "coordinates": [28.0473, -26.2041],
    "address": "Soweto, Johannesburg"
  }
}
```

---

### 3. Set Provider Online Status
**Endpoint:** `PUT /provider/online-status`

**Request Body:**
```json
{
  "isOnline": true
}
```

**Response:**
```json
{
  "message": "Provider is now online",
  "isOnline": true
}
```

---

### 4. Get Provider Online Status
**Endpoint:** `GET /provider/online-status`

**Response:**
```json
{
  "isOnline": true,
  "providerId": "cmkl..."
}
```

---

### 5. Get All Online Providers (Admin Only)
**Endpoint:** `GET /provider/online`

**Response:**
```json
{
  "count": 5,
  "providers": [
    {
      "id": "cmkl...",
      "isOnline": true,
      "user": {
        "id": "cmkl...",
        "firstName": "John",
        "lastName": "Provider",
        "location": {
          "type": "Point",
          "coordinates": [28.0473, -26.2041]
        }
      },
      "services": [...]
    }
  ]
}
```

---

## Testing vs Production

### Testing (Fake Coordinates)
Use query parameters for easy testing:
```bash
# Test customer location
curl -X PUT "http://localhost:5003/provider/customer/location?lng=28.0473&lat=-26.2041&address=Test+Location" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test provider location
curl -X PUT "http://localhost:5003/provider/location?lng=28.0500&lat=-26.2100&address=Test+Provider" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Production (Real GPS Coordinates)
Use request body with real GPS coordinates from device:
```javascript
// Mobile app example
const updateLocation = async (lng, lat, address) => {
  const response = await fetch('/provider/location', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      lng: lng,  // Real GPS longitude from device
      lat: lat,  // Real GPS latitude from device
      address: address  // Geocoded address
    })
  });
};
```

---

## Coordinate Validation

- **Longitude (lng):** Must be between -180 and 180
- **Latitude (lat):** Must be between -90 and 90
- Both must be valid numbers

**Invalid coordinates will return:**
```json
{
  "message": "Invalid coordinates. Longitude must be -180 to 180, latitude must be -90 to 90"
}
```

---

## Location-Based Pricing

When creating a booking, the system automatically:
1. Detects customer location from address or coordinates
2. Applies location multiplier:
   - **Sandton:** 1.3x (premium)
   - **Rosebank:** 1.25x
   - **Standard areas:** 1.0x
   - **Soweto/Alexandra:** 0.85x (lower-income)

3. Calculates adjusted price: `basePrice * locationMultiplier`

---

## Example: Complete Flow

```javascript
// 1. Customer updates location (real GPS from device)
PUT /provider/customer/location
{
  "lng": 28.0473,  // Real GPS
  "lat": -26.2041, // Real GPS
  "address": "Sandton, Johannesburg"
}

// 2. Provider goes online
PUT /provider/online-status
{ "isOnline": true }

// 3. Provider updates location (real GPS from device)
PUT /provider/location
{
  "lng": 28.0500,  // Real GPS
  "lat": -26.2100, // Real GPS
  "address": "Sandton, Johannesburg"
}

// 4. Customer creates booking (automatic provider matching)
POST /bookings
{
  "serviceTitle": "Plumbing",
  "requiredSkills": ["plumbing"],
  "location": {
    "type": "Point",
    "coordinates": [28.0473, -26.2041],  // Real GPS
    "address": "Sandton, Johannesburg"
  }
}
// System automatically finds online provider, matches skills, calculates location-based price
```

---

## Notes

- **Server restart required** after adding new routes
- Coordinates can be provided as:
  - Query params: `?lng=28.0473&lat=-26.2041`
  - Body params: `{ "lng": 28.0473, "lat": -26.2041 }`
  - Coordinates array: `{ "coordinates": [28.0473, -26.2041] }`
- Use **fake coordinates for testing**, **real GPS coordinates in production**
- Location is required for both customers and providers before booking creation
