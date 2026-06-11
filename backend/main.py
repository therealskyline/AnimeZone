"""
main.py - Point d'entrée FastAPI AnimeZone
Lance le serveur backend asynchrone sur http://localhost:8000
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from data_manager import load_anime_data, get_all_genres
from api_routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ==================
# LIFESPAN (startup)
# ==================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Précharge les caches au démarrage."""
    logger.info("🚀 AnimeZone FastAPI - démarrage...")
    animes = load_anime_data()
    genres = get_all_genres()
    logger.info(f"✅ Cache prêt : {len(animes)} animes, {len(genres)} genres")
    yield
    logger.info("🛑 Arrêt du serveur")


# ==================
# APP
# ==================

app = FastAPI(
    title="AnimeZone API",
    version="2.0.0",
    description="Backend FastAPI pour AnimeZone - streaming local",
    lifespan=lifespan,
)

# CORS : autoriser le frontend React (Vite dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes API
app.include_router(router)


# ==================
# POINT D'ENTRÉE
# ==================

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    print("\n" + "=" * 60)
    print("🚀 AnimeZone FastAPI v2.0")
    print(f"📍 http://localhost:{port}")
    print("=" * 60)
    print("✅ Proxy vidéo async (Vidmoly / SendVid / Sibnet / Generic)")
    print("✅ Cache JSON O(1) - pas de base de données SQL")
    print("✅ Profils locaux via user_profiles.json")
    print("✅ CORS configuré pour React/Vite frontend")
    print("=" * 60 + "\n")

    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
