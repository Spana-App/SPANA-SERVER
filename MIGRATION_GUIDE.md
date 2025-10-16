# PostgreSQL Migration Guide

This guide explains the migration from MongoDB to PostgreSQL as the primary database, with MongoDB serving as a synchronized backup.

## Overview

The Spana Backend has been migrated to use:
- **PostgreSQL** as the primary database (with PostGIS for geospatial data)
- **MongoDB** as a synchronized backup/read-only database
- **Local Storage** (SQLite/AsyncStorage) for mobile real-time location tracking
- **Prisma ORM** for database operations

## Key Changes

### 1. Database Architecture
- **Primary**: PostgreSQL with relational tables and foreign key constraints
- **Backup**: MongoDB automatically synced from PostgreSQL changes
- **Mobile**: Local storage for real-time location tracking (offline-capable)

### 2. Data Models
All models have been converted from Mongoose schemas to Prisma models:
- `User` - Central user management with role-based fields
- `Service` - Service offerings by providers
- `Booking` - Service bookings with SLA tracking
- `Payment` - Payment processing and history
- `Document` - Provider document uploads
- `Notification` - User notifications
- `Activity` - User activity logging
- `ServiceWorkflow` - Service workflow definitions
- `Message` - Real-time messaging
- `Recommendation` - Service recommendations
- `Session` - User sessions

### 3. Geospatial Data
- Uses PostgreSQL's PostGIS extension for efficient geospatial queries
- Location data stored as JSON with proper indexing
- Mobile location tracking uses local storage for performance

## Setup Instructions

### 1. Install PostgreSQL
```bash
# Windows (using Chocolatey)
choco install postgresql

# Or download from https://www.postgresql.org/download/
```

### 2. Create Database
```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE spana_db;

-- Enable PostGIS extension
\c spana_db
CREATE EXTENSION postgis;
```

### 3. Install pgAdmin (Optional)
Download from https://www.pgadmin.org/download/ for database management.

### 4. Environment Variables
Create a `.env` file with:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/spana_db"
MONGODB_URI="mongodb://localhost:27017/spana_backup"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="7d"

# Server
PORT=5003
NODE_ENV="development"
CLIENT_URL="http://localhost:3000"

# Redis (optional)
USE_REDIS=false
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""

# SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="your-email@gmail.com"

# Stripe
STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key"
STRIPE_PUBLISHABLE_KEY="pk_test_your_stripe_publishable_key"
```

### 5. Database Migration
```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Or create migration
npm run db:migrate

# Setup database (optional)
npm run migrate:setup

# Sync existing data to MongoDB backup
npm run migrate:sync
```

## Mobile App Integration

### Location Tracking
The system now supports mobile-specific location tracking:

```typescript
import mobileStorage from './lib/mobileStorage';

// Add location update
mobileStorage.addLocation(bookingId, [lng, lat], 'customer');

// Get latest location
const location = mobileStorage.getLatestLocation(bookingId, 'customer');

// For React Native AsyncStorage
import { AsyncStorageAdapter } from './lib/mobileStorage';
await AsyncStorageAdapter.saveLocation(bookingId, [lng, lat], 'customer');
```

### Offline Capabilities
- Local storage for location tracking
- Cached booking data
- Sync when online

## API Changes

### Authentication
All authentication endpoints remain the same:
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user

### Database Operations
Controllers now use Prisma instead of Mongoose:
```typescript
// Old (Mongoose)
const user = await User.findById(id);

// New (Prisma)
const user = await prisma.user.findUnique({ where: { id } });
```

### Real-time Features
Socket.io integration remains the same for:
- Live location tracking
- Chat messaging
- Booking updates

## MongoDB Backup

MongoDB automatically syncs with PostgreSQL:
- Real-time sync on data changes
- Read-only access for analytics
- Backup and recovery purposes

## Testing

```bash
# Run tests
npm test

# Test database connection
curl http://localhost:5003/health

# Test detailed health
curl http://localhost:5003/health/detailed
```

## Performance Considerations

### PostgreSQL
- Use indexes for frequently queried fields
- PostGIS for geospatial queries
- Connection pooling for high concurrency

### Mobile Storage
- Limit location history (last 100 points per booking)
- Batch sync operations
- Use AsyncStorage for simple key-value data

### Caching
- Redis for service listings (5-minute TTL)
- In-memory fallback when Redis disabled

## Troubleshooting

### Database Connection Issues
1. Check PostgreSQL is running
2. Verify DATABASE_URL format
3. Ensure PostGIS extension is installed

### Migration Issues
1. Check Prisma schema syntax
2. Verify foreign key constraints
3. Run `npm run db:generate` after schema changes

### Mobile Storage Issues
1. Check AsyncStorage permissions
2. Verify data serialization
3. Monitor memory usage

## Rollback Plan

If needed, you can rollback to MongoDB:
1. Update `server.ts` to use Mongoose
2. Restore original model files
3. Update controllers to use Mongoose
4. Remove Prisma dependencies

## Support

For issues or questions:
1. Check the logs for error messages
2. Verify database connections
3. Test individual endpoints
4. Check mobile storage implementation

## Next Steps

1. **Complete Controller Migration**: Update remaining controllers
2. **Route Updates**: Ensure all routes work with Prisma
3. **Test Suite**: Update tests for new database layer
4. **Performance Testing**: Load test the new setup
5. **Mobile Integration**: Test with actual mobile app
6. **Monitoring**: Set up database monitoring and alerts
