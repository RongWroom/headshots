# Quick Start Guide

Get your ComfyUI headshot generator running on RunPod in 15 minutes.

## Prerequisites

- Docker installed
- Docker Hub account
- RunPod account with billing
- DanDan LoRA URL

## 5-Step Deployment

### 1. Build Image (5 min)

```bash
cd runpod-comfyui-headshots

./build-and-deploy.sh \
  --push \
  --registry YOUR_DOCKERHUB_USERNAME \
  --lora-url YOUR_LORA_URL
```

### 2. Create RunPod Endpoint (3 min)

1. Go to https://www.runpod.io/console/serverless
2. Click "New Endpoint"
3. Configure:
   - Image: `YOUR_DOCKERHUB_USERNAME/comfyui-headshot-generator:latest`
   - GPU: NVIDIA A40
   - Workers: 0 min, 3 max
   - Timeout: 300s

### 3. Set Environment Variables (1 min)

```
WEBHOOK_SECRET=<generate with: openssl rand -hex 32>
DANDAN_LORA_URL=<your-lora-url>
COMFYUI_PATH=/workspace/ComfyUI
```

### 4. Test Endpoint (3 min)

```bash
curl -X POST https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/run \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "reference_images": [
        "https://example.com/photo1.jpg",
        "https://example.com/photo2.jpg",
        "https://example.com/photo3.jpg",
        "https://example.com/photo4.jpg",
        "https://example.com/photo5.jpg"
      ],
      "num_outputs": 4,
      "style_intensity": 0.8,
      "job_id": "test-123"
    }
  }'
```

### 5. Configure Your App (3 min)

Add to `.env.local`:

```env
RUNPOD_ENDPOINT_ID=your-endpoint-id
RUNPOD_API_KEY=your-api-key
RUNPOD_WEBHOOK_SECRET=your-webhook-secret
```

## Done! 🎉

Your ComfyUI headshot generator is now live on RunPod.

## Next Steps

- [ ] Complete task 2.3: Create ComfyUI workflow JSON
- [ ] Test with real user photos
- [ ] Monitor costs and performance
- [ ] Optimize based on usage

## Need Help?

- **Full Guide**: See `DEPLOYMENT_GUIDE.md`
- **Documentation**: See `README.md`
- **Troubleshooting**: Check logs in RunPod dashboard

## Cost Estimate

- **Per Generation**: ~$0.02 (90 seconds on A40)
- **100 Generations/Month**: ~$2
- **1,000 Generations/Month**: ~$20

## Support

- RunPod Docs: https://docs.runpod.io
- ComfyUI Docs: https://github.com/comfyanonymous/ComfyUI
