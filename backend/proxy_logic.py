"""
proxy_logic.py - Système de proxy vidéo hybride (async FastAPI)
Porte intégralement la logique Flask : Vidmoly / SendVid / Sibnet / Generic
"""

import re
import logging
import asyncio
import httpx
import m3u8
from urllib.parse import urljoin
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Session HTTP asynchrone partagée (créée une seule fois)
_http_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
            timeout=20.0,
        )
    return _http_client


# ==================
# PARSING URL
# ==================

def parse_video_url(url: str) -> Tuple[str, str]:
    """Détecte le type de lecteur et extrait l'ID vidéo."""
    if not url:
        return "generic", url

    url_clean = url.strip().lower()

    # SENDVID
    if "sendvid" in url_clean:
        m = re.search(r"sendvid\.[a-z]+/embed/([a-zA-Z0-9]+)", url, re.IGNORECASE)
        if m:
            return "sendvid", m.group(1)
        m = re.search(r"sendvid\.[a-z]+/([a-zA-Z0-9]+)", url, re.IGNORECASE)
        if m:
            return "sendvid", m.group(1)

    # VIDMOLY
    if "vidmoly" in url_clean:
        m = re.search(r"vidmoly\.[a-z]+/embed-([a-zA-Z0-9]+)\.html", url, re.IGNORECASE)
        if m:
            return "vidmoly", m.group(1)
        m = re.search(r"vidmoly\.[a-z]+/([a-zA-Z0-9]+)", url, re.IGNORECASE)
        if m:
            return "vidmoly", m.group(1)

    # SIBNET
    if "sibnet" in url_clean:
        m = re.search(r"sibnet\.[a-z]+/video/(\d+)", url, re.IGNORECASE)
        if m:
            return "sibnet", m.group(1)
        m = re.search(r"videoid=(\d+)", url, re.IGNORECASE)
        if m:
            return "sibnet", m.group(1)

    return "generic", url


# ==================
# EXTRACTEURS ASYNC
# ==================

async def extract_vidmoly_m3u8(embed_url: str) -> Optional[str]:
    """Extrait l'URL M3U8 depuis une page Vidmoly."""
    try:
        client = get_http_client()
        resp = await client.get(embed_url)
        html = resp.text

        patterns = [
            r'sources\s*:\s*\[\s*{\s*file\s*:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
            r'file\s*:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
        ]
        for pattern in patterns:
            m = re.search(pattern, html, re.IGNORECASE)
            if m:
                return m.group(1)
        return None
    except Exception as e:
        logger.error(f"❌ Vidmoly M3U8: {e}")
        return None


async def extract_sendvid_video(embed_url: str) -> Optional[str]:
    """Extrait l'URL MP4 depuis une page SendVid."""
    try:
        client = get_http_client()
        resp = await client.get(embed_url)
        html = resp.text

        patterns = [
            r'<source[^>]*src=["\']([^"\']+\.mp4[^"\']*)["\']',
            r'file\s*:\s*["\']([^"\']+\.(mp4|webm)[^"\']*)["\']',
        ]
        for pattern in patterns:
            m = re.search(pattern, html, re.IGNORECASE)
            if m:
                url = m.group(1)
                return url if url.startswith("http") else urljoin("https://sendvid.com", url)
        return None
    except Exception as e:
        logger.error(f"❌ SendVid: {e}")
        return None


async def extract_sibnet_video(video_id: str) -> Tuple[Optional[str], Optional[str]]:
    """Extrait l'URL vidéo depuis Sibnet (retourne type, url)."""
    try:
        embed_url = f"https://video.sibnet.ru/shell.php?videoid={video_id}"
        client = get_http_client()
        resp = await client.get(embed_url)
        html = resp.text

        m = re.search(r'["\']([^"\']+\.m3u8[^"\']*)["\']', html, re.IGNORECASE)
        if m:
            return "m3u8", m.group(1)

        m = re.search(r'["\']([^"\']+\.mp4[^"\']*)["\']', html, re.IGNORECASE)
        if m:
            return "mp4", m.group(1)

        return None, None
    except Exception as e:
        logger.error(f"❌ Sibnet: {e}")
        return None, None


