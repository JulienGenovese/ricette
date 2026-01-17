FROM ghcr.io/astral-sh/uv:python3.13-slim

RUN apt-get update && \
    apt-get install -y git && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
