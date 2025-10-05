# ComfyUI Headshot Generator - Deployment Guide

This guide walks you through deploying the ComfyUI headshot generation system to RunPod.

## Prerequisites

Before you begin, ensure you have:

- [ ] Docker installed and running on your local machine
- [ ] Docker Hub account (or other container registry)
- [ ] RunPod account with billing configured
- [ ] DanDan LoRA model URL (from your training)
- [ ] Webhook secret key generated

## Step 1: Prepare the LoRA Model

1. Train or obtain the DanDan-Actor LoRA model
2. Upload it to accessible storage (Vercel Blob, S3, etc.)
3. Get the public URL for the model file
4. Save this URL - you'll need it for building and deployment

Example URL format:
```
https://replicate.delivery/xezq/.../trained_model.tar
```

## Step 2: Build the Docker Image

### Option A: Build Locally and Push

```bash
# Navigate to the directory
cd runpod-comfyui-headshots

# Build with LoRA included
./build-and-deploy.sh \
  --push \
  --registry YOUR_DOCKERHUB_USERNAME \
  --lora-url YOUR_LORA_URL

# Example:
./build-and-deploy.sh \
  --push \
  --registry johndoe \
  --lora-url https://storage.example.com/dandan-lora.safetensors
```

### Option B: Build Without LoRA (Set via Environment Variable)

```bash
# Build and push without LoRA
./build-and-deploy.sh --push --registry YOUR_DOCKERHUB_USERNAME

# You'll set DANDAN_LORA_URL as environment variable in RunPod later
```

### Verify the Build

```bash
# Check image was created
docker images | grep comfyui-headshot-generator

# Test locally (optional)
docker run -p 8188:8188 YOUR_DOCKERHUB_USERNAME/comfyui-headshot-generator:latest
```

## Step 3: Create RunPod Endpoint

1. **Login to RunPod**
   - Go to https://www.runpod.io/console/serverless
   - Navigate to "Serverless" section

2. **Create New Endpoint**
   - Click "New Endpoint"
   - Fill in the details:

   ```
   Name: comfyui-headshot-generator
   Docker Image: YOUR_DOCKERHUB_USERNAME/comfyui-headshot-generator:latest
   ```

3. **Configure GPU Settings**
   ```
   GPU Type: NVIDIA A40
   Min Workers: 0
   Max Workers: 3
   Idle Timeout: 300 seconds
   Execution Timeout: 600 seconds
   Container Disk: 20 GB
   ```

4. **Set Environment Variables**
   
   Click "Environment Variables" and add:
   
   ```
   WEBHOOK_SECRET=your-secure-random-string-here
   DANDAN_LORA_URL=https://your-storage.com/dandan-lora.safetensors
   COMFYUI_PATH=/workspace/ComfyUI
   PYTHONPATH=/workspace/ComfyUI
   ```

   Generate a secure webhook secret:
   ```bash
   openssl rand -hex 32
   ```

5. **Review and Create**
   - Review all settings
   - Click "Create Endpoint"
   - Wait for endpoint to initialize (2-3 minutes)

## Step 4: Get Endpoint Details

After creation, note down:

1. **Endpoint ID**: Found in the endpoint URL
   ```
   https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/run
   ```

2. **API Key**: Generate in RunPod settings
   - Go to Settings → API Keys
   - Create new API key
   - Save it securely

## Step 5: Test the Endpoint

### Test with cURL

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
      "webhook_url": "https://webhook.site/your-test-url",
      "job_id": "test-123"
    }
  }'
```

### Expected Response

```json
{
  "id": "request-id",
  "status": "IN_QUEUE"
}
```

### Check Status

```bash
curl https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/status/REQUEST_ID \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Step 6: Configure Your Application

Update your application's environment variables:

```env
# .env.local or .env.production
RUNPOD_ENDPOINT_ID=your-endpoint-id
RUNPOD_API_KEY=your-api-key
RUNPOD_WEBHOOK_SECRET=your-webhook-secret
```

## Step 7: Monitor and Optimize

### Monitor Costs

1. Go to RunPod Dashboard → Billing
2. Check daily/monthly usage
3. Set up billing alerts

### Monitor Performance

1. Check endpoint metrics in RunPod dashboard
2. Monitor average execution time
3. Track success/failure rates

