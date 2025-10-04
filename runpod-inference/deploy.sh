#!/bin/bash

# Build Docker image
echo "Building Docker image..."
docker build -t your-dockerhub-username/flux-inference:latest .

# Push to Docker Hub
echo "Pushing to Docker Hub..."
docker push your-dockerhub-username/flux-inference:latest

echo "Done! Use this image in RunPod: your-dockerhub-username/flux-inference:latest"