async def try_extract_all_methods(embed_url: str) -> Tuple[Optional[str], Optional[str]]:
    """Méthode générique : cherche M3U8, MP4, WEBM dans n'importe quelle page."""
    try:
        client = get_http_client()
        resp = await client.get(embed_url)
        html = resp.text
        base_url = embed_url.rsplit("/", 1)[0] + "/"

        # M3U8
        for pattern in [
            r'sources\s*:\s*\[\s*{\s*file\s*:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
            r'file\s*:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
            r'<source[^>]*src=["\']([^"\']+\.m3u8[^"\']*)["\']',
            r'src=["\']([^"\']+\.m3u8[^"\']*)["\']',
            r'url\s*:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
            r'hls\s*:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
        ]:
            m = re.search(pattern, html, re.IGNORECASE)
            if m:
                u = m.group(1)
                if not u.startswith("http"):
                    u = urljoin(base_url, u)
                return "hls", u

        # MP4
        for pattern in [
            r'<source[^>]*src=["\']([^"\']+\.mp4[^"\']*)["\']',
            r'src=["\']([^"\']+\.mp4[^"\']*)["\']',
            r'file\s*:\s*["\']([^"\']+\.mp4[^"\']*)["\']',
            r'url\s*:\s*["\']([^"\']+\.mp4[^"\']*)["\']',
        ]:
            m = re.search(pattern, html, re.IGNORECASE)
            if m:
                u = m.group(1)
                if not u.startswith("http"):
                    u = urljoin(base_url, u)
                return "mp4", u

        # WEBM
        for pattern in [
            r'<source[^>]*src=["\']([^"\']+\.webm[^"\']*)["\']',
            r'file\s*:\s*["\']([^"\']+\.webm[^"\']*)["\']',
        ]:
            m = re.search(pattern, html, re.IGNORECASE)
            if m:
                u = m.group(1)
                if not u.startswith("http"):
                    u = urljoin(base_url, u)
                return "webm", u

        return None, None
    except Exception as e:
        logger.error(f"❌ Generic extract: {e}")
        return None, None


async def get_hls_segments(master_url: str):
    """Récupère le manifest HLS et retourne (playlist_url, playlist_object)."""
    try:
        client = get_http_client()
        resp = await client.get(master_url)
        master = m3u8.loads(resp.text)

        if master.segments:
            return master_url, master

        if master.playlists:
            base_url = master_url.rsplit("/", 1)[0] + "/"
            playlist_url = urljoin(base_url, master.playlists[-1].uri)
            resp2 = await client.get(playlist_url)
            playlist = m3u8.loads(resp2.text)
            return playlist_url, playlist

        return None, None
    except Exception as e:
        logger.error(f"❌ HLS segments: {e}")
        return None, None


# ==================
# ORCHESTRATEUR PRINCIPAL
# ==================

async def resolve_video(url: str) -> dict:
    """
    Résout une URL source en info de streaming.
    Retourne un dict avec : player_type, video_url, video_type, segments (optionnel), playlist (optionnel)
    """
    player_type, video_id = parse_video_url(url)

    # ---- SENDVID ----
    if player_type == "sendvid":
        embed_url = f"https://sendvid.com/embed/{video_id}"
        video_url = await extract_sendvid_video(embed_url)

        if not video_url:
            vtype, video_url = await try_extract_all_methods(embed_url)
            if not video_url:
                return {"error": "Vidéo SendVid introuvable"}
        else:
            vtype = "mp4"

        return {"player_type": "sendvid", "video_url": video_url, "video_type": vtype}

    # ---- VIDMOLY ----
    elif player_type == "vidmoly":
        embed_url = f"https://vidmoly.net/embed-{video_id}.html"
        m3u8_url = await extract_vidmoly_m3u8(embed_url)

        if not m3u8_url:
            vtype, video_url = await try_extract_all_methods(embed_url)
            if not video_url:
                return {"error": "Vidéo Vidmoly introuvable"}
        else:
            vtype = "hls"
            video_url = m3u8_url

        if vtype == "hls":
            playlist_url, playlist = await get_hls_segments(video_url)
            if not playlist or not playlist.segments:
                return {"error": "Segments HLS introuvables"}
            return {
                "player_type": "hls",
                "video_url": playlist_url,
                "video_type": "hls",
                "playlist": playlist,
                "segments": len(playlist.segments),
            }
        else:
            return {"player_type": "mp4", "video_url": video_url, "video_type": vtype}

    # ---- SIBNET ----
    elif player_type == "sibnet":
        vtype, video_url = await extract_sibnet_video(video_id)

        if not video_url:
            embed_url = f"https://video.sibnet.ru/shell.php?videoid={video_id}"
            vtype, video_url = await try_extract_all_methods(embed_url)
            if not video_url:
                return {"error": "Vidéo Sibnet introuvable"}

        if vtype in ("hls", "m3u8"):
            playlist_url, playlist = await get_hls_segments(video_url)
            if not playlist or not playlist.segments:
                return {"error": "Segments HLS introuvables"}
            return {
                "player_type": "hls",
                "video_url": playlist_url,
                "video_type": "hls",
                "playlist": playlist,
                "segments": len(playlist.segments),
            }
        else:
            return {"player_type": "mp4", "video_url": video_url, "video_type": vtype}

    # ---- GENERIC ----
    else:
        vtype, video_url = await try_extract_all_methods(url)
        if not video_url:
            return {"error": "Source introuvable", "use_iframe": True}

        if vtype in ("hls", "m3u8"):
            playlist_url, playlist = await get_hls_segments(video_url)
            if not playlist or not playlist.segments:
                return {"error": "Segments HLS introuvables"}
            return {
                "player_type": "hls",
                "video_url": playlist_url,
                "video_type": "hls",
                "playlist": playlist,
                "segments": len(playlist.segments),
            }
        else:
            return {
                "player_type": "mp4",
                "video_url": video_url,
                "video_type": vtype,
                "mime_type": "video/mp4" if vtype == "mp4" else "video/webm",
            }
