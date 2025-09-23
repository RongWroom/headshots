# RunPod Configuration Guide

This application includes optional RunPod integration for custom AI model training. RunPod is not required for the basic functionality of the application.

## Environment Variables

The following environment variables are optional and only needed if you want to use RunPod for training:

```bash
# Optional RunPod Configuration
RUNPOD_TRAINING_ENDPOINT=your_runpod_endpoint_url
RUNPOD_API_KEY=your_runpod_api_key
```

## Configuration Status

- **Not Configured**: If these variables are not set, the RunPod service will be disabled and the health endpoint will return `not-configured` status
- **Configured**: If both variables are set, the service will attempt to connect to your RunPod endpoint

## Health Check

You can check the RunPod service status at:
- `/api/runpod/health` - Basic health status
- `/api/runpod/health?detailed=true` - Detailed health information

## Build Behavior

The application will build successfully whether RunPod is configured or not. The RunPod service uses lazy initialization to avoid build-time errors when environment variables are missing.

## Setting Up RunPod (Optional)

1. Create a RunPod account and set up a serverless endpoint
2. Get your API key from the RunPod dashboard
3. Add the environment variables to your deployment (Vercel, etc.)
4. The service will automatically detect the configuration and enable RunPod features

## Fallback Behavior

When RunPod is not configured, the application will:
- Use Replicate as the primary training service
- Show "not-configured" status in health checks
- Skip RunPod-specific functionality gracefully