### Optimize Settings

Based on usage patterns:

**Low Traffic (<10 requests/day):**
```
Min Workers: 0
Max Workers: 1
Idle Timeout: 300s
```

**Medium Traffic (10-100 requests/day):**
```
Min Workers: 0
Max Workers: 3
Idle Timeout: 300s
```

**High Traffic (>100 requests/day):**
```
Min Workers: 1
Max Workers: 5
Idle Timeout: 600s
```

## Troubleshooting

### Issue: Endpoint Not Starting

**Symptoms**: Endpoint stuck in "Initializing"

**Solutions**:
1. Check Docker image exists and is accessible
2. Verify image name is correct
3. Check RunPod logs for errors
4. Try rebuilding with `--no-cache`

### Issue: Out of Memory

**Symptoms**: Endpoint crashes during generation

**Solutions**:
1. Reduce image resolution in workflow
2. Use GPU with more VRAM (A100)
3. Reduce batch size
4. Optimize ComfyUI workflow

### Issue: Slow Generation

**Symptoms**: Takes >3 minutes per generation

**Solutions**:
1. Use faster GPU (A100 instead of A40)
2. Optimize workflow (remove unnecessary nodes)
3. Reduce output resolution
4. Check network latency for image downloads

### Issue: LoRA Not Loading

**Symptoms**: Generated images don't match DanDan style

**Solutions**:
1. Verify `DANDAN_LORA_URL` is set correctly
2. Check LoRA file is accessible (test URL in browser)
3. Verify LoRA file format is `.safetensors`
4. Check RunPod logs for download errors

### Issue: Webhook Not Received

**Symptoms**: No progress updates in your application

**Solutions**:
1. Verify webhook URL is publicly accessible
2. Check webhook signature validation
3. Test webhook URL with webhook.site
4. Check application logs for webhook errors

## Updating the Deployment

### Update Docker Image

```bash
# Make changes to Dockerfile or handler.py
# Rebuild and push
./build-and-deploy.sh --push --registry YOUR_USERNAME

# In RunPod dashboard:
# 1. Go to your endpoint
# 2. Click "Edit"
# 3. Update Docker image tag or trigger rebuild
# 4. Save changes
```

### Update Environment Variables

1. Go to RunPod endpoint settings
2. Click "Environment Variables"
3. Update values
4. Save changes
5. Endpoint will restart automatically

### Update Workflow

```bash
# Update workflow.json
# Rebuild and push image
./build-and-deploy.sh --push --registry YOUR_USERNAME

# Or mount workflow as volume (advanced)
```

## Cost Optimization Tips

1. **Use Spot Instances**: 50-70% cheaper (if available)
2. **Optimize Idle Timeout**: Balance between cost and responsiveness
3. **Batch Requests**: Process multiple users together when possible
4. **Cache Results**: Store and reuse similar generations
5. **Monitor Usage**: Set up alerts for unexpected spikes

## Security Best Practices

1. **Rotate API Keys**: Change keys every 90 days
2. **Use Webhook Signatures**: Validate all webhook requests
3. **Limit Rate**: Implement rate limiting in your application
4. **Monitor Logs**: Watch for suspicious activity
5. **Secure Environment Variables**: Never commit secrets to git

## Next Steps

After successful deployment:

1. ✅ Test with real user photos
2. ✅ Monitor first 10 generations closely
3. ✅ Gather user feedback on quality
4. ✅ Optimize workflow based on results
5. ✅ Set up monitoring and alerts
6. ✅ Document any issues and solutions

## Support Resources

- **RunPod Documentation**: https://docs.runpod.io
- **RunPod Discord**: https://discord.gg/runpod
- **ComfyUI Documentation**: https://github.com/comfyanonymous/ComfyUI
- **Project Issues**: [Your repository issues page]

## Checklist

Before going to production:

- [ ] Docker image built and pushed successfully
- [ ] RunPod endpoint created and running
- [ ] Environment variables configured
- [ ] Test generation completed successfully
- [ ] Webhook integration tested
- [ ] Cost monitoring set up
- [ ] Error handling tested
- [ ] Documentation updated
- [ ] Team trained on monitoring
- [ ] Backup plan in place

---

**Deployment Date**: _____________

**Deployed By**: _____________

**Endpoint ID**: _____________

**Notes**: _____________
