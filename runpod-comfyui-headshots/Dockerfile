FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install ComfyUI
WORKDIR /workspace
RUN git clone https://github.com/comfyanonymous/ComfyUI.git
WORKDIR /workspace/ComfyUI

# Install ComfyUI dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install additional dependencies for our custom nodes
RUN pip install --no-cache-dir \
    runpod==1.5.0 \
    transformers>=4.30.0 \
    open_clip_torch>=2.20.0 \
    rembg>=2.0.50 \
    pillow>=10.0.0 \
    requests>=2.31.0 \
    torch>=2.0.0 \
    torchvision>=0.15.0 \
    onnxruntime>=1.15.0

# Create directories for custom nodes
RUN mkdir -p /workspace/ComfyUI/custom_nodes/headshot_generation

# Copy our custom nodes
COPY custom_nodes/*.py /workspace/ComfyUI/custom_nodes/headshot_generation/
COPY custom_nodes/__init__.py /workspace/ComfyUI/custom_nodes/headshot_generation/
COPY custom_nodes/README.md /workspace/ComfyUI/custom_nodes/headshot_generation/

# Create model directories
RUN mkdir -p /workspace/ComfyUI/models/checkpoints \
    /workspace/ComfyUI/models/loras \
    /workspace/ComfyUI/models/clip \
    /workspace/ComfyUI/models/rembg \
    /workspace/ComfyUI/workflows

# Copy workflow and handler
COPY workflow.json /workspace/workflows/headshot_generation.json
COPY handler.py /workspace/handler.py

# Download RMBG model
RUN mkdir -p /root/.u2net && \
    wget -O /root/.u2net/u2net.onnx \
    https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx

# Set working directory
WORKDIR /workspace

# Create startup script with proper line endings
COPY <<EOF /workspace/start.sh
#!/bin/bash
set -e

# Start ComfyUI in background
echo "Starting ComfyUI..."
cd /workspace/ComfyUI
python main.py --listen 0.0.0.0 --port 8188 2>&1 | tee /tmp/comfyui.log &
COMFYUI_PID=\$!
echo "ComfyUI PID: \$COMFYUI_PID"

# Wait for ComfyUI to be ready
echo "Waiting for ComfyUI to start..."
for i in {1..60}; do
  # Check if ComfyUI process is still running
  if ! kill -0 \$COMFYUI_PID 2>/dev/null; then
    echo "ERROR: ComfyUI process died!"
    echo "Last 50 lines of ComfyUI log:"
    tail -50 /tmp/comfyui.log
    exit 1
  fi
  
  # Check if ComfyUI is responding
  if curl -s http://localhost:8188/ > /dev/null 2>&1; then
    echo "ComfyUI is ready!"
    break
  fi
  
  if [ \$i -eq 60 ]; then
    echo "ERROR: ComfyUI failed to start after 120 seconds"
    echo "Last 50 lines of ComfyUI log:"
    tail -50 /tmp/comfyui.log
    exit 1
  fi
  
  echo "Waiting... (\$i/60)"
  sleep 2
done

# Start handler
echo "Starting handler..."
cd /workspace
python -u handler.py
EOF

RUN chmod +x /workspace/start.sh

# Expose ComfyUI port
EXPOSE 8188

# Start ComfyUI directly (simpler approach)
CMD cd /workspace/ComfyUI && python main.py --listen 0.0.0.0 --port 8188
