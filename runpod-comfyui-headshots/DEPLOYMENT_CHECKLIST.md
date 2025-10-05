# RunPod Deployment Checklist

This checklist ensures all steps for deploying the ComfyUI headshot generator to RunPod are completed successfully.

## Pre-Deployment Checklist

### Prerequisites
- [ ] Docker installed and running locally
- [ ] Docker Hub account created (or other container registry)
- [ ] RunPod account created at https://www.runpod.io
- [ ] RunPod billing configured with payment method
- [ ] DanDan LoRA model trained and accessible via URL
- [ ] Webhook secret generated (or will be auto-generated)

### Required Information
Gather the following before starting:

```
Docker Registry Username: ___________________
RunPod API Key: ___________________
DanDan LoRA URL: ___________________
Webhook Secret (optional): ___________________
```

## Deployment Steps

### Step 1: Build and Push Docker Image

**Estimated Time:** 10-15 minutes

- [ ] Navigate to `runpod-comfyui-headshots` directory
- [ ] Run build script:
  ```bash
  ./build-and-deploy.sh \
    --push \
    --registry YOUR_DOCKERHUB_USERNAME \
    --lora-url YOUR_LORA_URL
  ```
- [ ] Verify image built successfully (check for green checkmark)
- [ ] Verify image pushed to Docker Hub
- [ ] Note the full image name: `YOUR_USERNAME/comfyui-headshot-generator:latest`

**Troubleshooting:**
- If build fails, check Docker is running
- If push fails, run `docker login` first
- If LoRA download fails, verify URL is accessible

### Step 2: Create RunPod Endpoint

**Estimated Time:** 5 minutes

- [ ] Go to https://www.runpod.io/console/serverless
- [ ] Click "New Endpoint" button
- [ ] Fill in endpoint configuration:

#### Basic Settings
```
Name: comfyui-headshot-generator
Docker Image: YOUR_USERNAME/comfyui-headshot-generator:latest
```

#### GPU Configuration
```
GPU Type: NVIDIA A40
Min Workers: 0
Max Workers: 3
Idle Timeout: 300 seconds
Execution Timeout: 600 seconds
```

#### Container Settings
```
Container Disk: 20 GB
```

#### Environment Variables
Click "Add Environment Variable" for each:
```
WEBHOOK_SECRET=<your-generated-secret>
DANDAN_LORA_URL=<your-lora-url>
COMFYUI_PATH=/workspace/ComfyUI
PYTHONPATH=/workspace/ComfyUI
```

- [ ] Review all settings
- [ ] Click "Create Endpoint"
- [ ] Wait for endpoint to initialize (2-3 minutes)
- [ ] Note the Endpoint ID from the URL or dashboard

### Step 3: Get API Credentials

**Estimated Time:** 2 minutes

- [ ] In RunPod dashboard, go to Settings → API Keys
- [ ] Create new API key if you don't have one
- [ ] Copy and save the API key securely
- [ ] Note the Endpoint ID from your endpoint page

**Save these values:**
```
Endpoint ID: ___________________
API Key: ___________________
```

### Step 4: Test the Endpoint

**Estimated Time:** 5-10 minutes (includes cold start)

#### Option A: Using Test Script (Recommended)

- [ ] Run the test script:
  ```bash
  ./test-endpoint.sh \
    --endpoint-id YOUR_ENDPOINT_ID \
    --api-key YOUR_API_KEY
  ```
- [ ] Wait for test to complete (may take 1-2 minutes for cold start)
- [ ] Verify all tests pass with green checkmarks
- [ ] Review generated images in the response

#### Option B: Manual cURL Test

- [ ] Run this command (replace placeholders):
  ```bash
  curl -X POST https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/run \
    -H "Authorization: Bearer YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "input": {
        "reference_images": [
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
          "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400",
          "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400",
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400"
        ],
        "num_outputs": 4,
        "style_intensity": 0.8,
        "job_id": "test-123"
      }
    }'
  ```
- [ ] Note the request ID from response
- [ ] Poll for status:
  ```bash
  curl https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/status/REQUEST_ID \
    -H "Authorization: Bearer YOUR_API_KEY"
  ```
- [ ] Verify job completes successfully

**Expected Results:**
- Initial response: `{"id": "...", "status": "IN_QUEUE"}`
- After processing: `{"status": "COMPLETED", "output": {...}}`

### Step 5: Configure Application

**Estimated Time:** 2 minutes

- [ ] Open your application's `.env.local` or `.env.production` file
- [ ] Add these environment variables:
  ```env
  RUNPOD_ENDPOINT_ID=your-endpoint-id
  RUNPOD_API_KEY=your-api-key
  RUNPOD_WEBHOOK_SECRET=your-webhook-secret
  ```
