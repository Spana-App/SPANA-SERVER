/**
 * Provider Matching Logic
 * Automatically finds available providers based on:
 * - Online status
 * - Not busy (no active bookings)
 * - Skills match
 * - Location proximity
 * - Location-based pricing
 */

import prisma from './database';

// Calculate distance using Haversine formula (in meters)
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in meters
}

// Calculate distance in kilometers
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return calculateDistance(lat1, lon1, lat2, lon2) / 1000;
}

// Location-based pricing multipliers
// Premium areas (like Sandton) have higher prices
// Lower-income areas (like Soweto) have lower prices
const LOCATION_MULTIPLIERS: { [key: string]: number } = {
  // Premium areas (multiplier > 1.0)
  'sandton': 1.3,
  'rosebank': 1.25,
  'melrose': 1.2,
  'bryanston': 1.2,
  'waterkloof': 1.3,
  'constantia': 1.3,
  
  // Standard areas (multiplier = 1.0)
  'johannesburg': 1.0,
  'pretoria': 1.0,
  'cape town': 1.0,
  
  // Lower-income areas (multiplier < 1.0)
  'soweto': 0.85,
  'alexandra': 0.85,
  'khayelitsha': 0.85,
  'mitchells plain': 0.85,
};

// Get location multiplier based on address or coordinates
export function getLocationMultiplier(address?: string, coordinates?: number[]): number {
  if (!address && !coordinates) return 1.0;
  
  const addressLower = (address || '').toLowerCase();
  
  // Check for known areas in address
  for (const [area, multiplier] of Object.entries(LOCATION_MULTIPLIERS)) {
    if (addressLower.includes(area)) {
      return multiplier;
    }
  }
  
  // If coordinates provided, could use geocoding API to determine area
  // For now, default to 1.0 if no match
  return 1.0;
}

// Check if provider is busy (has active bookings)
export async function isProviderBusy(providerId: string): Promise<boolean> {
  const activeBookings = await prisma.booking.findMany({
    where: {
      service: {
        providerId: providerId
      },
      status: {
        in: ['confirmed', 'in_progress', 'pending_payment']
      }
    },
    take: 1
  });
  
  return activeBookings.length > 0;
}

// Find available providers for a service request
export interface ProviderMatch {
  provider: any;
  service: any;
  distance: number; // in km
  locationMultiplier: number;
  adjustedPrice: number;
  matchScore: number; // Higher is better
}

export async function findAvailableProviders(
  serviceTitle: string,
  requiredSkills: string[],
  customerLocation: { type: string; coordinates: number[]; address?: string },
  basePrice: number,
  maxDistanceKm: number = 50
): Promise<ProviderMatch[]> {
  const [customerLng, customerLat] = customerLocation.coordinates;
  
  // Get all services matching the title/category
  const services = await prisma.service.findMany({
    where: {
      OR: [
        { title: { contains: serviceTitle, mode: 'insensitive' } },
        { description: { contains: serviceTitle, mode: 'insensitive' } }
      ],
      adminApproved: true,
      status: 'active'
    },
    include: {
      provider: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              location: true,
              isEmailVerified: true,
              isPhoneVerified: true
            }
          }
        }
      }
    }
  });

  const matches: ProviderMatch[] = [];

  for (const service of services) {
    const provider = service.provider;
    
    // Filter 1: Provider must be online
    if (!provider || !provider.isOnline) {
      continue;
    }

    // Filter 2: Provider must not be busy
    const busy = await isProviderBusy(provider.id);
    if (busy) {
      continue;
    }

    // Filter 3: Provider must have required skills
    if (requiredSkills && requiredSkills.length > 0) {
      const providerSkills = (provider.skills || []).map((s: string) => s.toLowerCase());
      const hasRequiredSkills = requiredSkills.some(skill => 
        providerSkills.includes(skill.toLowerCase())
      );
      if (!hasRequiredSkills) {
        continue;
      }
    }

    // Filter 4: Provider must be verified and profile complete
    if (!provider.isVerified || !provider.isIdentityVerified || !provider.isProfileComplete) {
      continue;
    }

    // Filter 5: Provider must have active application status
    if (provider.applicationStatus !== 'active') {
      continue;
    }

    // Filter 6: Check location proximity
    const providerCenter = provider.serviceAreaCenter as any;
    if (!providerCenter || !providerCenter.coordinates) {
      continue;
    }

    const [providerLng, providerLat] = providerCenter.coordinates;
    const distanceKm = calculateDistanceKm(providerLat, providerLng, customerLat, customerLng);
    
    // Check if within service area radius
    const serviceRadius = provider.serviceAreaRadius || 25; // Default 25km
    if (distanceKm > serviceRadius || distanceKm > maxDistanceKm) {
      continue;
    }

    // Calculate location-based pricing
    const locationMultiplier = getLocationMultiplier(
      customerLocation.address,
      customerLocation.coordinates
    );
    const adjustedPrice = basePrice * locationMultiplier;

    // Calculate match score (higher is better)
    // Factors: rating, distance, experience
    const ratingScore = provider.rating || 0;
    const distanceScore = Math.max(0, 100 - (distanceKm * 2)); // Closer = higher score
    const experienceScore = Math.min(provider.experienceYears || 0, 10) * 2; // Max 20 points
    const matchScore = ratingScore * 20 + distanceScore + experienceScore;

    matches.push({
      provider,
      service,
      distance: distanceKm,
      locationMultiplier,
      adjustedPrice,
      matchScore
    });
  }

  // Sort by match score (best first)
  matches.sort((a, b) => b.matchScore - a.matchScore);

  return matches;
}

// Get the best available provider
export async function getBestAvailableProvider(
  serviceTitle: string,
  requiredSkills: string[],
  customerLocation: { type: string; coordinates: number[]; address?: string },
  basePrice: number,
  maxDistanceKm: number = 50
): Promise<ProviderMatch | null> {
  const matches = await findAvailableProviders(
    serviceTitle,
    requiredSkills,
    customerLocation,
    basePrice,
    maxDistanceKm
  );

  return matches.length > 0 ? matches[0] : null;
}
