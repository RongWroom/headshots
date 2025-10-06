# 🚀 START HERE - Deploy to RunPod in 5 Steps

**You have a RunPod account? Perfect! Follow these 5 steps.**

---

## Step 1: Build Docker Image (5 minutes)

```bash
# Navigate to the project
cd runpod-comfyui-headshots

# Build the Docker image
docker build -t YOUR-DOCKERHUB-USERNAME/comfyui-headshots:latest .
```

**Replace `YOUR-DOCKERHUB-USERNAME` with your actual Docker Hub username.**

If you don't have Docker Hub:
1. Go to https://hub.docker.com/
2. Create free account
3. Come back and run the command above

---

## Step 2: Push to Docker Hub (2 minutes)

```bash
# Login to Docker Hub
docker login

# Push the image
docker push YOUR-DOCKERHUB-USERNAME/comfyui-headshots:latest
```

This uploads your image so RunPod can access it.

---

## Step 3: Create RunPod Endpoint (3 minutes)

1. Go to https://www.runpod.io/console/serverless
2. Click **"+ New Endpoint"**
3. Fill in:
   ```
   Name: comfyui-headshots
   Docker Image: YOUR-DOCKERHUB-USERNAME/comfyui-headshots:latest
   GPU Type: RTX 4090 (or A40)
   Min Workers: 0
   Max Workers: 3
   Container Disk: 20 GB
   ```
4. Click **"Deploy"**

---

## Step 4: Wait for First Cold Start (10-15 minutes)

The first time your endpoint starts:
- ComfyUI installs
- Models download (~5GB)
- Custom nodes initialize

**This only happens once!** After that, it's fast.

You can monitor progress:
1. Go to your endpoint in RunPod
2. Click **"Logs"**
3. Watch the installation progress

---

## Step 5: Test It! (2 minutes)

### 5.1 Get Your Credentials
In RunPod, copy:
- **Endpoint ID** (looks like: `abc123def456`)
- **API Key** (click "API Keys" in sidebar)

### 5.2 Test with cURL

Replace `YOUR-ENDPOINT-ID` and `YOUR-API-KEY`:

```bash
curl -X POST https://api.runpod.ai/v2/YOUR-ENDPOINT-ID/runsync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR-API-KEY" \
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
      "webhook_url": "https://webhook.site/your-unique-url",
      "job_id": "test-001"
    }
  }'
```

### 5.3 Expected Response

If successful, you'll get:
```json
{
  "status": "success",
  "images": ["base64_image_1", "base64_image_2", ...],
  "metadata": {
    "num_images": 4,
    "num_reference_images": 5
  }
}
```

---

## ✅ You're Done!

Your headshot generator is now live on RunPod!

### What You Can Do Now:

1. **Connect to Your Frontend**
   - Use the endpoint URL in your app
   - Send image URLs, get back headshots

2. **Monitor Usage**
   - Check RunPod dashboard for costs
   - View logs for any errors

3. **Scale Up**
   - Increase max workers for more traffic
   - Upgrade GPU for faster generation

---

## 💰 Costs

**Per Generation:**
- RTX 4090: ~$0.02-0.04 per generation
- Takes 2-3 minutes per job

**Serverless = No Idle Costs**
- Only pay when generating
- Scales to zero automatically

---

## 🐛 Troubleshooting

### "Docker build failed"
```bash
# Make sure you're in the right directory
cd runpod-comfyui-headshots

# Try building again
docker build -t YOUR-USERNAME/comfyui-headshots:latest .
```

### "Push failed"
```bash
# Login first
docker login

# Then push
docker push YOUR-USERNAME/comfyui-headshots:latest
```

### "Endpoint not responding"
- Wait 10-15 minutes for first cold start
- Check logs in RunPod dashboard
- Models are downloading in background

### "Out of memory"
- Upgrade to RTX 4090 or A40
- These have more VRAM for large models

---

## 📞 Need Help?

1. Check `RUNPOD_DEPLOYMENT_GUIDE.md` for detailed instructions
2. Check RunPod logs for error messages
3. Join RunPod Discord: https://discord.gg/runpod

---

## 🎯 Next Steps

Once it's working:
1. ✅ Test with your own photos
2. ✅ Connect to your frontend app
3. ⚠️ Add NSFW filtering (before production)
4. 📋 Set up monitoring
5. 📋 Configure webhooks for your app

---

**Ready? Let's deploy! 🚀**

Start with Step 1 above and work your way down.
