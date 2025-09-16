# RunPod Background Removal Service

This project provides a RunPod serverless function for automatic background removal using Meta's Segment Anything Model (SAM).

## Local Testing

Before deploying to RunPod, you can test your handler locally to ensure everything works correctly.

### Setup

1. **Create a virtual environment:**
   ```bash
   python3 -m venv venv
   ```

2. **Activate the virtual environment:**
   ```bash
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

### Running Tests

Run the local test script to verify your handler works correctly:

```bash
python test_local.py
```

This will:
- ✅ Test handler import and model loading
- ✅ Process a sample image from the internet
- ✅ Verify the response format
- ✅ Test error handling for invalid inputs

### Expected Output

When successful, you should see:
```
🚀 Starting local RunPod handler tests...

Test 1: Processing sample image
Testing handler with image URL: https://picsum.photos/512/512
Downloading image from URL...
Image downloaded and converted.
Generating masks...
Generated 6 masks.
Creating transparent background image...
Processing complete.

--- Handler Result ---
{
  "status": "success",
  "message": "Background removed.",
  "mask_count": 6
}
✓ Handler completed successfully!
✓ Generated 6 masks

==================================================
🎉 Local testing completed successfully!
Your RunPod endpoint should work properly when deployed.
```

## Docker Build

Build the Docker image for deployment:

```bash
docker build --no-cache -t your-app-name .
```

## Deployment

1. Push your Docker image to a registry (Docker Hub, etc.)
2. Create a new endpoint in RunPod
3. Configure your endpoint with the Docker image
4. Test the endpoint with sample requests

## API Usage

Send a POST request to your RunPod endpoint with:

```json
{
  "input": {
    "signed_url": "https://example.com/your-image.jpg"
  }
}
```

### Response Format

**Success:**
```json
{
  "status": "success",
  "message": "Background removed.",
  "mask_count": 6
}
```

**Error:**
```json
{
  "error": "Error message here"
}
```

## Dependencies

- **torch**: PyTorch for machine learning
- **torchvision**: Computer vision library
- **segment-anything**: Meta's SAM model
- **opencv-python**: Computer vision operations
- **runpod**: RunPod serverless framework
- **Pillow**: Image processing
- **numpy**: Numerical computing
- **requests**: HTTP requests

## Model

The service uses SAM (Segment Anything Model) with the `vit_b` checkpoint, which is automatically downloaded on first run.
