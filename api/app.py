"""FastAPI application: entry point per il servizio web.

Carica le ricette al startup, espone l'API su /api
e serve il frontend statico su /.
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from api.routes import router
from api.service import RecipeService


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Carica le ricette una volta al startup e le rende disponibili
    a tutti gli endpoint tramite app.state.
    """
    service = RecipeService()
    service.load()
    app.state.recipe_service = service
    yield


app = FastAPI(
    title="Ricette - Piano Settimanale",
    description="Generatore di piani settimanali bilanciati",
    lifespan=lifespan,
)

app.include_router(router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve il frontend come file statici (index.html su /)
# NOTA: va montato DOPO le route, altrimenti cattura tutto
frontend_dir = Path(__file__).parent.parent / "frontend"
app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
