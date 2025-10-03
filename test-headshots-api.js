#!/usr/bin/env node

/**
 * Test script to debug the headshots API issue
 */

require('dotenv').config({ path: '.env.local' });

async function testHeadshotsAPI() {
  console.log('🧪 Testing headshots API locally...\n');
  
  // Test the ComfyUI workflow generation first
  const { createSimpleFluxWorkflow } = require('./lib/comfyui-workflows.ts');
  
  console.log('✅ Testing ComfyUI workflow generation...');
  try {
    const workflow = createSimpleFluxWorkflow(
      'professional headshot of a person',
      1024, 1024, 28, 5.0, -1
    );
    console.log('✅ Workflow generated successfully');
    console.log('Workflow keys:', Object.keys(workflow));
  } catch (error) {
    console.error('❌ Workflow generation failed:', error.message);
    return;
  }
  
  // Test RunPod endpoint directly
  console.log('\n📡 Testing RunPod endpoint directly...');
  
  const testWorkflow = {
    "4": {
      "inputs": {
        "ckpt_name": "flux1-dev-fp8.safetensors"
      },
      "class_type": "CheckpointLoaderSimple"
    },
    "6": {
      "inputs": {
        "text": "professional headshot of a person, studio lighting",
        "clip": ["4", 1]
      },
      "class_type": "CLIPTextEncode"
    },
    "5": {
      "inputs": {
        "width": 1024,
        "height": 1024,
        "batch_size": 1
      },
      "class_type": "EmptyLatentImage"
    },
    "3": {
      "inputs": {
        "seed": -1,
        "steps": 28,
        "cfg": 5.0,
        "sampler_name": "euler",
        "scheduler": "normal",
        "denoise": 1,
        "model": ["4", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["5", 0]
      },
      "class_type": "KSampler"
    },
    "7": {
      "inputs": {
        "text": "blurry, low quality",
        "clip": ["4", 1]
      },
      "class_type": "CLIPTextEncode"
    },
    "8": {
      "inputs": {
        "samples": ["3", 0],
        "vae": ["4", 2]
      },
      "class_type": "VAEDecode"
    },
    "9": {
      "inputs": {
        "filename_prefix": "test_headshot",
        "images": ["8", 0]
      },
      "class_type": "SaveImage"
    }
  };

  const payload = {
    input: {
      workflow: testWorkflow
    }
  };

  console.log('Endpoint:', process.env.RUNPOD_INFERENCE_ENDPOINT);
  console.log('Payload keys:', Object.keys(payload.input));

  try {
    const response = await fetch(process.env.RUNPOD_INFERENCE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log('Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ RunPod error response:', errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ RunPod response:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ RunPod request failed:', error.message);
  }
}

testHeadshotsAPI().catch(console.error);