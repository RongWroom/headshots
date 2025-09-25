# Optimized FLUX Dev training container with memory and GPU optimizations
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# Install system dependencies with optimizations
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    unzip \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create app directory first
WORKDIR /app

# Copy requirements and install dependencies in optimized order
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt && \
    pip cache purge

# Copy training scripts
COPY optimized_handler.py /app/handler.py
COPY optimized_flux_trainer.py /app/
COPY optimized_face_processor.py /app/
COPY checkpoint_manager.py /app/
COPY memory_optimizer.py /app/

# Pre-download face detection model to avoid runtime downloads
RUN python -c "import cv2; import urllib.request; urllib.request.urlretrieve('https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml', '/app/haarcascade_frontalface_default.xml')"

# Set optimized environment variables for memory and GPU usage
ENV PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:256,garbage_collection_threshold:0.6,expandable_segments:True
ENV CUDA_VISIBLE_DEVICES=0
ENV CUDA_LAUNCH_BLOCKING=0
ENV TORCH_CUDNN_V8_API_ENABLED=1
ENV TOKENIZERS_PARALLELISM=false
ENV HF_HUB_DISABLE_PROGRESS_BARS=1
ENV TRANSFORMERS_VERBOSITY=error
ENV DIFFUSERS_VERBOSITY=error

# Optimize Python for performance
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONHASHSEED=random

# Create directories for checkpoints and cache
RUN mkdir -p /app/checkpoints /app/cache /tmp/training

# Start the optimized handler
CMD ["python", "-u", "handler.py"]