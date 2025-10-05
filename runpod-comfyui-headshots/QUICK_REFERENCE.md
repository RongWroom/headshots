# RunPod Deployment - Quick Reference Card

## 🚀 Deploy in 4 Commands

```bash
# 1. Validate
./validate-deployment-readiness.sh

# 2. Build & Push
./build-and-deploy.sh --push --registry USERNAME --lora-url URL

# 3. Create endpoint in RunPod dashboard (manual step)

# 4. Test
./test-endpoint.sh --endpoint-id ID --api-key KEY
```

---

## 📋 RunPod Endpoint Settings

```
GPU: NVIDIA A40
Workers: 0 min, 3 max
Timeout: 300s idle, 600s execution
Disk: 20 GB
```

---

## 🔐 Environment Variables

```bash
WEBHOOK_SECRET=$(openssl rand -hex 32)
DANDAN_LORA_URL=your-lora-url
COMFYUI_PATH=/workspace/ComfyUI
PYTHONPATH=/workspace/ComfyUI
```

---

## 💰 Cost Estimates

| Volume | Cost/Month |
|--------|------------|
| 100    | $2         |
| 1,000  | $21        |
| 10,000 | $210       |

---

## 📚 Documentation

- **Quick Start:** `QUICKSTART.md`
- **Full Guide:** `DEPLOYMENT_GUIDE.md`
- **Checklist:** `DEPLOYMENT_CHECKLIST.md`
- **Troubleshooting:** `DEPLOYMENT_GUIDE.md` (section 7)

---

## 🧪 Test Commands

```bash
# Health check
curl https://api.runpod.ai/v2/ENDPOINT_ID/health \
  -H "Authorization: Bearer API_KEY"

# Submit job
curl -X POST https://api.runpod.ai/v2/ENDPOINT_ID/run \
  -H "Authorization: Bearer API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {...}}'

# Check status
curl https://api.runpod.ai/v2/ENDPOINT_ID/status/REQUEST_ID \
  -H "Authorization: Bearer API_KEY"
```

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Endpoint not starting | Check Docker image exists |
| Out of memory | Use A100 GPU or reduce resolution |
| Slow generation | Optimize workflow or use A100 |
| LoRA not loading | Verify DANDAN_LORA_URL env var |
| Webhook not received | Check URL is publicly accessible |

---

## 📞 Support

- **RunPod:** https://docs.runpod.io
- **Discord:** https://discord.gg/runpod
- **ComfyUI:** https://github.com/comfyanonymous/ComfyUI

---

## ✅ Checklist

- [ ] Docker installed and running
- [ ] Docker Hub account
- [ ] RunPod account with billing
- [ ] DanDan LoRA URL
- [ ] Build and push image
- [ ] Create endpoint
- [ ] Set environment variables
- [ ] Test endpoint
- [ ] Configure application
- [ ] Monitor first generations

