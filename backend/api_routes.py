"""
api_routes.py - Toutes les routes FastAPI
Anime, Profils, Progression, Favoris, Proxy Vidéo
"""

import logging
import asyncio
from typing import Optional
from urllib.parse import urljoin

from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

from data_manager import (
    load_anime_data,
    get_anime_by_id,
    get_all_genres,
    search_anime,
    get_featured_anime,
)
from profiles_manager import (
    get_all_profiles,
    get_profile,
    create_profile,
    delete_profile,
    save_progress,
    get_progress,
    get_episode_progress,
    remove_from_history,
    toggle_favorite,
    get_favorites,
    is_favorite,
)
from proxy_logic import (
    resolve_video,
    get_http_client,
    get_hls_segments,
    parse_video_url,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Store en mémoire pour les clés vidéo (remplace app.config Flask)
_VIDEO_STORE: dict = {}


# ==================
# SCHEMAS Pydantic
# ==================

class ProfileCreate(BaseModel):
    username: str

class ProgressSave(BaseModel):
    username: str
    anime_id: int
    season_number: int
    episode_number: int
    time_position: float
    completed: bool = False

class FavoriteToggle(BaseModel):
    username: str
    anime_id: int

class RemoveWatching(BaseModel):
    username: str
    anime_id: int

class VideoInfoRequest(BaseModel):
    url: str


# ==================
# PROFILS
# ==================

@router.get("/api/profiles")
async def list_profiles():
    """Liste tous les profils."""
    return {"success": True, "profiles": get_all_profiles()}


@router.post("/api/profiles")
async def api_create_profile(body: ProfileCreate):
    """Crée un nouveau profil."""
    try:
        profile = create_profile(body.username)
        return {"success": True, "profile": profile}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/api/profiles/{username}")
async def api_delete_profile(username: str):
    """Supprime un profil."""
    ok = delete_profile(username)
    if not ok:
        raise HTTPException(status_code=404, detail="Profil introuvable")
    return {"success": True}


# ==================
# ANIME DATA
# ==================

@router.get("/api/anime")
async def api_anime_list(
    query: str = Query(""),
    genre: str = Query(""),
    limit: int = Query(100),
):
    """Liste / recherche d'animes."""
    results = search_anime(query=query, genre=genre, limit=limit)
    return {"success": True, "animes": results, "total": len(results)}


@router.get("/api/anime/featured")
async def api_featured():
    """Animes mis en avant pour la page d'accueil."""
    return {"success": True, "animes": get_featured_anime(12)}


@router.get("/api/anime/genres")
async def api_genres():
    return {"success": True, "genres": get_all_genres()}


@router.get("/api/anime/{anime_id}")
async def api_anime_detail(anime_id: int, username: Optional[str] = Query(None)):
    """Détails d'un anime + progression + favori si profil fourni."""
    anime = get_anime_by_id(anime_id)
    if not anime:
        raise HTTPException(status_code=404, detail="Anime introuvable")

    # Trier les saisons (régulières → films → Kai)
    if anime.get("seasons"):
        regular, kai, films = [], [], []
        for s in anime["seasons"]:
            if s.get("season_number") == 99:
                films.append(s)
            elif "Kai" in s.get("name", ""):
                kai.append(s)
            else:
                regular.append(s)
        regular.sort(key=lambda s: s.get("season_number", 0))
        kai.sort(key=lambda s: s.get("season_number", 0))
        anime = {**anime, "seasons": regular + films + kai}

    episode_progress = {}
    fav = False

    if username:
        episode_progress = get_episode_progress(username, anime_id)
        fav = is_favorite(username, anime_id)

    return {
        "success": True,
        "anime": anime,
        "is_favorite": fav,
        "episode_progress": episode_progress,
    }


# ==================
# PROGRESSION
# ==================

@router.get("/api/progress/{username}")
async def api_get_progress(username: str, limit: int = Query(20)):
    """Historique de visionnage enrichi avec les données anime."""
    history = get_progress(username, limit)
    result = []
    for h in history:
        anime = get_anime_by_id(h["anime_id"])
        if anime:
            season = next(
                (s for s in anime.get("seasons", []) if s.get("season_number") == h["season"]),
                None,
            )
            episode = None
            if season:
                episode = next(
                    (e for e in season.get("episodes", []) if e.get("episode_number") == h["episode"]),
                    None,
                )
            result.append({"progress": h, "anime": anime, "season": season, "episode": episode})
    return {"success": True, "history": result}


@router.post("/api/progress/save")
async def api_save_progress(body: ProgressSave):
    try:
        save_progress(
            body.username,
            body.anime_id,
            body.season_number,
            body.episode_number,
            body.time_position,
            body.completed,
        )
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/api/progress/remove")
async def api_remove_from_watching(body: RemoveWatching):
    count = remove_from_history(body.username, body.anime_id)
    return {"success": True, "deleted": count}


# ==================
# FAVORIS
# ==================

@router.get("/api/favorites/{username}")
async def api_get_favorites(username: str):
    """Retourne les animes favoris enrichis."""
    fav_ids = get_favorites(username)
    animes = [get_anime_by_id(aid) for aid in fav_ids if get_anime_by_id(aid)]
    return {"success": True, "favorites": animes}


@router.post("/api/favorites/toggle")
async def api_toggle_favorite(body: FavoriteToggle):
    try:
        action = toggle_favorite(body.username, body.anime_id)
        return {"success": True, "action": action}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ==================
# PROXY VIDÉO
# ==================

@router.post("/api/video/info")
async def api_video_info(body: VideoInfoRequest):
    """
    Résout une URL source vers une clé de streaming.
    Retourne player_type, video_key, et metadata.
    """
    url = body.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL manquante")

    player_type_raw, video_id = parse_video_url(url)
    video_key = f"{player_type_raw}_{video_id}"

    logger.info(f"🎬 Résolution vidéo: {player_type_raw} → {video_id[:30] if len(video_id) > 30 else video_id}")

    result = await resolve_video(url)

    if "error" in result:
        return {
            "success": False,
            "error": result["error"],
            "use_iframe": result.get("use_iframe", False),
        }

    # Stocker les données de streaming pour la clé
    _VIDEO_STORE[video_key] = result

    response = {
        "success": True,
        "player_type": result["player_type"],
        "video_key": video_key,
    }

    if result["player_type"] == "hls":
        response["segments"] = result.get("segments", 0)
    elif result["player_type"] in ("sendvid", "mp4"):
        response["direct_mp4"] = True

    return response


@router.get("/api/video/stream/{video_key:path}")
async def api_video_stream(video_key: str):
    """Stream une vidéo via proxy (HLS manifest ou MP4 direct)."""
    data = _VIDEO_STORE.get(video_key)
    if not data:
        raise HTTPException(status_code=404, detail="Clé vidéo introuvable")

    player_type = data["player_type"]

    # ---- HLS : retourner le manifest avec segments proxifiés ----
    if player_type == "hls":
        playlist = data["playlist"]
        base_url = data["video_url"].rsplit("/", 1)[0] + "/"

        manifest = "#EXTM3U\n#EXT-X-VERSION:3\n"
        max_dur = max((s.duration or 0) for s in playlist.segments)
        manifest += f"#EXT-X-TARGETDURATION:{int(max_dur) + 1}\n"
        manifest += "#EXT-X-MEDIA-SEQUENCE:0\n\n"

        for i, seg in enumerate(playlist.segments):
            seg_url = seg.uri if seg.uri.startswith("http") else urljoin(base_url, seg.uri)
            # Stocker l'URL du segment
            _VIDEO_STORE[f"seg_{video_key}_{i}"] = seg_url
            manifest += f"#EXTINF:{seg.duration},\n/api/video/segment/{video_key}/{i}\n"

        manifest += "#EXT-X-ENDLIST\n"
        return Response(content=manifest, media_type="application/vnd.apple.mpegurl")

    # ---- SENDVID / MP4 : proxy streaming ----
    elif player_type in ("sendvid", "mp4"):
        video_url = data["video_url"]
        mime = data.get("mime_type", "video/mp4")

        async def stream_generator():
            client = get_http_client()
            async with client.stream("GET", video_url, timeout=60.0) as resp:
                async for chunk in resp.aiter_bytes(chunk_size=8192):
                    yield chunk

        return StreamingResponse(
            stream_generator(),
            media_type=mime,
            headers={"Accept-Ranges": "bytes"},
        )

    raise HTTPException(status_code=400, detail="Type non supporté")


@router.get("/api/video/segment/{video_key:path}/{segment_num:int}")
async def api_video_segment(video_key: str, segment_num: int):
    """Proxy un segment HLS individuel."""
    seg_url = _VIDEO_STORE.get(f"seg_{video_key}_{segment_num}")
    if not seg_url:
        raise HTTPException(status_code=404, detail="Segment introuvable")

    async def seg_generator():
        client = get_http_client()
        async with client.stream("GET", seg_url, timeout=30.0) as resp:
            async for chunk in resp.aiter_bytes(chunk_size=8192):
                yield chunk

    return StreamingResponse(seg_generator(), media_type="video/mp2t")
