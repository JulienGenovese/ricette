"""FastAPI application: entry point per il servizio web.

Carica le ricette al startup, espone l'API su /api
e serve il frontend statico su /.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger

from api.firebase import get_firestore_client, init_firebase
from api.routes import router
from api.service import RecipeService
from api.user_routes import user_router
from api.user_service import UserService


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Carica le ricette una volta al startup e le rende disponibili
    a tutti gli endpoint tramite app.state.
    """
    # Firebase & Firestore (optional – app works without it for non-auth endpoints)
    try:
        init_firebase()
        db = get_firestore_client()
        app.state.user_service = UserService(db)
    except Exception as e:
        logger.warning("Firebase not available: {}. Auth endpoints will fail.", e)
        app.state.user_service = None

    # Recipe service (unchanged)
    service = RecipeService()
    service.load()
    app.state.recipe_service = service
    yield


app = FastAPI(
    title="Ricette - Piano Settimanale",
    description="Generatore di piani settimanali bilanciati",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(router, prefix="/api")
app.include_router(user_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve il frontend come file statici (index.html su /)
# NOTA: va montato DOPO le route, altrimenti cattura tutto
frontend_dir = Path(__file__).parent.parent / "frontend"
app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