- [ ] Save the file
- [ ] Restart your application if running

### Step 6: Integration Testing

**Estimated Time:** 10 minutes

- [ ] Test generation from your application UI
- [ ] Upload 5-10 test photos
- [ ] Verify progress updates appear
- [ ] Verify generated headshots are returned
- [ ] Verify images are stored correctly
- [ ] Test error handling (invalid inputs, etc.)

### Step 7: Monitoring Setup

**Estimated Time:** 5 minutes

- [ ] Set up cost alerts in RunPod dashboard
  - Go to Billing → Alerts
  - Set daily/monthly spending limits
- [ ] Bookmark RunPod endpoint dashboard for monitoring
- [ ] Set up application logging for generation requests
- [ ] Document monitoring procedures for team

## Post-Deployment Checklist

### Verification
- [ ] Endpoint is running and accessible
- [ ] Test generation completed successfully
- [ ] Application integrated and working
- [ ] Webhook callbacks functioning
- [ ] Error handling tested
- [ ] Cost monitoring configured

### Documentation
- [ ] Endpoint ID and API key saved securely
- [ ] Webhook secret saved securely
- [ ] Deployment date recorded
- [ ] Team notified of deployment
- [ ] Runbook updated with endpoint details

### Security
- [ ] API keys stored in environment variables (not in code)
- [ ] Webhook secret validated in application
- [ ] Rate limiting configured
- [ ] Access logs reviewed

## Rollback Plan

If deployment fails or issues arise:

1. **Immediate Actions:**
   - [ ] Stop sending traffic to RunPod endpoint
   - [ ] Switch to backup generation method (if available)
   - [ ] Notify team of issues

2. **Investigation:**
   - [ ] Check RunPod endpoint logs
   - [ ] Review application error logs
   - [ ] Test endpoint manually with cURL
   - [ ] Verify environment variables are correct

3. **Resolution:**
   - [ ] Fix identified issues
   - [ ] Rebuild and redeploy if needed
   - [ ] Re-test thoroughly
   - [ ] Resume traffic gradually

## Cost Monitoring

### Expected Costs
- **Per Generation:** ~$0.02 (90 seconds on A40)
- **100 Generations/Month:** ~$2
- **1,000 Generations/Month:** ~$20

### Monitoring Actions
- [ ] Check daily costs in RunPod dashboard
- [ ] Review usage patterns weekly
- [ ] Optimize settings based on usage
- [ ] Set up alerts for cost spikes

## Optimization Checklist

After initial deployment, optimize based on usage:

### Performance
- [ ] Monitor average generation time
- [ ] Adjust GPU type if needed (A100 for faster, A40 for cost)
- [ ] Optimize workflow if generation is slow
- [ ] Review and adjust timeout settings

### Cost
- [ ] Review idle timeout (increase if cold starts are frequent)
- [ ] Adjust max_workers based on peak load
- [ ] Consider reserved instances for consistent load
- [ ] Implement caching where possible

### Quality
- [ ] Review generated image quality
- [ ] Gather user feedback
- [ ] Adjust style_intensity if needed
- [ ] Fine-tune LoRA if necessary

## Support Resources

- **RunPod Documentation:** https://docs.runpod.io
- **RunPod Discord:** https://discord.gg/runpod
- **ComfyUI Documentation:** https://github.com/comfyanonymous/ComfyUI
- **Project Documentation:** See README.md and DEPLOYMENT_GUIDE.md

## Deployment Sign-Off

**Deployment Completed By:** ___________________

**Date:** ___________________

**Endpoint ID:** ___________________

**Initial Test Results:** ___________________

**Notes:** ___________________

---

## Quick Reference

### Useful Commands

**Check endpoint status:**
```bash
curl https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**View recent jobs:**
```bash
curl https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/requests \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Cancel a job:**
```bash
curl -X POST https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/cancel/REQUEST_ID \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Environment Variables Reference

```env
# RunPod Configuration
RUNPOD_ENDPOINT_ID=your-endpoint-id
RUNPOD_API_KEY=your-api-key
RUNPOD_WEBHOOK_SECRET=your-webhook-secret

# Optional: Override defaults
RUNPOD_TIMEOUT=600
RUNPOD_MAX_RETRIES=3
```

### Troubleshooting Quick Links

- **Endpoint not starting:** Check Docker image exists and is accessible
- **Out of memory:** Reduce image resolution or use A100 GPU
- **Slow generation:** Check network latency, optimize workflow
- **LoRA not loading:** Verify DANDAN_LORA_URL environment variable
- **Webhook not received:** Check webhook URL is publicly accessible

