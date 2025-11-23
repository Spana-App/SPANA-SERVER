# End-to-End Flow Implementation Guide

## Overview

This document describes the comprehensive end-to-end flow implementation for the Spana platform, including admin operations, service provider workflows, customer interactions, and payment tracking.

## Features Implemented

### 1. Admin OTP Authentication
- **Location**: `routes/admin.ts`, `controllers/adminController.ts`
- **Endpoints**:
  - `POST /admin/otp/request` - Request OTP for admin login
  - `POST /admin/otp/verify` - Verify OTP and get token
- **Security**:
  - 6-digit OTP sent via email
  - 5-hour expiry for OTP
  - 5-hour token expiry for admin sessions
  - IP address and user agent tracking

### 2. Service Provider Application Flow
- **Database Models**: `ServiceProviderApplication`
- **Flow**:
  1. Provider applies with email, skills, experience
  2. Admin reviews and approves/rejects
  3. Approved applications receive invitation token
  4. Provider registers using invitation token
  5. Provider uploads documents
  6. Documents verified via third-party (Datanamix simulation)
  7. Admin activates provider

### 3. Document Verification with Third-Party
- **Database Models**: `DocumentVerification`
- **Features**:
  - Integration with Datanamix (simulated)
  - Admin override capability
  - Verification status tracking
  - Verification data storage

### 4. Provider Payout Tracking
- **Database Models**: `ProviderPayout`
- **Features**:
  - Period-based payouts (fortnightly/monthly)
  - Commission calculation
  - Payment status tracking
  - Booking association

### 5. Stats Endpoints (Public)
- **Location**: `routes/stats.ts`, `controllers/statsController.ts`
- **Endpoints**:
  - `GET /stats/platform` - Overall platform statistics
  - `GET /stats/providers/location` - Provider statistics by location
  - `GET /stats/services/categories` - Service category statistics
  - `GET /stats/bookings/trends` - Booking trends (last 30 days)
  - `GET /stats/providers/top` - Top performing providers
  - `GET /stats/revenue` - Revenue statistics

## Database Schema Updates

### New Tables

1. **ServiceProviderApplication**
   - Tracks provider applications
   - Stores invitation tokens
   - Links to ServiceProvider after registration

2. **AdminOTP**
   - Stores OTP sessions for admin login
   - Tracks usage and expiry

3. **DocumentVerification**
   - Links documents to third-party verification
   - Stores verification results
   - Allows admin override

4. **ProviderPayout**
   - Tracks provider earnings and payouts
   - Period-based aggregation
   - Commission tracking

### Updated Tables

1. **ServiceProvider**
   - Added `applicationStatus` field
   - Added `applicationId` relation

2. **Document**
   - Added `verification` relation

## End-to-End Flow Simulation

### Running the Simulation

```bash
cd spana-backend
npx ts-node scripts/simulateEndToEndFlow.ts
```

### What the Simulation Does

1. **Admin Setup**
   - Creates admin user
   - Tests OTP login flow

2. **Provider Applications** (5 providers)
   - Creates applications
   - Admin approves 4, rejects 1

3. **Provider Registration**
   - Providers register using invitation tokens
   - Upload documents (ID, license, certifications)

4. **Document Verification**
   - Simulates third-party verification (Datanamix)
   - Admin reviews and approves documents

5. **Provider Activation**
   - Admin activates verified providers
   - Providers can now receive job offers

6. **Service Creation**
   - Providers create services
   - Admin approves services

7. **Customer Bookings** (10 bookings)
   - Customers book services
   - Providers accept/decline (70% acceptance rate)

8. **Payment Processing**
   - Customers pay for services
   - Payments held in escrow
   - Commission calculated (15%)

9. **Job Completion**
   - Jobs marked as completed
   - Customers rate providers (1-5 stars)
   - Provider ratings updated

10. **Complaint Handling**
    - 2 customers file complaints
    - Admin resolves complaints

11. **Payment Release**
    - Payments released to providers
    - Provider payouts created

## Testing the Flows

### Admin OTP Login

```bash
# 1. Request OTP
curl -X POST http://localhost:5003/admin/otp/request \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@spana.co.za"}'

# 2. Verify OTP (check email for OTP)
curl -X POST http://localhost:5003/admin/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@spana.co.za", "otp": "123456"}'
```

### Service Provider Application

```bash
# 1. Apply as provider
curl -X POST http://localhost:5003/providers/apply \
  -H "Content-Type: application/json" \
  -d '{
    "email": "provider@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+27123456789",
    "skills": ["Plumbing", "Electrical"],
    "experienceYears": 5,
    "motivation": "I want to join Spana..."
  }'

# 2. Admin approves (requires admin token)
curl -X PUT http://localhost:5003/admin/applications/{applicationId}/approve \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"approved": true}'
```

### Stats Endpoints

```bash
# Platform stats
curl http://localhost:5003/stats/platform

# Provider stats by location
curl http://localhost:5003/stats/providers/location

# Service category stats
curl http://localhost:5003/stats/services/categories

# Booking trends
curl http://localhost:5003/stats/bookings/trends

# Top providers
curl http://localhost:5003/stats/providers/top?limit=10

# Revenue stats
curl http://localhost:5003/stats/revenue
```

## Key Features

### 1. Uber-Style Job Acceptance
- Providers receive job requests
- Can accept or decline
- Decline reasons tracked
- Acceptance rate monitored

### 2. Escrow Payment System
- Customer payments held in escrow
- 15% commission to Spana
- Payments released after job completion
- Provider payouts tracked

### 3. Complaint System
- Customers can report providers
- Multiple complaint types
- Severity levels
- Admin resolution tracking

### 4. Rating System
- Customers rate providers (1-5 stars)
- Provider ratings calculated
- Reviews stored
- Average ratings displayed

## Database Migrations

All migrations have been created and applied:

```bash
npx prisma migrate dev --name add_otp_and_application_tables
```

## Next Steps

1. **Implement Real Third-Party Integration**
   - Replace Datanamix simulation with actual API
   - Add error handling and retries

2. **Add More Stats Endpoints**
   - Provider performance metrics
   - Customer retention stats
   - Service popularity trends

3. **Enhance Admin Dashboard**
   - Real-time notifications
   - Dashboard widgets
   - Export capabilities

4. **Add Provider Payout Processing**
   - Bank transfer integration
   - Mobile money integration
   - Payout scheduling

## Notes

- All OTP emails are sent via SMTP (configure in `.env`)
- Third-party verification is currently simulated
- Payment processing uses PayFast (configure in `.env`)
- All timestamps are in UTC

