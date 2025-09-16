#!/usr/bin/env node

/**
 * Test script for diagnostic and health check endpoints
 * Run with: node test-diagnostic-endpoints.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testEndpoint(url, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${url}`, options);
    const data = await response.json();
    
    return {
      url,
      status: response.status,
      success: response.ok,
      data
    };
  } catch (error) {
    return {
      url,
      status: 0,
      success: false,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('🔍 Testing Diagnostic and Health Check Endpoints\n');
  
  const tests = [
    {
      name: 'General Health Check',
      test: () => testEndpoint('/api/health')
    },
    {
      name: 'Replicate Health Check',
      test: () => testEndpoint('/api/replicate/health')
    },
    {
      name: 'Validation Service Health',
      test: () => testEndpoint('/api/validate/training')
    },
    {
      name: 'Training Input Validation (Valid)',
      test: () => testEndpoint('/api/validate/training', 'POST', {
        imageUrls: ['https://httpbin.org/image/jpeg'],
        modelName: 'test-model',
        trainingConfig: {
          trigger_word: 'sks'
        }
      })
    },
    {
      name: 'Training Input Validation (Invalid)',
      test: () => testEndpoint('/api/validate/training', 'POST', {
        imageUrls: ['invalid-url'],
        modelName: '',
        trainingConfig: {
          trigger_word: ''
        }
      })
    }
  ];
  
  for (const { name, test } of tests) {
    console.log(`Testing: ${name}`);
    const result = await test();
    
    if (result.success) {
      console.log(`✅ ${name} - Status: ${result.status}`);
      if (result.data.overall) {
        console.log(`   Overall Status: ${result.data.overall}`);
      }
      if (result.data.canProceed !== undefined) {
        console.log(`   Can Proceed: ${result.data.canProceed}`);
      }
    } else {
      console.log(`❌ ${name} - Status: ${result.status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
    console.log('');
  }
  
  console.log('🎉 Diagnostic endpoint tests completed!');
}

// Only run if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testEndpoint, runTests };