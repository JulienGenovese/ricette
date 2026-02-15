FROM python:3.14-slim

WORKDIR /app

# Installa uv per gestione dipendenze veloce
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copia file dipendenze (layer cacheable)
COPY pyproject.toml uv.lock ./

# Installa dipendenze
RUN uv sync --frozen --no-dev

# Copia codice applicazione
COPY src/ src/
COPY api/ api/
COPY frontend/ frontend/
COPY dati/ dati/

# Cloud Run usa PORT=8080 di default
ENV PORT=8080
EXPOSE 8080

CMD ["uv", "run", "uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8080"]
