# ComfyUI Headshot Generation Docker Image for RunPod
# Base image with ComfyUI pre-installed
FROM runpod/comfyui:latest

# Set working directory
WORKDIR /workspace

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    runpod \
    requests \
    pillow \
    numpy \
    opencv-python-headless

# Create directories for custom nodes and models
RUN mkdir -p /workspace/ComfyUI/custom_nodes \
    && mkdir -p /workspace/models/loras \
    && mkdir -p /workspace/workflows

# Install RMBG (Background Removal) custom node
RUN cd /workspace/ComfyUI/custom_nodes && \
    git clone https://github.com/Jcd1230/rembg-comfyui-node.git && \
    cd rembg-comfyui-node && \
    pip install -r requirements.txt

# Install CLIP Interrogator custom node
RUN cd /workspace/ComfyUI/custom_nodes && \
    git clone https://github.com/ltdrdata/ComfyUI-Inspire-Pack.git && \
    cd ComfyUI-Inspire-Pack && \
    pip install -r requirements.txt

# Install ComfyUI Manager (helpful for managing nodes)
RUN cd /workspace/ComfyUI/custom_nodes && \
    git clone https://github.com/ltdrdata/ComfyUI-Manager.git

# Install additional useful custom nodes
RUN cd /workspace/ComfyUI/custom_nodes && \
    git clone https://github.com/Kosinkadink/ComfyUI-Advanced-ControlNet.git && \
    git clone https://github.com/cubiq/ComfyUI_essentials.git && \
    cd ComfyUI_essentials && \
    pip install -r requirements.txt

# Download DanDan LoRA model
# Note: Replace this URL with the actual DanDan LoRA URL from your training
ARG DANDAN_LORA_URL
RUN if [ -n "$DANDAN_LORA_URL" ]; then \
    wget -O /workspace/models/loras/dandan-actor.safetensors "$DANDAN_LORA_URL"; \
    fi

# Copy handler script
COPY handler.py /workspace/handler.py
COPY workflow.json /workspace/workflows/headshot_generation.json

# Set environment variables
ENV COMFYUI_PATH=/workspace/ComfyUI
ENV PYTHONPATH="${PYTHONPATH}:/workspace/ComfyUI"

# Expose port for ComfyUI
EXPOSE 8188

# Set the entrypoint to run the handler
CMD ["python", "-u", "/workspace/handler.py"]
