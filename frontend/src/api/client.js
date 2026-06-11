/**
 * client.js - Couche API : toutes les requêtes vers FastAPI backend
 * Proxy Vite redirige /api → http://localhost:8000
 */

const BASE = '/api'

async function req(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Erreur réseau')
  }
  return res.json()
}

// ---- Profils ----
export const getProfiles = () => req('/profiles')
export const createProfile = (username) =>
  req('/profiles', { method: 'POST', body: JSON.stringify({ username }) })
export const deleteProfile = (username) =>
  req(`/profiles/${encodeURIComponent(username)}`, { method: 'DELETE' })

// ---- Anime ----
export const getAnimeList = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return req(`/anime${qs ? '?' + qs : ''}`)
}
export const getFeatured = () => req('/anime/featured')
export const getGenres = () => req('/anime/genres')
export const getAnimeDetail = (id, username = '') =>
  req(`/anime/${id}${username ? '?username=' + encodeURIComponent(username) : ''}`)

// ---- Progression ----
export const getHistory = (username, limit = 20) =>
  req(`/progress/${encodeURIComponent(username)}?limit=${limit}`)
export const saveProgress = (data) =>
  req('/progress/save', { method: 'POST', body: JSON.stringify(data) })
export const removeFromWatching = (username, anime_id) =>
  req('/progress/remove', { method: 'POST', body: JSON.stringify({ username, anime_id }) })

// ---- Favoris ----
export const getFavorites = (username) =>
  req(`/favorites/${encodeURIComponent(username)}`)
export const toggleFavorite = (username, anime_id) =>
  req('/favorites/toggle', { method: 'POST', body: JSON.stringify({ username, anime_id }) })

// ---- Proxy Vidéo ----
export const getVideoInfo = (url) =>
  req('/video/info', { method: 'POST', body: JSON.stringify({ url }) })
export const getStreamUrl = (videoKey) =>
  `/api/video/stream/${encodeURIComponent(videoKey)}`
export const getSegmentUrl = (videoKey, num) =>
  `/api/video/segment/${encodeURIComponent(videoKey)}/${num}`
