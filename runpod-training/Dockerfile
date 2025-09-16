# High-end FLUX Dev training container for 4K headshots
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install minimal dependencies for working handler
RUN pip install --no-cache-dir \
    pillow \
    requests \
    runpod

# Create app directory
WORKDIR /app

# Copy training scripts
COPY simple_handler.py /app/handler.py
COPY requirements.txt /app/

# Set environment variables for optimal performance
ENV PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
ENV CUDA_VISIBLE_DEVICES=0

# Start the simple handler
CMD ["python", "-u", "handler.py"]