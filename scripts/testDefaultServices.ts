/**
 * Test Default Services
 * Verifies that default system services are created and accessible
 */

import axios from 'axios';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5003';

async function testDefaultServices() {
  console.log('🧪 Testing Default Services System\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  try {
    // Test 1: Get all services (should include default services)
    console.log('📋 Test 1: Getting all services...');
    const servicesResponse = await axios.get(`${BASE_URL}/services`, {
      validateStatus: () => true
    });

    if (servicesResponse.status === 200) {
      const services = servicesResponse.data;
      console.log(`✅ Found ${services.length} total services`);

      // Count system services
      const systemServices = services.filter((s: any) => s.isSystemService === true);
      const customServices = services.filter((s: any) => !s.isSystemService || s.isSystemService === false);
      const unassignedServices = services.filter((s: any) => s.providerId === null);

      console.log(`   📦 System services: ${systemServices.length}`);
      console.log(`   ✏️  Custom services: ${customServices.length}`);
      console.log(`   🔗 Unassigned services: ${unassignedServices.length}`);

      if (systemServices.length > 0) {
        console.log('\n   📋 Sample System Services:');
        systemServices.slice(0, 5).forEach((service: any) => {
          console.log(`      - ${service.title} (${service.category}) - R${service.price}`);
          console.log(`        Provider: ${service.providerId ? 'Assigned' : 'Not assigned'}`);
          console.log(`        Status: ${service.status}, Approved: ${service.adminApproved}`);
        });
      }
    } else {
      console.log(`❌ Failed to get services: ${servicesResponse.status}`);
    }

    // Test 2: Check service categories
    console.log('\n📋 Test 2: Checking service categories...');
    const categoriesResponse = await axios.get(`${BASE_URL}/services`, {
      validateStatus: () => true
    });

    if (categoriesResponse.status === 200) {
      const services = categoriesResponse.data;
      const categories = [...new Set(services.map((s: any) => s.category))];
      console.log(`✅ Found ${categories.length} categories: ${categories.join(', ')}`);
    }

    // Test 3: Verify default services have correct properties
    console.log('\n📋 Test 3: Verifying default service properties...');
    const verifyResponse = await axios.get(`${BASE_URL}/services`, {
      validateStatus: () => true
    });

    if (verifyResponse.status === 200) {
      const systemServices = verifyResponse.data.filter((s: any) => s.isSystemService === true);
      
      if (systemServices.length > 0) {
        const sample = systemServices[0];
        const checks = {
          'Has isSystemService field': sample.hasOwnProperty('isSystemService'),
          'isSystemService is true': sample.isSystemService === true,
          'Has title': !!sample.title,
          'Has category': !!sample.category,
          'Has price': typeof sample.price === 'number',
          'Has duration': typeof sample.duration === 'number',
          'Is admin approved': sample.adminApproved === true,
          'Is active': sample.status === 'active',
          'Provider can be null': sample.providerId === null || typeof sample.providerId === 'string'
        };

        console.log('   Property checks:');
        Object.entries(checks).forEach(([check, passed]) => {
          console.log(`      ${passed ? '✅' : '❌'} ${check}`);
        });

        const allPassed = Object.values(checks).every(v => v === true);
        if (allPassed) {
          console.log('\n   ✅ All property checks passed!');
        } else {
          console.log('\n   ⚠️  Some checks failed');
        }
      } else {
        console.log('   ⚠️  No system services found');
      }
    }

    // Test 4: Test discover endpoint with default services
    console.log('\n📋 Test 4: Testing /services/discover with default services...');
    const discoverResponse = await axios.get(`${BASE_URL}/services/discover`, {
      validateStatus: () => true
    });

    if (discoverResponse.status === 200) {
      const data = discoverResponse.data;
      console.log(`✅ Discover endpoint works!`);
      console.log(`   Recently booked: ${data.recentlyBooked?.length || 0}`);
      console.log(`   Suggested: ${data.suggested?.length || 0}`);
      
      if (data.suggested && data.suggested.length > 0) {
        console.log(`   Suggestion type: ${data.meta?.suggestionType || 'unknown'}`);
        console.log(`   Sample suggestion: ${data.suggested[0].title} (${data.suggested[0].category})`);
      }
    }

    console.log('\n✅ All tests completed!\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

testDefaultServices();

