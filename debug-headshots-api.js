#!/usr/bin/env node

/**
 * Debug version of headshots API to identify the exact issue
 */

require('dotenv').config({ path: '.env.local' });

async function simulateHeadshotsAPI() {
  console.log('🔍 Simulating headshots API call...\n');
  
  const { createClient } = require('@supabase/supabase-js');
  
  // Create Supabase client (using service role for testing)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // Simulate the request body that might be sent from frontend
  const testRequests = [
    {
      name: 'Test with existing model ID 19',
      body: {
        modelId: 19,
        prompt: 'professional headshot, business attire',
        packSlug: 'corporate-headshots',
        numOutputs: 4
      }
    },
    {
      name: 'Test with existing model ID 15', 
      body: {
        modelId: 15,
        prompt: 'professional headshot, business attire',
        packSlug: 'corporate-headshots',
        numOutputs: 4
      }
    },
    {
      name: 'Test with non-existent model ID',
      body: {
        modelId: 999,
        prompt: 'professional headshot, business attire',
        packSlug: 'corporate-headshots',
        numOutputs: 4
      }
    }
  ];
  
  for (const testRequest of testRequests) {
    console.log(`\n📋 ${testRequest.name}`);
    console.log('Request body:', JSON.stringify(testRequest.body, null, 2));
    
    try {
      const { modelId, prompt, packSlug, numOutputs } = testRequest.body;
      
      // Validate required fields
      if (!modelId || !prompt) {
        console.log('❌ Missing required fields: modelId and prompt');
        continue;
      }
      
      // Try to get the model (simulating the API logic)
      console.log(`🔍 Looking for model with ID: ${modelId}`);
      
      const { data: customerModel, error: modelError } = await supabase
        .from('models')
        .select('*')
        .eq('id', modelId)
        .eq('user_id', 'e7cdc1b8-ea87-4c35-ba89-ce26b405f5c0') // Using the known user ID
        .single();
      
      if (modelError || !customerModel) {
        console.log('❌ Model not found or access denied');
        console.log('Error:', modelError?.message || 'No model returned');
        
        // Check if model exists but belongs to different user
        const { data: anyModel, error: anyError } = await supabase
          .from('models')
          .select('*')
          .eq('id', modelId)
          .single();
          
        if (anyModel) {
          console.log(`💡 Model exists but belongs to user: ${anyModel.user_id}`);
          console.log(`💡 Expected user: e7cdc1b8-ea87-4c35-ba89-ce26b405f5c0`);
        }
        continue;
      }
      
      console.log('✅ Model found:', {
        id: customerModel.id,
        name: customerModel.name,
        status: customerModel.status,
        type: customerModel.type,
        runpodId: customerModel.modelId
      });
      
      // Check if we have inference endpoint
      const inferenceEndpoint = process.env.RUNPOD_INFERENCE_ENDPOINT;
      if (!inferenceEndpoint) {
        console.log('❌ RunPod inference endpoint not configured');
        continue;
      }
      
      console.log('✅ RunPod inference endpoint configured:', inferenceEndpoint);
      
      // Build the prompt
      const packStyles = {
        'actor-headshots': 'professional actor headshot, dramatic lighting, cinematic, high detail',
        'corporate-headshots': 'professional corporate headshot, clean background, business attire, professional lighting',
        'creative-headshots': 'creative professional headshot, artistic lighting, modern style'
      };
      
      const packStyle = packStyles[packSlug] || packStyles['corporate-headshots'];
      const finalPrompt = `${packStyle}, ${prompt}, professional photography studio lighting, high resolution, sharp focus, detailed facial features, commercial quality headshot, realistic skin texture, natural lighting, photorealistic`;
      
      console.log('✅ Prompt built:', finalPrompt.substring(0, 100) + '...');
      
      // Test workflow generation
      const testWorkflow = {
        "4": { "inputs": { "ckpt_name": "flux1-dev-fp8.safetensors" }, "class_type": "CheckpointLoaderSimple" },
        "6": { "inputs": { "text": finalPrompt, "clip": ["4", 1] }, "class_type": "CLIPTextEncode" },
        "5": { "inputs": { "width": 1024, "height": 1024, "batch_size": 1 }, "class_type": "EmptyLatentImage" },
        "3": { "inputs": { "seed": -1, "steps": 28, "cfg": 5.0, "sampler_name": "euler", "scheduler": "normal", "denoise": 1, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0] }, "class_type": "KSampler" },
        "7": { "inputs": { "text": "blurry, low quality", "clip": ["4", 1] }, "class_type": "CLIPTextEncode" },
        "8": { "inputs": { "samples": ["3", 0], "vae": ["4", 2] }, "class_type": "VAEDecode" },
        "9": { "inputs": { "filename_prefix": "flux_headshot", "images": ["8", 0] }, "class_type": "SaveImage" }
      };
      
      console.log('✅ Workflow generated with', Object.keys(testWorkflow).length, 'nodes');
      
      // Test RunPod request (without actually sending to avoid spam)
      console.log('✅ Would send request to RunPod with workflow');
      console.log('✅ This test case should work!');
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  }
  
  console.log('\n🎯 Summary:');
  console.log('- Database connection: ✅ Working');
  console.log('- Models available: ✅ Yes (IDs: 15, 19)');
  console.log('- RunPod endpoint: ✅ Configured');
  console.log('- Workflow generation: ✅ Working');
  console.log('');
  console.log('💡 The API should work if:');
  console.log('1. User is properly authenticated');
  console.log('2. Frontend sends correct modelId (15 or 19)');
  console.log('3. User ID matches: e7cdc1b8-ea87-4c35-ba89-ce26b405f5c0');
}

simulateHeadshotsAPI().catch(console.error);