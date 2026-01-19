/**
 * Map Controller
 * Handles Google Maps integration for location visualization and geocoding
 */

import prisma from '../lib/database';
import axios from 'axios';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Geocode address to coordinates
exports.geocodeAddress = async (req: any, res: any) => {
  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({ message: 'Address is required' });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({ 
        message: 'Google Maps API is not configured',
        error: 'GOOGLE_MAPS_NOT_CONFIGURED',
        instructions: 'To enable Google Maps features, add GOOGLE_MAPS_API_KEY to your .env file',
        fallback: 'Please provide coordinates directly or configure GOOGLE_MAPS_API_KEY'
      });
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address,
        key: GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];
      const location = result.geometry.location;

      res.json({
        address: result.formatted_address,
        coordinates: {
          lng: location.lng,
          lat: location.lat
        },
        placeId: result.place_id,
        types: result.types
      });
    } else {
      res.status(404).json({ 
        message: 'Address not found',
        status: response.data.status 
      });
    }
  } catch (error: any) {
    console.error('Geocode error:', error);
    res.status(500).json({ message: 'Geocoding failed' });
  }
};

// Reverse geocode coordinates to address
exports.reverseGeocode = async (req: any, res: any) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({ 
        message: 'Google Maps API is not configured',
        error: 'GOOGLE_MAPS_NOT_CONFIGURED',
        instructions: 'To enable Google Maps features, add GOOGLE_MAPS_API_KEY to your .env file',
        fallback: 'Please provide address directly or configure GOOGLE_MAPS_API_KEY'
      });
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        latlng: `${lat},${lng}`,
        key: GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];

      res.json({
        address: result.formatted_address,
        coordinates: {
          lng: parseFloat(lng),
          lat: parseFloat(lat)
        },
        placeId: result.place_id,
        components: result.address_components
      });
    } else {
      res.status(404).json({ 
        message: 'Location not found',
        status: response.data.status 
      });
    }
  } catch (error: any) {
    console.error('Reverse geocode error:', error);
    res.status(500).json({ message: 'Reverse geocoding failed' });
  }
};

// Calculate distance and duration between two points
exports.calculateRoute = async (req: any, res: any) => {
  try {
    const { origin, destination, mode = 'driving' } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ message: 'Origin and destination are required' });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({ 
        message: 'Google Maps API is not configured',
        error: 'GOOGLE_MAPS_NOT_CONFIGURED',
        instructions: 'To enable Google Maps features, add GOOGLE_MAPS_API_KEY to your .env file',
        fallback: 'Using Haversine distance calculation (basic distance only, no route)'
      });
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin,
        destination,
        mode, // driving, walking, bicycling, transit
        key: GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status === 'OK' && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const leg = route.legs[0];

      res.json({
        distance: {
          text: leg.distance.text,
          value: leg.distance.value // meters
        },
        duration: {
          text: leg.duration.text,
          value: leg.duration.value // seconds
        },
        startAddress: leg.start_address,
        endAddress: leg.end_address,
        polyline: route.overview_polyline.points, // For map visualization
        steps: leg.steps.map((step: any) => ({
          instruction: step.html_instructions,
          distance: step.distance.text,
          duration: step.duration.text
        }))
      });
    } else {
      res.status(404).json({ 
        message: 'Route not found',
        status: response.data.status 
      });
    }
  } catch (error: any) {
    console.error('Route calculation error:', error);
    res.status(500).json({ message: 'Route calculation failed' });
  }
};

