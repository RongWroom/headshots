# High-end FLUX Dev training container for 4K headshots
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies for high-end training
RUN pip install --no-cache-dir \
    diffusers==0.24.0 \
    transformers==4.36.0 \
    accelerate==0.25.0 \
    peft==0.7.1 \
    datasets==2.15.0 \
    pillow==10.1.0 \
    requests==2.31.0 \
    torch==2.1.0 \
    torchvision==0.16.0 \
    xformers==0.0.22.post7 \
    opencv-python==4.8.1.78 \
    numpy==1.24.3 \
    safetensors==0.4.1 \
    runpod==1.5.1 \
    huggingface-hub==0.19.4 \
    compel==2.0.2

# Create app directory
WORKDIR /app

# Copy training scripts
COPY handler.py /app/
COPY flux_trainer.py /app/
COPY face_processor.py /app/
COPY requirements.txt /app/

# Set environment variables for optimal performance
ENV PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
ENV CUDA_VISIBLE_DEVICES=0

# Start the handler
CMD ["python", "-u", "handler.py"]