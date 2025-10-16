// Mobile storage utilities for real-time location tracking
// This handles local storage for mobile apps (SQLite/AsyncStorage)

export interface LocationData {
  bookingId: string;
  coordinates: [number, number]; // [lng, lat]
  timestamp: Date;
  role: 'customer' | 'provider';
}

export interface CachedBooking {
  id: string;
  status: string;
  lastSync: Date;
  localData: any;
}

class MobileStorage {
  private locations: LocationData[] = [];
  private cachedBookings: Map<string, CachedBooking> = new Map();

  // Location tracking methods
  addLocation(bookingId: string, coordinates: [number, number], role: 'customer' | 'provider'): void {
    const location: LocationData = {
      bookingId,
      coordinates,
      timestamp: new Date(),
      role
    };
    
    this.locations.push(location);
    
    // Keep only last 100 locations per booking to prevent memory issues
    this.locations = this.locations
      .filter(loc => loc.bookingId !== bookingId || 
        this.locations.filter(l => l.bookingId === bookingId).length <= 100)
      .concat(location);
  }

  getLocations(bookingId: string, role?: 'customer' | 'provider'): LocationData[] {
    return this.locations
      .filter(loc => loc.bookingId === bookingId && (!role || loc.role === role))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getLatestLocation(bookingId: string, role: 'customer' | 'provider'): LocationData | null {
    const locations = this.getLocations(bookingId, role);
    return locations.length > 0 ? locations[0] : null;
  }

  clearLocations(bookingId: string): void {
    this.locations = this.locations.filter(loc => loc.bookingId !== bookingId);
  }

  // Booking cache methods
  cacheBooking(booking: CachedBooking): void {
    this.cachedBookings.set(booking.id, booking);
  }

  getCachedBooking(bookingId: string): CachedBooking | null {
    return this.cachedBookings.get(bookingId) || null;
  }

  updateBookingStatus(bookingId: string, status: string): void {
    const booking = this.cachedBookings.get(bookingId);
    if (booking) {
      booking.status = status;
      booking.lastSync = new Date();
    }
  }

  clearBookingCache(bookingId: string): void {
    this.cachedBookings.delete(bookingId);
  }

  // Sync methods for batch operations
  getPendingLocations(): LocationData[] {
    // Return locations that haven't been synced to server
    // In a real implementation, you'd track sync status
    return this.locations;
  }

  markLocationsAsSynced(bookingId: string): void {
    // Remove synced locations
    this.locations = this.locations.filter(loc => loc.bookingId !== bookingId);
  }

  // Export data for backup/transfer
  exportData(): { locations: LocationData[], bookings: CachedBooking[] } {
    return {
      locations: [...this.locations],
      bookings: Array.from(this.cachedBookings.values())
    };
  }

  // Import data from backup
  importData(data: { locations: LocationData[], bookings: CachedBooking[] }): void {
    this.locations = data.locations;
    this.cachedBookings = new Map(data.bookings.map(b => [b.id, b]));
  }
}

// Singleton instance
const mobileStorage = new MobileStorage();

export default mobileStorage;

// For React Native AsyncStorage integration
export const AsyncStorageAdapter = {
  async saveLocation(bookingId: string, coordinates: [number, number], role: 'customer' | 'provider'): Promise<void> {
    try {
      // In React Native, you would use AsyncStorage here
      // const data = await AsyncStorage.getItem('locations');
      // const locations = data ? JSON.parse(data) : [];
      // locations.push({ bookingId, coordinates, timestamp: new Date(), role });
      // await AsyncStorage.setItem('locations', JSON.stringify(locations));
      
      // For now, use in-memory storage
      mobileStorage.addLocation(bookingId, coordinates, role);
    } catch (error) {
      console.error('Failed to save location:', error);
    }
  },

  async getLocations(bookingId: string, role?: 'customer' | 'provider'): Promise<LocationData[]> {
    try {
      // In React Native, you would use AsyncStorage here
      // const data = await AsyncStorage.getItem('locations');
      // const locations = data ? JSON.parse(data) : [];
      // return locations.filter(loc => loc.bookingId === bookingId && (!role || loc.role === role));
      
      // For now, use in-memory storage
      return mobileStorage.getLocations(bookingId, role);
    } catch (error) {
      console.error('Failed to get locations:', error);
      return [];
    }
  }
};
