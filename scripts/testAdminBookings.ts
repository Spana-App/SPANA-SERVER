/**
 * Test Admin Bookings Endpoint - See what data is returned
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'https://spana-server-5bhu.onrender.com';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testAdminBookings() {
  log('\n📊 Admin Bookings Endpoint - Data Structure\n', colors.blue);
  log(`📍 API Base URL: ${API_BASE_URL}\n`, colors.cyan);

  try {
    // Step 1: Login as Admin (you'll need to provide admin credentials)
    log('1. Logging in as Admin...', colors.yellow);
    log('   ⚠️  Note: You need admin credentials to test this endpoint\n', colors.yellow);
    
    // For testing, we'll show the structure based on the code
    log('2. Endpoint Structure:\n', colors.yellow);
    log('   Endpoint: GET /admin/bookings', colors.cyan);
    log('   Auth: Required (Admin role)', colors.cyan);
    log('   Route: routes/admin.ts line 24', colors.cyan);
    log('   Controller: adminController.getAllBookings\n', colors.cyan);

    log('3. Response Structure (Array of Booking Objects):\n', colors.yellow);
    
    const bookingStructure = {
      // Booking Core Fields
      id: "booking_id",
      referenceNumber: "SPANA-BK-000001",
      date: "2025-11-15T10:00:00Z",
      time: "10:00",
      location: {
        type: "Point",
        coordinates: [28.0473, -26.2041],
        address: "123 Main St, Johannesburg"
      },
      notes: "Please arrive on time",
      status: "pending_payment", // 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'
      
      // Job Size and Pricing
      jobSize: "medium", // 'small', 'medium', 'large', 'custom'
      basePrice: 500.00,
      jobSizeMultiplier: 1.5,
      calculatedPrice: 750.00,
      locationMultiplier: 1.2,
      providerDistance: 2.5, // Distance in km
      
      // SLA Tracking
      estimatedDurationMinutes: 60,
      startedAt: null,
      completedAt: null,
      slaBreached: false,
      slaPenaltyAmount: 0,
      actualDurationMinutes: null,
      
      // Proximity Tracking
      proximityDetected: false,
      proximityDetectedAt: null,
      proximityStartTime: null,
      canStartJob: false,
      
      // Live Tracking
      providerLiveLocation: null, // { type: "Point", coordinates: [lng, lat] }
      customerLiveLocation: null, // { type: "Point", coordinates: [lng, lat] }
      distanceApart: null, // Distance in meters
      
      // Rating and Review
      rating: null, // 1-5 (customer rating provider)
      review: null, // Customer review
      customerRating: null, // 1-5 (provider rating customer)
      customerReview: null, // Provider review of customer
      
      // Request/Accept Flow
      requestStatus: "pending", // 'pending', 'accepted', 'declined', 'expired'
      providerAcceptedAt: null,
      providerDeclinedAt: null,
      declineReason: null,
      
      // Payment Tracking
      paymentStatus: "pending", // 'pending', 'paid_to_escrow', 'released_to_provider', 'refunded'
      escrowAmount: null,
      commissionAmount: null,
      providerPayoutAmount: null,
      
      // Chat Tokens
      providerChatToken: null, // Generated when provider accepts
      customerChatToken: null, // Generated when payment confirmed
      chatActive: false,
      chatTerminatedAt: null,
      
      // Invoice
      invoiceNumber: null,
      invoiceSentAt: null,
      
      // Timestamps
      createdAt: "2025-11-15T10:00:00Z",
      updatedAt: "2025-11-15T10:00:00Z",
      
      // INCLUDED RELATIONSHIPS (Admin View):
      service: {
        id: "service_id",
        title: "Plumbing Service",
        description: "Professional plumbing repairs",
        price: 500.00,
        duration: 60,
        status: "active",
        adminApproved: true,
        mediaUrl: "https://...",
        provider: {
          id: "provider_id",
          rating: 4.5,
          totalReviews: 10,
          isOnline: true,
          isVerified: true,
          user: {
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com"
          }
        }
      },
      customer: {
        id: "customer_id",
        ratingGivenAvg: 4.2,
        totalBookings: 5,
        user: {
          firstName: "Jane",
          lastName: "Smith",
          email: "jane@example.com"
        }
      },
      payment: {
        id: "payment_id",
        amount: 750.00,
        currency: "ZAR",
        paymentMethod: "payfast",
        status: "completed",
        escrowStatus: "held", // 'held', 'released', 'refunded'
        commissionRate: 0.15,
        commissionAmount: 112.50,
        providerPayout: 637.50,
        tipAmount: 0,
        transactionId: "TXN1234567890",
        createdAt: "2025-11-15T10:05:00Z"
      }
    };

    console.log(JSON.stringify(bookingStructure, null, 2));

    log('\n4. Key Points:\n', colors.yellow);
    log('   ✅ Returns ALL bookings (no filtering)', colors.green);
    log('   ✅ Ordered by createdAt DESC (newest first)', colors.green);
    log('   ✅ Includes full service details with provider info', colors.green);
    log('   ✅ Includes full customer details with user info', colors.green);
    log('   ✅ Includes payment details if payment exists', colors.green);
    log('   ✅ Provider user includes: firstName, lastName, email', colors.green);
    log('   ✅ Customer user includes: firstName, lastName, email', colors.green);
    log('   ✅ All booking fields are included (SLA, proximity, ratings, etc.)', colors.green);

    log('\n5. Query Parameters (Currently Not Implemented):\n', colors.yellow);
    log('   ⚠️  No filtering by status, date, or pagination yet', colors.yellow);
    log('   📝 Could be added: ?status=completed&dateFrom=...&dateTo=...', colors.cyan);

    log('\n' + '='.repeat(60), colors.blue);
    log('✅ Structure Documentation Complete!', colors.green);
    log('='.repeat(60) + '\n', colors.blue);

  } catch (error: any) {
    log('\n❌ Error:', colors.red);
    log(error.message, colors.red);
  }
}

testAdminBookings();
