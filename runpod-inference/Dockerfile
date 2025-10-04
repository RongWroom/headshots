FROM runpod/pytorch:2.1.1-py3.10-cuda11.8.0-devel-ubuntu22.04

# Install dependencies with compatible versions
RUN pip install --no-cache-dir \
    diffusers==0.24.0 \
    transformers==4.36.0 \
    accelerate==0.25.0 \
    safetensors==0.4.1 \
    xformers==0.0.23 \
    runpod==1.5.1

# Create app directory
WORKDIR /app

# Copy handler
COPY handler.py /app/
COPY requirements.txt /app/

# Install additional requirements
RUN pip install -r requirements.txt

# Set the handler
CMD ["python", "-u", "handler.py"]