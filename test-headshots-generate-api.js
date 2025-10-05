/**
 * Test script for headshots generation API endpoint
 * Tests validation, authentication, and request handling
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Test data
const validRequest = {
  referenceImages: [
    'https://blob.vercel-storage.com/test1.jpg',
    'https://blob.vercel-storage.com/test2.jpg',
    'https://blob.vercel-storage.com/test3.jpg',
    'https://blob.vercel-storage.com/test4.jpg',
    'https://blob.vercel-storage.com/test5.jpg'
  ],
  numOutputs: 4,
  styleIntensity: 0.8
};

const invalidRequests = {
  tooFewImages: {
    referenceImages: [
      'https://blob.vercel-storage.com/test1.jpg',
      'https://blob.vercel-storage.com/test2.jpg'
    ]
  },
  tooManyImages: {
    referenceImages: Array(15).fill('https://blob.vercel-storage.com/test.jpg')
  },
  invalidUrls: {
    referenceImages: [
      'https://example.com/test1.jpg',
      'https://example.com/test2.jpg',
      'https://example.com/test3.jpg',
      'https://example.com/test4.jpg',
      'https://example.com/test5.jpg'
    ]
  },
  invalidNumOutputs: {
    referenceImages: validRequest.referenceImages,
    numOutputs: 20
  },
  invalidStyleIntensity: {
    referenceImages: validRequest.referenceImages,
    styleIntensity: 1.5
  }
};

async function testEndpoint(name, payload, expectedStatus) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`Expected status: ${expectedStatus}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/headshots/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    console.log(`✓ Status: ${response.status}`);
    console.log(`✓ Response:`, JSON.stringify(data, null, 2));
    
    if (response.status === expectedStatus) {
      console.log(`✅ PASS: Got expected status ${expectedStatus}`);
      return true;
    } else {
      console.log(`❌ FAIL: Expected ${expectedStatus}, got ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ERROR:`, error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Headshots Generation API Tests\n');
  console.log(`Testing endpoint: ${BASE_URL}/api/headshots/generate`);
  console.log('=' .repeat(60));
  
  const results = [];
  
  // Test 1: Authentication required (should fail without auth)
  results.push(await testEndpoint(
    'Authentication Required',
    validRequest,
    401
  ));
  
  // Test 2: Too few images
  results.push(await testEndpoint(
    'Too Few Images (< 5)',
    invalidRequests.tooFewImages,
    400
  ));
  
  // Test 3: Too many images
  results.push(await testEndpoint(
    'Too Many Images (> 10)',
    invalidRequests.tooManyImages,
    400
  ));
  
  // Test 4: Invalid URLs (not from Vercel Blob)
  results.push(await testEndpoint(
    'Invalid URLs (not Vercel Blob)',
    invalidRequests.invalidUrls,
    400
  ));
  
  // Test 5: Invalid numOutputs
  results.push(await testEndpoint(
    'Invalid numOutputs',
    invalidRequests.invalidNumOutputs,
    400
  ));
  
  // Test 6: Invalid styleIntensity
  results.push(await testEndpoint(
    'Invalid styleIntensity',
    invalidRequests.invalidStyleIntensity,
    400
  ));
  
  // Test 7: Invalid JSON
  console.log(`\n🧪 Testing: Invalid JSON`);
  console.log(`Expected status: 400`);
  try {
    const response = await fetch(`${BASE_URL}/api/headshots/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'invalid json{'
    });
    
    const data = await response.json();
    console.log(`✓ Status: ${response.status}`);
    console.log(`✓ Response:`, JSON.stringify(data, null, 2));
    
    if (response.status === 400) {
      console.log(`✅ PASS: Got expected status 400`);
      results.push(true);
    } else {
      console.log(`❌ FAIL: Expected 400, got ${response.status}`);
      results.push(false);
    }
  } catch (error) {
    console.log(`❌ ERROR:`, error.message);
    results.push(false);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${total - passed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  if (passed === total) {
    console.log('\n✅ All tests passed!');
  } else {
    console.log('\n❌ Some tests failed');
  }
}

// Run tests
runTests().catch(console.error);
