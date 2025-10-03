#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function testRunPodWithWorkflow() {
  console.log('🧪 Testing RunPod with ComfyUI workflow...\n');
  
  const workflow = {
    "4": {
      "inputs": {
        "ckpt_name": "flux1-dev-fp8.safetensors"
      },
      "class_type": "CheckpointLoaderSimple",
      "_meta": {
        "title": "Load Checkpoint"
      }
    },
    "6": {
      "inputs": {
        "text": "professional headshot of a person, studio lighting, high quality",
        "clip": ["4", 1]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP Text Encode (Prompt)"
      }
    },
    "5": {
      "inputs": {
        "width": 1024,
        "height": 1024,
        "batch_size": 1
      },
      "class_type": "EmptyLatentImage",
      "_meta": {
        "title": "Empty Latent Image"
      }
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
      "class_type": "KSampler",
      "_meta": {
        "title": "KSampler"
      }
    },
    "7": {
      "inputs": {
        "text": "blurry, low quality, distorted, bad anatomy, deformed, disfigured, multiple people, crowd",
        "clip": ["4", 1]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP Text Encode (Negative)"
      }
    },
    "8": {
      "inputs": {
        "samples": ["3", 0],
        "vae": ["4", 2]
      },
      "class_type": "VAEDecode",
      "_meta": {
        "title": "VAE Decode"
      }
    },
    "9": {
      "inputs": {
        "filename_prefix": "flux_headshot",
        "images": ["8", 0]
      },
      "class_type": "SaveImage",
      "_meta": {
        "title": "Save Image"
      }
    }
  };

  const payload = {
    input: {
      workflow: workflow
    }
  };

  console.log('Endpoint:', process.env.RUNPOD_INFERENCE_ENDPOINT);
  console.log('API Key:', process.env.RUNPOD_API_KEY ? 'Present' : 'Missing');
  console.log('Workflow nodes:', Object.keys(workflow).length);

  try {
    console.log('\n📤 Sending request to RunPod...');
    
    const response = await fetch(process.env.RUNPOD_INFERENCE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log('📡 Response status:', response.status, response.statusText);
    
    const responseText = await response.text();
    console.log('📋 Raw response:', responseText);
    
    if (!response.ok) {
      console.error('❌ Request failed with status:', response.status);
      console.error('❌ Error details:', responseText);
      
      // Check if it's a specific error we can handle
      if (response.status === 400) {
        console.log('\n💡 This might be a workflow configuration issue');
        console.log('💡 The RunPod endpoint might not support ComfyUI workflows');
        console.log('💡 Or the FLUX model might not be available on this endpoint');
      } else if (response.status === 404) {
        console.log('\n💡 Endpoint not found - check if the RunPod serverless endpoint is active');
      } else if (response.status === 401) {
        console.log('\n💡 Authentication failed - check your RunPod API key');
      }
      
      return;
    }

    try {
      const result = JSON.parse(responseText);
      console.log('✅ Success! RunPod accepted the workflow');
      console.log('📋 Response:', JSON.stringify(result, null, 2));
      
      if (result.id) {
        console.log(`\n🎯 Job ID: ${result.id}`);
        console.log('⏱️  Status:', result.status || 'Unknown');
        console.log('💡 You can check the status in your RunPod console');
      }
    } catch (parseError) {
      console.log('✅ Request successful but response is not JSON:', responseText);
    }

  } catch (error) {
    console.error('❌ Network error:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 This might be a network connectivity issue');
      console.log('💡 Check your internet connection and RunPod service status');
    }
  }
}

testRunPodWithWorkflow().catch(console.error);