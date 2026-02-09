/**
 * Location Utility Functions
 * Provides dynamic location handling, validation, and comparison
 */

/**
 * Normalizes coordinates to ensure consistent format
 * Handles [lng, lat] or [lat, lng] formats and normalizes to [lng, lat]
 * Standard GeoJSON format is [longitude, latitude]
 */
export function normalizeCoordinates(coords: number[]): [number, number] {
  if (!coords || coords.length < 2) {
    throw new Error('Invalid coordinates: must have at least 2 values');
  }

  const [first, second] = coords;
  
  // Validate coordinate ranges
  // Longitude: -180 to 180, Latitude: -90 to 90
  // If first value is in latitude range (-90 to 90) and second is in longitude range (-180 to 180)
  // AND first is NOT in longitude range, then it's likely [lat, lng] format
  const firstIsLat = Math.abs(first) <= 90 && Math.abs(first) > Math.abs(second);
  const secondIsLng = Math.abs(second) <= 180;
  
  // If first is clearly latitude and second is clearly longitude, swap them
  if (firstIsLat && secondIsLng && Math.abs(first) <= 90 && Math.abs(second) > 90) {
    // Likely [lat, lng], swap to [lng, lat]
    return [second, first];
  }
  
  // Assume [lng, lat] format (standard GeoJSON) - most common case
  // Frontend sends [longitude, latitude] which is correct
  return [first, second];
}

/**
 * Validates location object structure
 */
export function validateLocation(location: any): { valid: boolean; error?: string; normalized?: any } {
  if (!location) {
    return { valid: false, error: 'Location is required' };
  }

  if (!location.coordinates || !Array.isArray(location.coordinates)) {
    return { valid: false, error: 'Location must have coordinates array' };
  }

  if (location.coordinates.length < 2) {
    return { valid: false, error: 'Location coordinates must have at least 2 values [longitude, latitude]' };
  }

  try {
    const [lng, lat] = normalizeCoordinates(location.coordinates);
    
    // Validate coordinate ranges
    if (lng < -180 || lng > 180) {
      return { valid: false, error: 'Longitude must be between -180 and 180' };
    }
    
    if (lat < -90 || lat > 90) {
      return { valid: false, error: 'Latitude must be between -90 and 90' };
    }

    // Check for invalid coordinates (0,0 is often a default/error value)
    if (lng === 0 && lat === 0) {
      return { valid: false, error: 'Invalid coordinates detected. Please ensure location services are enabled and working correctly.' };
    }

    const normalized = {
      type: location.type || 'Point',
      coordinates: [lng, lat],
      address: location.address || null
    };

    return { valid: true, normalized };
  } catch (error: any) {
    return { valid: false, error: error.message || 'Invalid location format' };
  }
}

/**
 * Compares two locations with tolerance for floating-point precision
 * Returns true if locations are effectively the same (within ~10 meters)
 */
export function locationsAreEqual(loc1: any, loc2: any, toleranceMeters: number = 10): boolean {
  if (!loc1 || !loc2) return false;
  
  try {
    const [lng1, lat1] = normalizeCoordinates(loc1.coordinates || []);
    const [lng2, lat2] = normalizeCoordinates(loc2.coordinates || []);
    
    // Calculate distance between coordinates
    const distance = calculateDistanceMeters(lat1, lng1, lat2, lng2);
    
    // Locations are equal if within tolerance
    return distance <= toleranceMeters;
  } catch {
    return false;
  }
}

/**
 * Calculates distance between two coordinates in meters (Haversine formula)
 */
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Extracts coordinates from location object (handles various formats)
 */
export function extractCoordinates(location: any): [number, number] | null {
  if (!location) return null;
  
  if (location.coordinates && Array.isArray(location.coordinates)) {
    try {
      return normalizeCoordinates(location.coordinates);
    } catch {
      return null;
    }
  }
  
  return null;
}

/**
 * Creates a location object from coordinates
 */
export function createLocationObject(lng: number, lat: number, address?: string): any {
  return {
    type: 'Point',
    coordinates: [lng, lat],
    address: address || null
  };
}

/**
 * Gets location from request body or falls back to profile location
 * Always prioritizes device location from request
 */
export function getLocationFromRequest(requestLocation: any, profileLocation: any): any {
  // Always use device location from request if provided and valid
  if (requestLocation) {
    const validation = validateLocation(requestLocation);
    if (validation.valid && validation.normalized) {
      return validation.normalized;
    }
  }
  
  // Fallback to profile location if request location is invalid
  if (profileLocation) {
    const validation = validateLocation(profileLocation);
    if (validation.valid && validation.normalized) {
      return validation.normalized;
    }
  }
  
  return null;
}
