"use strict";
// Mobile storage utilities for real-time location tracking
// This handles local storage for mobile apps (SQLite/AsyncStorage)
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncStorageAdapter = void 0;
class MobileStorage {
    constructor() {
        this.locations = [];
        this.cachedBookings = new Map();
    }
    // Location tracking methods
    addLocation(bookingId, coordinates, role) {
        const location = {
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
    getLocations(bookingId, role) {
        return this.locations
            .filter(loc => loc.bookingId === bookingId && (!role || loc.role === role))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    getLatestLocation(bookingId, role) {
        const locations = this.getLocations(bookingId, role);
        return locations.length > 0 ? locations[0] : null;
    }
    clearLocations(bookingId) {
        this.locations = this.locations.filter(loc => loc.bookingId !== bookingId);
    }
    // Booking cache methods
    cacheBooking(booking) {
        this.cachedBookings.set(booking.id, booking);
    }
    getCachedBooking(bookingId) {
        return this.cachedBookings.get(bookingId) || null;
    }
    updateBookingStatus(bookingId, status) {
        const booking = this.cachedBookings.get(bookingId);
        if (booking) {
            booking.status = status;
            booking.lastSync = new Date();
        }
    }
    clearBookingCache(bookingId) {
        this.cachedBookings.delete(bookingId);
    }
    // Sync methods for batch operations
    getPendingLocations() {
        // Return locations that haven't been synced to server
        // In a real implementation, you'd track sync status
        return this.locations;
    }
    markLocationsAsSynced(bookingId) {
        // Remove synced locations
        this.locations = this.locations.filter(loc => loc.bookingId !== bookingId);
    }
    // Export data for backup/transfer
    exportData() {
        return {
            locations: [...this.locations],
            bookings: Array.from(this.cachedBookings.values())
        };
    }
    // Import data from backup
    importData(data) {
        this.locations = data.locations;
        this.cachedBookings = new Map(data.bookings.map(b => [b.id, b]));
    }
}
// Singleton instance
const mobileStorage = new MobileStorage();
exports.default = mobileStorage;
// For React Native AsyncStorage integration
exports.AsyncStorageAdapter = {
    async saveLocation(bookingId, coordinates, role) {
        try {
            // In React Native, you would use AsyncStorage here
            // const data = await AsyncStorage.getItem('locations');
            // const locations = data ? JSON.parse(data) : [];
            // locations.push({ bookingId, coordinates, timestamp: new Date(), role });
            // await AsyncStorage.setItem('locations', JSON.stringify(locations));
            // For now, use in-memory storage
            mobileStorage.addLocation(bookingId, coordinates, role);
        }
        catch (error) {
            console.error('Failed to save location:', error);
        }
    },
    async getLocations(bookingId, role) {
        try {
            // In React Native, you would use AsyncStorage here
            // const data = await AsyncStorage.getItem('locations');
            // const locations = data ? JSON.parse(data) : [];
            // return locations.filter(loc => loc.bookingId === bookingId && (!role || loc.role === role));
            // For now, use in-memory storage
            return mobileStorage.getLocations(bookingId, role);
        }
        catch (error) {
            console.error('Failed to get locations:', error);
            return [];
        }
    }
};
