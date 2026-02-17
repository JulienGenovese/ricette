FROM python:3.14-slim

WORKDIR /app

# Installa uv per gestione dipendenze veloce
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Utente non-root per sicurezza
RUN useradd --create-home appuser

# Copia file dipendenze e versione Python (layer cacheable)
COPY pyproject.toml uv.lock .python-version ./

# Installa dipendenze
RUN uv sync --frozen --no-dev

# Copia codice applicazione
COPY src/ src/
COPY api/ api/
COPY frontend/ frontend/
COPY dati/ dati/

# Rendi tutto leggibile da appuser
RUN chown -R appuser:appuser /app

USER appuser

# Attiva il venv direttamente
ENV PATH="/app/.venv/bin:$PATH"

# Cloud Run inietta PORT; default 8080
ENV PORT=8080
EXPOSE 8080

CMD uvicorn api.app:app --host 0.0.0.0 --port "$PORT"
