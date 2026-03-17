# ── Vanguard NIDS – Backend ────────────────────────────────────────────────
# Base image: Python 3.11 slim (avoids 3.13 compatibility issues with scapy)
FROM python:3.11-slim

# System packages required for Scapy packet capture and ML libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpcap-dev \
    libpcap0.8 \
    tcpdump \
    iproute2 \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /backend

# ── Install Python dependencies ────────────────────────────────────────────
COPY requirements.docker.txt .

# Install CPU-only PyTorch first (avoids pulling the multi-GB CUDA wheel)
RUN pip install --no-cache-dir \
    torch \
    --extra-index-url https://download.pytorch.org/whl/cpu

# Install the rest of the dependencies
RUN pip install --no-cache-dir -r requirements.docker.txt

# ── Copy application source ────────────────────────────────────────────────
COPY . .

# Ensure the data / model directories exist inside the image
RUN mkdir -p data/raw data/processed data/datasets models/supervised \
             models/unsupervised models/hybrid /data

EXPOSE 8000

# ── Startup ────────────────────────────────────────────────────────────────
# network_host is NOT used here so compose networking stays intact.
# NET_ADMIN + NET_RAW capabilities (set in docker-compose.yml) give
# Scapy the permissions it needs for live packet capture.
CMD ["python", "-m", "uvicorn", "app.main:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--log-level", "info"]
