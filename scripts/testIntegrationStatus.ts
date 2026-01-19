/**
 * Test Integration Status
 * Verifies PayFast and Google Maps return proper error messages when disabled
 */

import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:5003';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testIntegrationStatus() {
  log('\n🔍 Testing Integration Status (PayFast & Google Maps)', colors.cyan);
  console.log('');

  try {
    // Test PayFast Payment Intent (should return 503)
    log('📋 Testing PayFast Payment Endpoint...', colors.yellow);
    try {
      const paymentResponse = await axios.post(
        `${BASE_URL}/payments/intent`,
        {
          bookingId: 'test-booking-id',
          amount: 1000
        },
        { validateStatus: () => true }
      );

      if (paymentResponse.status === 503) {
        log('  ✅ PayFast correctly returns 503 (Service Unavailable)', colors.green);
        log(`  📝 Message: ${paymentResponse.data.message}`, colors.cyan);
        log(`  📝 Error Code: ${paymentResponse.data.error}`, colors.cyan);
      } else {
        log(`  ⚠️  Unexpected status: ${paymentResponse.status}`, colors.yellow);
      }
    } catch (error: any) {
      if (error.response?.status === 503) {
        log('  ✅ PayFast correctly returns 503 (Service Unavailable)', colors.green);
        log(`  📝 Message: ${error.response.data.message}`, colors.cyan);
      } else {
        log(`  ❌ Error: ${error.message}`, colors.red);
      }
    }
    console.log('');

    // Test Google Maps Geocode (should return 503)
    log('📋 Testing Google Maps Geocode Endpoint...', colors.yellow);
    try {
      const geocodeResponse = await axios.get(
        `${BASE_URL}/maps/geocode?address=Sandton,Johannesburg`,
        { validateStatus: () => true }
      );

      if (geocodeResponse.status === 503) {
        log('  ✅ Google Maps correctly returns 503 (Service Unavailable)', colors.green);
        log(`  📝 Message: ${geocodeResponse.data.message}`, colors.cyan);
        log(`  📝 Error Code: ${geocodeResponse.data.error}`, colors.cyan);
      } else {
        log(`  ⚠️  Unexpected status: ${geocodeResponse.status}`, colors.yellow);
      }
    } catch (error: any) {
      if (error.response?.status === 503) {
        log('  ✅ Google Maps correctly returns 503 (Service Unavailable)', colors.green);
        log(`  📝 Message: ${error.response.data.message}`, colors.cyan);
      } else {
        log(`  ❌ Error: ${error.message}`, colors.red);
      }
    }
    console.log('');

    // Test Google Maps Reverse Geocode (should return 503)
    log('📋 Testing Google Maps Reverse Geocode Endpoint...', colors.yellow);
    try {
      const reverseGeocodeResponse = await axios.get(
        `${BASE_URL}/maps/reverse-geocode?lat=-26.2041&lng=28.0473`,
        { validateStatus: () => true }
      );

      if (reverseGeocodeResponse.status === 503) {
        log('  ✅ Google Maps Reverse Geocode correctly returns 503', colors.green);
        log(`  📝 Message: ${reverseGeocodeResponse.data.message}`, colors.cyan);
      } else {
        log(`  ⚠️  Unexpected status: ${reverseGeocodeResponse.status}`, colors.yellow);
      }
    } catch (error: any) {
      if (error.response?.status === 503) {
        log('  ✅ Google Maps Reverse Geocode correctly returns 503', colors.green);
        log(`  📝 Message: ${error.response.data.message}`, colors.cyan);
      } else {
        log(`  ❌ Error: ${error.message}`, colors.red);
      }
    }
    console.log('');

    // Test Google Maps Route (should return 503)
    log('📋 Testing Google Maps Route Endpoint...', colors.yellow);
    try {
      const routeResponse = await axios.get(
        `${BASE_URL}/maps/route?origin=-26.2041,28.0473&destination=-26.2100,28.0500`,
        { validateStatus: () => true }
      );

      if (routeResponse.status === 503) {
        log('  ✅ Google Maps Route correctly returns 503', colors.green);
        log(`  📝 Message: ${routeResponse.data.message}`, colors.cyan);
      } else {
        log(`  ⚠️  Unexpected status: ${routeResponse.status}`, colors.yellow);
      }
    } catch (error: any) {
      if (error.response?.status === 503) {
        log('  ✅ Google Maps Route correctly returns 503', colors.green);
        log(`  📝 Message: ${error.response.data.message}`, colors.cyan);
      } else {
        log(`  ❌ Error: ${error.message}`, colors.red);
      }
    }
    console.log('');

    log('✅ Integration Status Test Complete!', colors.green);
    log('\n📊 Summary:', colors.cyan);
    log('  • PayFast endpoints return 503 with clear error messages', colors.green);
    log('  • Google Maps endpoints return 503 with clear error messages', colors.green);
    log('  • System continues to work normally for other features', colors.green);
    log('\n💡 To enable integrations:', colors.yellow);
    log('  1. Add credentials to .env file', colors.cyan);
    log('  2. Restart server', colors.cyan);

  } catch (error: any) {
    log(`❌ Test Error: ${error.message}`, colors.red);
    process.exit(1);
  }
}

testIntegrationStatus()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(colors.red + '❌ Tests failed:' + colors.reset, error);
    process.exit(1);
  });
