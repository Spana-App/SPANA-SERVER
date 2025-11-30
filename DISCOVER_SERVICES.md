# Discover Services Endpoint

## Overview

A single GET endpoint that combines **recently booked services** (for marketing/rapport building) and **location-based service suggestions** (for personalized recommendations).

**Endpoint**: `GET /services/discover`

**Authentication**: Optional (public endpoint, but authenticated users get location-based suggestions)

---

## Features

### 1. Recently Booked Services
- Shows the most recently booked services (for marketing/rapport building)
- Helps new customers see what others are booking
- Builds trust and social proof

### 2. Location-Based Suggestions
- **Only for authenticated users with location set**
- Suggests services from providers near the user
- Uses Haversine formula to calculate distance
- Filters by provider's service area radius
- Sorted by distance (closest first)

---

## Request

**Method**: `GET`

**URL**: `/services/discover`

**Headers** (optional):
```
Authorization: Bearer <JWT_TOKEN>  // Optional - for location-based suggestions
```

**Query Parameters** (optional):
- `limit` (number, default: 20) - Number of recently booked services to return
- `suggestionsLimit` (number, default: 10, max: 20) - Number of suggested services to return

**Examples**:
```
GET /services/discover
GET /services/discover?limit=10&suggestionsLimit=5
GET /services/discover?limit=30
```

---

## Response

### Without Authentication (Public)

```json
{
  "recentlyBooked": [
    {
      "bookingId": "booking-123",
      "service": {
        "id": "service-456",
        "title": "Plumbing Repair",
        "description": "Fast and reliable plumbing services",
        "category": "Plumbing",
        "price": 500.00,
        "duration": 60,
        "mediaUrl": "https://..."
      },
      "bookedAt": "2024-11-30T10:00:00Z",
      "status": "confirmed",
      "location": {
        "type": "Point",
        "coordinates": [-26.2041, 28.0473],
        "address": "Johannesburg, South Africa"
      }
    }
  ],
  "suggested": [],
  "meta": {
    "recentlyBookedCount": 20,
    "suggestedCount": 0,
    "hasUserLocation": false
  }
}
```

### With Authentication (Location-Based Suggestions)

```json
{
  "recentlyBooked": [
    {
      "bookingId": "booking-123",
      "service": {
        "id": "service-456",
        "title": "Plumbing Repair",
        "description": "...",
        "category": "Plumbing",
        "price": 500.00,
        "duration": 60,
        "mediaUrl": "https://..."
      },
      "bookedAt": "2024-11-30T10:00:00Z",
      "status": "confirmed",
      "location": {...}
    }
  ],
  "suggested": [
    {
      "id": "service-789",
      "title": "Electrical Installation",
      "description": "...",
      "category": "Electrical",
      "price": 600.00,
      "duration": 90,
      "mediaUrl": "https://...",
      "distance": 5.2,  // Distance in km
      "suggested": true
    }
  ],
  "meta": {
    "recentlyBookedCount": 20,
    "suggestedCount": 10,
    "hasUserLocation": true
  }
}
```

---

## Response Fields

### Recently Booked Services

- `bookingId` (string) - Booking ID
- `service` (object) - Service details (no provider info for customers)
- `bookedAt` (datetime) - When the booking was created
- `status` (string) - Booking status: 'confirmed', 'in_progress', 'completed'
- `location` (object) - Booking location (anonymized for non-admins)
- `customerInfo` (object, admin only) - Customer info for marketing

### Suggested Services

- `id` (string) - Service ID
- `title` (string) - Service title
- `description` (string) - Service description
- `category` (string) - Service category
- `price` (number) - Service price
- `duration` (number) - Duration in minutes
- `mediaUrl` (string) - Service image/video URL
- `distance` (number) - Distance from user in kilometers
- `suggested` (boolean) - Always `true` for suggested services
- `provider` (object, non-customers only) - Provider details

### Meta

