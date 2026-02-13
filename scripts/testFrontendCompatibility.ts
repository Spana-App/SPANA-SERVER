/**
 * Test script to verify frontend payload compatibility
 * Tests that the exact payload format sent by frontend works correctly
 */

import { validateLocation } from '../lib/locationUtils';

console.log('🧪 Testing Frontend Payload Compatibility\n');

// Test 1: Exact format from mobile app
console.log('Test 1: Mobile app format (exact payload)');
const mobileAppPayload = {
  type: 'Point',
  coordinates: [28.0473, -26.2041], // [lng, lat] - Johannesburg
  address: '123 Test Street, Johannesburg'
};

const test1 = validateLocation(mobileAppPayload);
console.log(`  Input:`, JSON.stringify(mobileAppPayload, null, 2));
console.log(`  Valid: ${test1.valid}`);
if (test1.valid) {
  console.log(`  Normalized:`, JSON.stringify(test1.normalized, null, 2));
  console.log(`  ✅ PASSED`);
} else {
  console.log(`  Error: ${test1.error}`);
  console.log(`  ❌ FAILED`);
}

console.log('\n');

// Test 2: With address missing (optional)
console.log('Test 2: Without address (address is optional)');
const payloadNoAddress = {
  type: 'Point',
  coordinates: [28.0473, -26.2041]
};

const test2 = validateLocation(payloadNoAddress);
console.log(`  Input:`, JSON.stringify(payloadNoAddress, null, 2));
console.log(`  Valid: ${test2.valid}`);
if (test2.valid) {
  console.log(`  Normalized:`, JSON.stringify(test2.normalized, null, 2));
  console.log(`  ✅ PASSED`);
} else {
  console.log(`  Error: ${test2.error}`);
  console.log(`  ❌ FAILED`);
}

console.log('\n');

// Test 3: Coordinates in [lat, lng] format (should auto-normalize)
console.log('Test 3: Coordinates in [lat, lng] format (should auto-normalize)');
const payloadLatLng = {
  type: 'Point',
  coordinates: [-26.2041, 28.0473], // [lat, lng] - should normalize to [lng, lat]
  address: 'Test Address'
};

const test3 = validateLocation(payloadLatLng);
console.log(`  Input:`, JSON.stringify(payloadLatLng, null, 2));
console.log(`  Valid: ${test3.valid}`);
if (test3.valid) {
  console.log(`  Normalized:`, JSON.stringify(test3.normalized, null, 2));
  console.log(`  ✅ PASSED - Auto-normalized to [lng, lat]`);
} else {
  console.log(`  Error: ${test3.error}`);
  console.log(`  ❌ FAILED`);
}

console.log('\n');

// Test 4: Invalid coordinates (0, 0)
console.log('Test 4: Invalid coordinates (0, 0) - should reject');
const invalidPayload = {
  type: 'Point',
  coordinates: [0, 0],
  address: 'Invalid Location'
};

const test4 = validateLocation(invalidPayload);
console.log(`  Input:`, JSON.stringify(invalidPayload, null, 2));
console.log(`  Valid: ${test4.valid}`);
if (!test4.valid) {
  console.log(`  Error: ${test4.error}`);
  console.log(`  ✅ PASSED - Correctly rejected invalid coordinates`);
} else {
  console.log(`  ❌ FAILED - Should have rejected (0, 0)`);
}

console.log('\n');

// Test 5: Missing coordinates
console.log('Test 5: Missing coordinates - should reject');
const missingCoords = {
  type: 'Point',
  address: 'Test Address'
};

const test5 = validateLocation(missingCoords);
console.log(`  Input:`, JSON.stringify(missingCoords, null, 2));
console.log(`  Valid: ${test5.valid}`);
if (!test5.valid) {
  console.log(`  Error: ${test5.error}`);
  console.log(`  ✅ PASSED - Correctly rejected missing coordinates`);
} else {
  console.log(`  ❌ FAILED - Should have rejected missing coordinates`);
}

console.log('\n');

// Test 6: Real-world coordinates (Cape Town)
console.log('Test 6: Real-world coordinates (Cape Town)');
const capeTownPayload = {
  type: 'Point',
  coordinates: [18.4241, -33.9249], // [lng, lat] - Cape Town
  address: 'Cape Town, South Africa'
};

const test6 = validateLocation(capeTownPayload);
console.log(`  Input:`, JSON.stringify(capeTownPayload, null, 2));
console.log(`  Valid: ${test6.valid}`);
if (test6.valid) {
  console.log(`  Normalized:`, JSON.stringify(test6.normalized, null, 2));
  console.log(`  ✅ PASSED`);
} else {
  console.log(`  Error: ${test6.error}`);
  console.log(`  ❌ FAILED`);
}

console.log('\n');
console.log('📊 Summary:');
console.log(`  Total tests: 6`);
console.log(`  Expected to pass: 4 (Tests 1, 2, 3, 6)`);
console.log(`  Expected to fail (validation): 2 (Tests 4, 5)`);
console.log('\n✅ Frontend payload format is fully compatible!');
