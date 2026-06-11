"""
profiles_manager.py - Gestion des profils utilisateurs via user_profiles.json
Remplace Flask-Login + SQLAlchemy : stockage JSON local
"""

import os
import json
import logging
import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

PROFILES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "user_profiles.json")


# ==================
# HELPERS I/O
# ==================

def _load_profiles() -> dict:
    """Lit le fichier JSON des profils."""
    try:
        if not os.path.exists(PROFILES_PATH):
            _save_profiles({"profiles": {}})
        with open(PROFILES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"❌ Erreur lecture profils: {e}")
        return {"profiles": {}}


def _save_profiles(data: dict) -> None:
    """Écrit le fichier JSON des profils."""
    try:
        Path(PROFILES_PATH).parent.mkdir(parents=True, exist_ok=True)
        with open(PROFILES_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    except Exception as e:
        logger.error(f"❌ Erreur écriture profils: {e}")


def _now() -> str:
    return datetime.datetime.utcnow().isoformat()


# ==================
# PROFILS
# ==================

def get_all_profiles() -> list:
    """Retourne la liste de tous les profils."""
    data = _load_profiles()
    profiles = []
    for pid, p in data.get("profiles", {}).items():
        profiles.append({"id": pid, "username": p["username"], "created_at": p.get("created_at", "")})
    return profiles


def get_profile(username: str) -> dict | None:
    """Retourne un profil par son username."""
    data = _load_profiles()
    for pid, p in data.get("profiles", {}).items():
        if p["username"].lower() == username.lower():
            return {"id": pid, **p}
    return None


def create_profile(username: str) -> dict:
    """Crée un nouveau profil (sans mot de passe - app locale)."""
    data = _load_profiles()
    # Vérifier doublon
    for pid, p in data.get("profiles", {}).items():
        if p["username"].lower() == username.lower():
            raise ValueError(f"Le profil '{username}' existe déjà.")

    new_id = str(len(data.get("profiles", {})) + 1)
    data.setdefault("profiles", {})[new_id] = {
        "username": username,
        "created_at": _now(),
        "history": [],    # [{anime_id, season, episode, time_position, completed, last_watched}]
        "favorites": [],  # [anime_id, ...]
    }
    _save_profiles(data)
    logger.info(f"✅ Profil créé: {username}")
    return {"id": new_id, **data["profiles"][new_id]}


def delete_profile(username: str) -> bool:
    """Supprime un profil."""
    data = _load_profiles()
    for pid, p in list(data.get("profiles", {}).items()):
        if p["username"].lower() == username.lower():
            del data["profiles"][pid]
            _save_profiles(data)
            return True
    return False


# ==================
# PROGRESSION
# ==================

def save_progress(username: str, anime_id: int, season: int, episode: int,
                  time_position: float, completed: bool) -> None:
    """Sauvegarde / met à jour la progression d'un épisode."""
    data = _load_profiles()
    profile = None
    for pid, p in data.get("profiles", {}).items():
        if p["username"].lower() == username.lower():
            profile = p
            break

    if not profile:
        raise ValueError(f"Profil '{username}' introuvable.")

    history = profile.setdefault("history", [])
    existing = next(
        (h for h in history
         if h["anime_id"] == anime_id and h["season"] == season and h["episode"] == episode),
        None
    )

    if existing:
        existing["time_position"] = time_position
        existing["completed"] = completed
        existing["last_watched"] = _now()
    else:
        history.append({
            "anime_id": anime_id,
            "season": season,
            "episode": episode,
            "time_position": time_position,
            "completed": completed,
            "last_watched": _now(),
        })

    # Garder seulement les 200 dernières entrées
    profile["history"] = sorted(history, key=lambda x: x["last_watched"], reverse=True)[:200]
    _save_profiles(data)


def get_progress(username: str, limit: int = 20) -> list:
    """Retourne l'historique de visionnage (les plus récents)."""
    profile = get_profile(username)
    if not profile:
        return []
    history = profile.get("history", [])
    return sorted(history, key=lambda x: x.get("last_watched", ""), reverse=True)[:limit]


def get_episode_progress(username: str, anime_id: int) -> dict:
    """Retourne la progression de tous les épisodes d'un anime (dict S_E → progress)."""
    profile = get_profile(username)
    if not profile:
        return {}
    result = {}
    for h in profile.get("history", []):
        if h["anime_id"] == anime_id:
            key = f"{h['season']}_{h['episode']}"
            result[key] = {
                "time_position": h["time_position"],
                "completed": h["completed"],
                "last_watched": h["last_watched"],
            }
    return result


def remove_from_history(username: str, anime_id: int) -> int:
    """Supprime toutes les entrées d'un anime de l'historique. Retourne le nombre supprimé."""
    data = _load_profiles()
    for pid, p in data.get("profiles", {}).items():
        if p["username"].lower() == username.lower():
            before = len(p.get("history", []))
            p["history"] = [h for h in p.get("history", []) if h["anime_id"] != anime_id]
            after = len(p["history"])
            _save_profiles(data)
            return before - after
    return 0


# ==================
# FAVORIS
# ==================

def toggle_favorite(username: str, anime_id: int) -> str:
    """Toggle favori. Retourne 'added' ou 'removed'."""
    data = _load_profiles()
    for pid, p in data.get("profiles", {}).items():
        if p["username"].lower() == username.lower():
            favs = p.setdefault("favorites", [])
            if anime_id in favs:
                favs.remove(anime_id)
                action = "removed"
            else:
                favs.append(anime_id)
                action = "added"
            _save_profiles(data)
            return action
    raise ValueError(f"Profil '{username}' introuvable.")


def get_favorites(username: str) -> list:
    """Retourne la liste des anime_id favoris."""
    profile = get_profile(username)
    if not profile:
        return []
    return profile.get("favorites", [])


def is_favorite(username: str, anime_id: int) -> bool:
    """Vérifie si un anime est en favori."""
    return anime_id in get_favorites(username)
