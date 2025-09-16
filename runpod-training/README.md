# High-End FLUX Dev Headshot Training

This RunPod container provides professional-grade FLUX Dev LoRA training optimized for exact likeness preservation and 4K headshot generation.

## 🎯 Features

- **Exact Likeness**: Advanced face processing preserves eye color, hair texture, face shape
- **4K Capable**: Trained models can generate up to 4096x4096 resolution
- **Professional Quality**: High LoRA rank (64) for detailed feature preservation
- **Robust Training**: 1500 steps with advanced optimization techniques
- **Face-Focused**: Automatic face detection, cropping, and enhancement

## 🚀 Quick Deployment

### Step 1: Build and Push Container

```bash
# Update Docker username in build script
nano build-and-deploy.sh  # Change DOCKER_USERNAME

# Build and push
./build-and-deploy.sh
```

### Step 2: Deploy to RunPod

1. Go to [RunPod Console](https://www.runpod.io/console/serverless)
2. Create new endpoint with your Docker image
3. Recommended settings:
   - **GPU**: A100 (40GB) or RTX 4090 (24GB)
   - **Memory**: 24GB+
   - **Container Disk**: 50GB+
   - **Max Workers**: 1-3
   - **Idle Timeout**: 5 seconds
   - **Max Execution Time**: 3600 seconds

### Step 3: Update Environment Variables

```bash
# Add to your .env.local
RUNPOD_API_KEY=your_runpod_api_key
RUNPOD_TRAINING_ENDPOINT=https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/runsync
```

## 📋 API Usage

Your website will send requests like this:

```typescript
const response = await fetch('/api/runpod/train', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageUrls: [
      'https://your-site.com/user-photo-1.jpg',
      'https://your-site.com/user-photo-2.jpg',
      // ... 8-20 high-quality photos
    ],
    modelName: 'john-headshots',
    packSlug: 'corporate-headshots'
  })
});
```

## 🎨 Training Process

1. **Image Download**: Downloads user photos from URLs
2. **Face Processing**: Detects faces, validates quality, enhances images
3. **LoRA Training**: Trains FLUX Dev with advanced settings:
   - 1500 training steps
   - LoRA rank 64 for high detail
   - Mixed precision (bf16)
   - 8-bit AdamW optimizer
4. **Model Upload**: Saves trained model to cloud storage

## 💰 Cost Estimate

- **A100 (40GB)**: ~$2-4 per training (20-30 minutes)
- **RTX 4090 (24GB)**: ~$1-2 per training (30-45 minutes)

## 🧪 Local Testing

Test before deploying:

```bash
python test_local.py
```

## 📊 Training Requirements

### Minimum Requirements
- **Images**: 8-20 high-quality photos
- **Resolution**: 512x512 minimum per image
- **Quality**: Well-lit, clear faces
- **Variety**: Different angles and expressions

### Optimal Results
- **Images**: 12-15 photos
- **Resolution**: 1024x1024+ per image
- **Lighting**: Professional or natural lighting
- **Background**: Variety of backgrounds
- **Expression**: Mix of serious and natural expressions

## 🔧 Advanced Configuration

The training uses these optimized settings:

```python
training_config = {
    "resolution": 1024,           # Base training resolution
    "max_train_steps": 1500,      # More steps = better likeness
    "lora_rank": 64,              # Higher rank = more detail
    "learning_rate": 1e-4,        # Optimal for face training
    "mixed_precision": "bf16",    # Memory efficient
    "gradient_accumulation_steps": 4,
    "use_8bit_adam": True,        # Memory optimization
    "enable_xformers": True       # Speed optimization
}
```

## 🎯 Expected Results

After training, your model will be capable of:

- **4K Generation**: Up to 4096x4096 resolution
- **Exact Likeness**: Preserves facial features, eye color, hair
- **Professional Quality**: Studio-grade headshot generation
- **Style Flexibility**: Corporate, actor, creative styles
- **Fast Generation**: 30-60 seconds per batch

## 🔍 Troubleshooting

### Common Issues

1. **"Insufficient images"**: Upload at least 8 clear photos
2. **"No face detected"**: Ensure faces are clearly visible
3. **"Image too blurry"**: Use sharp, well-focused photos
4. **"Poor lighting"**: Avoid very dark or overexposed images

### Quality Tips

- Use photos taken with good cameras (not low-res selfies)
- Include variety in angles (front, 3/4, profile)
- Mix of expressions (serious, slight smile)
- Different lighting conditions
- Various backgrounds

## 📞 Support

If you encounter issues:

1. Check RunPod logs in the console
2. Verify all environment variables are set
3. Test with the local test script first
4. Ensure images meet quality requirements

---

**Ready to generate professional 4K headshots with exact likeness preservation!** 🎯