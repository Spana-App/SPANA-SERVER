/**
 * Test script to verify location auto-update fix
 * Tests that customers can create bookings even without profile location
 */

import axios from 'axios';
import prisma from '../lib/database';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function testLocationAutoUpdate() {
  console.log('🧪 Testing Location Auto-Update Fix\n');

  try {
    // 1. Create a test customer user without location
    console.log('1. Creating test customer...');
    const testEmail = `test_location_${Date.now()}@test.com`;
    
    // Register customer
    const registerRes = await axios.post(`${API_BASE_URL}/auth/register`, {
      email: testEmail,
      password: 'Test123!@#',
      firstName: 'Test',
      lastName: 'Customer',
      role: 'customer',
      phone: '+27123456789'
    });

    if (registerRes.status !== 201 && registerRes.status !== 200) {
      throw new Error(`Registration failed: ${registerRes.status}`);
    }

    const userId = registerRes.data.user?.id || registerRes.data.id;
    console.log(`   ✅ Customer created: ${userId}`);

    // Login to get token
    const loginRes = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: testEmail,
      password: 'Test123!@#'
    });

    const customerToken = loginRes.data.token;
    console.log(`   ✅ Token obtained`);

    // 2. Verify customer has no location in profile
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (user?.location) {
      // Remove location to simulate the bug scenario
      await prisma.user.update({
        where: { id: userId },
        data: { location: null }
      });
      console.log('   ✅ Removed location from profile');
    } else {
      console.log('   ✅ Customer has no location in profile (as expected)');
    }

    // 3. Get or create a service for booking
    console.log('\n2. Finding available service...');
    const customer = await prisma.customer.findUnique({
      where: { userId }
    });

    if (!customer) {
      throw new Error('Customer record not found');
    }

    // Find an approved service
    const service = await prisma.service.findFirst({
      where: { adminApproved: true, status: 'active' },
      include: { provider: true }
    });

    if (!service) {
      console.log('   ⚠️  No approved services found. Creating test service...');
      // Would need provider setup, skip for now
      throw new Error('No approved services available for testing');
    }

    console.log(`   ✅ Found service: ${service.id}`);

    // 4. Try to create booking with location in request (should succeed now)
    console.log('\n3. Creating booking with location in request...');
    const bookingLocation = {
      type: 'Point',
      coordinates: [28.0473, -26.2041],
      address: 'Test Location, Johannesburg'
    };

    try {
      const bookingRes = await axios.post(
        `${API_BASE_URL}/bookings`,
        {
          serviceId: service.id,
          date: new Date().toISOString(),
          time: '10:00',
          location: bookingLocation,
          notes: 'Test booking without profile location',
          estimatedDurationMinutes: 60,
          jobSize: 'medium'
        },
        {
          headers: {
            Authorization: `Bearer ${customerToken}`
          }
        }
      );

      if (bookingRes.status === 201) {
        console.log('   ✅ Booking created successfully!');
        console.log(`   ✅ Booking ID: ${bookingRes.data.booking?.id || bookingRes.data.id}`);

        // 5. Verify profile location was auto-updated
        console.log('\n4. Verifying profile location was auto-updated...');
        const updatedUser = await prisma.user.findUnique({
          where: { id: userId }
        });

        if (updatedUser?.location) {
          console.log('   ✅ Profile location was auto-updated!');
          console.log(`   ✅ Location: ${JSON.stringify(updatedUser.location)}`);
          
          // Verify it matches the booking location
          if (JSON.stringify(updatedUser.location) === JSON.stringify(bookingLocation)) {
            console.log('   ✅ Location matches booking request location!');
          } else {
            console.log('   ⚠️  Location updated but format may differ');
          }
        } else {
          console.log('   ❌ Profile location was NOT updated');
          throw new Error('Location auto-update failed');
        }

        console.log('\n✅ ALL TESTS PASSED! The fix works correctly.');
      } else {
        throw new Error(`Unexpected status: ${bookingRes.status}`);
      }
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('location')) {
        console.log('   ❌ Booking failed with location error (fix not working)');
        console.log(`   Error: ${error.response.data.message}`);
        throw error;
      } else {
        throw error;
      }
    }

    // Cleanup removed to prevent accidental data loss
    console.log('\n5. Test complete. (Cleanup skipped - delete test user manually if needed)');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:');
    console.error(error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

testLocationAutoUpdate();