- `recentlyBookedCount` (number) - Number of recently booked services returned
- `suggestedCount` (number) - Number of suggested services returned
- `hasUserLocation` (boolean) - Whether user has location set (affects suggestions)

---

## Business Logic

### Recently Booked Services
- Only shows bookings with status: `'confirmed'`, `'in_progress'`, `'completed'`
- Only shows services that are `adminApproved: true` and `status: 'active'`
- Sorted by `createdAt` descending (most recent first)
- Default limit: 20 (configurable via query param)

### Location-Based Suggestions
- **Only works if user is authenticated AND has location set**
- Calculates distance using Haversine formula
- Only suggests services from providers with:
  - `serviceAreaCenter` set (provider's base location)
  - Distance within provider's `serviceAreaRadius` (default: 25km)
- Services must be `adminApproved: true` and `status: 'active'`
- Services must have a provider assigned (`providerId` not null)
- Sorted by distance (closest first)
- Default limit: 10 suggestions (configurable, max 20)

### Privacy
- **Customers**: Don't see provider info in suggestions (Uber-style)
- **Non-customers**: See provider rating and basic info
- **Admins**: See customer info in recently booked services

---

## Use Cases

### 1. Marketing/Homepage
```javascript
// Show recently booked services to build trust
GET /services/discover?limit=10
// Returns: recentlyBooked (10 items), suggested: []
```

### 2. Personalized Recommendations
```javascript
// Authenticated user with location
GET /services/discover
Authorization: Bearer <USER_TOKEN>
// Returns: recentlyBooked (20 items) + suggested (10 items near user)
```

### 3. Landing Page
```javascript
// Public endpoint - no auth needed
GET /services/discover?limit=5
// Returns: recentlyBooked (5 items), suggested: []
```

---

## Performance

- **Single Query**: All data fetched in one request
- **Efficient**: Uses Prisma's `include` to fetch related data in one go
- **Cached**: Can be cached for 5 minutes (services don't change frequently)
- **Optimized**: Location calculations done in-memory (fast for reasonable dataset sizes)

---

## Error Handling

- **500 Error**: Server error (database connection, etc.)
- **No errors for missing location**: If user has no location, suggestions array is empty
- **No errors for invalid token**: Invalid tokens are ignored (optional auth)

---

## Example Usage

### Frontend (React/Next.js)

```typescript
// Fetch discover services
const fetchDiscoverServices = async (token?: string) => {
  const headers: any = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const response = await fetch('/services/discover?limit=20&suggestionsLimit=10', {
    headers
  });
  
  const data = await response.json();
  
  return {
    recentlyBooked: data.recentlyBooked,  // For marketing section
    suggested: data.suggested,              // For personalized recommendations
    hasSuggestions: data.meta.hasUserLocation
  };
};
```

### Mobile App

```javascript
// Show recently booked services on home screen
const discoverServices = await api.get('/services/discover', {
  headers: token ? { Authorization: `Bearer ${token}` } : {}
});

// Display recentlyBooked in "Trending Services" section
// Display suggested in "Services Near You" section (if hasUserLocation)
```

---

## Notes

1. **Route Order**: `/discover` route must come before `/:id` route to avoid matching "discover" as an ID

2. **Distance Calculation**: Uses Haversine formula for accurate distance calculation

3. **Service Area**: Providers can set their `serviceAreaRadius` (default: 25km)

4. **Performance**: For large datasets, consider adding database indexes on:
   - `Booking.createdAt`
   - `ServiceProvider.serviceAreaCenter` (if using PostGIS)

5. **Caching**: Consider caching this endpoint for 5-10 minutes since:
   - Recently booked services don't change frequently
   - Location-based suggestions are relatively stable

---

## Future Enhancements

- Add category-based filtering for suggestions
- Add popularity score (based on booking count)
- Add time-based suggestions (services popular at current time)
- Add machine learning recommendations
- Add PostGIS for more efficient location queries