// Get map embed URL for booking locations
exports.getMapEmbedUrl = async (req: any, res: any) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: {
          include: {
            provider: {
              include: { user: true }
            }
          }
        },
        customer: {
          include: { user: true }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const bookingLocation = booking.location as any;
    const providerLocation = booking.providerLiveLocation || booking.service.provider?.user?.location;
    const customerLocation = booking.customerLiveLocation || booking.customer.user.location;

    if (!bookingLocation || !bookingLocation.coordinates) {
      return res.status(400).json({ message: 'Booking location not set' });
    }

    // Build Google Maps embed URL
    const bookingCoords = `${bookingLocation.coordinates[1]},${bookingLocation.coordinates[0]}`;
    let mapUrl = `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${bookingCoords}`;

    // Add markers if locations available
    const markers: string[] = [];
    if (bookingLocation.coordinates) {
      markers.push(`color:red|label:B|${bookingLocation.coordinates[1]},${bookingLocation.coordinates[0]}`);
    }
    if (providerLocation && (providerLocation as any).coordinates) {
      const coords = (providerLocation as any).coordinates;
      markers.push(`color:blue|label:P|${coords[1]},${coords[0]}`);
    }
    if (customerLocation && (customerLocation as any).coordinates) {
      const coords = (customerLocation as any).coordinates;
      markers.push(`color:green|label:C|${coords[1]},${coords[0]}`);
    }

    if (markers.length > 0 && GOOGLE_MAPS_API_KEY) {
      mapUrl = `https://www.google.com/maps/embed/v1/view?key=${GOOGLE_MAPS_API_KEY}&center=${bookingCoords}&zoom=15&markers=${markers.join('&markers=')}`;
    }

    res.json({
      embedUrl: mapUrl,
      bookingLocation: {
        coordinates: bookingLocation.coordinates,
        address: bookingLocation.address
      },
      providerLocation: providerLocation ? {
        coordinates: (providerLocation as any).coordinates,
        address: (providerLocation as any).address
      } : null,
      customerLocation: customerLocation ? {
        coordinates: (customerLocation as any).coordinates,
        address: (customerLocation as any).address
      } : null,
      distanceApart: booking.distanceApart
    });
  } catch (error: any) {
    console.error('Map embed URL error:', error);
    res.status(500).json({ message: 'Failed to generate map URL' });
  }
};

// Get directions between provider and customer for a booking
exports.getBookingDirections = async (req: any, res: any) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: {
          include: {
            provider: {
              include: { user: true }
            }
          }
        },
        customer: {
          include: { user: true }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const bookingLocation = booking.location as any;
    const providerLocation = booking.providerLiveLocation || booking.service.provider?.user?.location;

    if (!bookingLocation || !bookingLocation.coordinates) {
      return res.status(400).json({ message: 'Booking location not set' });
    }

    if (!providerLocation || !(providerLocation as any).coordinates) {
      return res.status(400).json({ message: 'Provider location not available' });
    }

    const origin = `${(providerLocation as any).coordinates[1]},${(providerLocation as any).coordinates[0]}`;
    const destination = `${bookingLocation.coordinates[1]},${bookingLocation.coordinates[0]}`;

    if (!GOOGLE_MAPS_API_KEY) {
      // Fallback to Haversine calculation
      const { calculateDistance } = require('./bookingController');
      const distance = calculateDistance(
        bookingLocation.coordinates[1],
        bookingLocation.coordinates[0],
        (providerLocation as any).coordinates[1],
        (providerLocation as any).coordinates[0]
      );

      return res.json({
        distance: {
          text: `${(distance / 1000).toFixed(2)} km`,
          value: distance
        },
        duration: {
          text: 'N/A (API not configured)',
          value: null
        },
        directionsUrl: `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`,
        fallback: true
      });
    }

    // Use Google Directions API
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin,
        destination,
        mode: 'driving',
        key: GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status === 'OK' && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const leg = route.legs[0];

      res.json({
        distance: {
          text: leg.distance.text,
          value: leg.distance.value
        },
        duration: {
          text: leg.duration.text,
          value: leg.duration.value
        },
        directionsUrl: `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`,
        polyline: route.overview_polyline.points,
        steps: leg.steps.map((step: any) => ({
          instruction: step.html_instructions,
          distance: step.distance.text,
          duration: step.duration.text
        }))
      });
    } else {
      res.status(404).json({ 
        message: 'Route not found',
        status: response.data.status 
      });
    }
  } catch (error: any) {
    console.error('Directions error:', error);
    res.status(500).json({ message: 'Failed to get directions' });
  }
};
