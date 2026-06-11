"""
data_manager.py - Gestion du cache JSON anime (O(1) lookup)
Remplace SQLAlchemy : lecture depuis anime.json statique
"""

import os
import json
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)

# ==================
# CACHE EN MÉMOIRE
# ==================

_ANIME_CACHE: list = []
_ANIME_DICT: dict = {}
_GENRES_CACHE: list = []

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "anime.json")


def load_anime_data() -> list:
    """Charge et cache le JSON en mémoire - appelé UNE SEULE FOIS au démarrage."""
    global _ANIME_CACHE, _ANIME_DICT

    if _ANIME_CACHE:
        return _ANIME_CACHE

    try:
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
            animes = raw.get("anime", raw) if isinstance(raw, dict) else raw

        for anime in animes:
            if "anime_id" not in anime:
                anime["anime_id"] = anime.get("id", 0)
            if "has_episodes" not in anime:
                anime["has_episodes"] = len(anime.get("seasons", [])) > 0

        _ANIME_CACHE = animes
        _ANIME_DICT = {}
        for a in animes:
            _ANIME_DICT[int(a.get("anime_id", 0))] = a
            _ANIME_DICT[int(a.get("id", 0))] = a

        logger.info(f"✅ Cache chargé : {len(animes)} animes")
        return _ANIME_CACHE

    except Exception as e:
        logger.error(f"❌ Erreur chargement anime.json: {e}")
        return []


def get_anime_by_id(anime_id: int) -> dict | None:
    """Recherche O(1) par ID."""
    if not _ANIME_DICT:
        load_anime_data()
    return _ANIME_DICT.get(int(anime_id))


def get_all_genres() -> list:
    """Retourne la liste triée des genres uniques."""
    global _GENRES_CACHE
    if _GENRES_CACHE:
        return _GENRES_CACHE
    data = load_anime_data()
    genres = set()
    for anime in data:
        for g in anime.get("genres", []):
            genres.add(g.lower())
    _GENRES_CACHE = sorted(list(genres))
    return _GENRES_CACHE


def search_anime(query: str = "", genre: str = "", limit: int = 100) -> list:
    """Filtre les animes par titre / genre."""
    data = load_anime_data()
    results = []
    for anime in data:
        if not anime.get("has_episodes"):
            continue
        title_match = query.lower() in anime.get("title", "").lower() if query else True
        genre_match = (
            genre.lower() in [g.lower() for g in anime.get("genres", [])]
            if genre
            else True
        )
        if title_match and genre_match:
            results.append(anime)
    return results[:limit]


def get_featured_anime(limit: int = 12) -> list:
    """Retourne les animes mis en avant (les plus récents ayant des épisodes)."""
    data = load_anime_data()
    featured = [a for a in data if a.get("has_episodes")]
    return featured[-limit:]
