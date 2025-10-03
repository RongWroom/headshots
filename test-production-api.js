#!/usr/bin/env node

/**
 * Test the production headshots API to identify the exact issue
 */

async function testProductionAPI() {
  console.log('🧪 Testing production headshots API...\n');
  
  const baseUrl = 'https://headshots-pied.vercel.app';
  
  // Test cases with different scenarios
  const testCases = [
    {
      name: 'Test without authentication',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        modelId: 19,
        prompt: 'professional headshot, business attire',
        packSlug: 'corporate-headshots',
        numOutputs: 4
      }
    },
    {
      name: 'Test with invalid model ID',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        modelId: 999,
        prompt: 'professional headshot, business attire',
        packSlug: 'corporate-headshots',
        numOutputs: 4
      }
    },
    {
      name: 'Test with missing fields',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        prompt: 'professional headshot, business attire'
        // Missing modelId
      }
    },
    {
      name: 'Test with invalid JSON',
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'invalid json'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📋 ${testCase.name}`);
    console.log('Request body:', typeof testCase.body === 'string' ? testCase.body : JSON.stringify(testCase.body, null, 2));
    
    try {
      const response = await fetch(`${baseUrl}/api/generate/headshots`, {
        method: 'POST',
        headers: testCase.headers,
        body: typeof testCase.body === 'string' ? testCase.body : JSON.stringify(testCase.body)
      });
      
      console.log(`📡 Response status: ${response.status} ${response.statusText}`);
      
      const responseText = await response.text();
      
      try {
        const responseJson = JSON.parse(responseText);
        console.log('📋 Response:', JSON.stringify(responseJson, null, 2));
        
        // Look for debug information
        if (responseJson.debug) {
          console.log('🔍 Debug info:', JSON.stringify(responseJson.debug, null, 2));
        }
        
        if (responseJson.details) {
          console.log('📝 Details:', responseJson.details);
        }
        
      } catch (parseError) {
        console.log('📋 Raw response (not JSON):', responseText);
      }
      
    } catch (error) {
      console.error('❌ Request failed:', error.message);
    }
  }
  
  console.log('\n🎯 Summary:');
  console.log('The enhanced logging should now show exactly what\'s failing.');
  console.log('Look for specific error messages in the responses above.');
}

testProductionAPI().catch(console.error);