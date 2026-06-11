/**
 * PlayerPage.jsx - Page de lecture vidéo
 * Gère HLS, MP4 direct, et fallback iframe
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext'
import { getAnimeDetail, getVideoInfo, saveProgress } from '../api/client'

export default function PlayerPage() {
  const { animeId, season, episode } = useParams()
  const { activeProfile } = useProfile()
  const navigate = useNavigate()

  const [anime, setAnime] = useState(null)
  const [currentEpisode, setCurrentEpisode] = useState(null)
  const [currentSeason, setCurrentSeason] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Langue & source
  const [availableLangs, setAvailableLangs] = useState([])
  const [selectedLang, setSelectedLang] = useState('VOSTFR')
  const [sourceUrls, setSourceUrls] = useState([])
  const [sourceIndex, setSourceIndex] = useState(0)

  // État vidéo
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoError, setVideoError] = useState('')
  const [videoKey, setVideoKey] = useState(null)
  const [playerType, setPlayerType] = useState(null)
  const [useIframe, setUseIframe] = useState(false)
  const [iframeUrl, setIframeUrl] = useState('')

  const videoRef = useRef(null)
  const saveIntervalRef = useRef(null)
  const resolvedRef = useRef(false)

  // Chargement des données anime
  useEffect(() => {
    if (!activeProfile) { navigate('/'); return }
    loadEpisode()
  }, [animeId, season, episode])

  async function loadEpisode() {
    setLoading(true)
    setError('')
    setVideoKey(null)
    setPlayerType(null)
    setUseIframe(false)
    setIframeUrl('')
    resolvedRef.current = false
    try {
      const data = await getAnimeDetail(animeId, activeProfile?.username)
      setAnime(data.anime)

      const s = data.anime?.seasons?.find((s) => s.season_number === parseInt(season))
      const ep = s?.episodes?.find((e) => e.episode_number === parseInt(episode))

      if (!s || !ep) {
        setError('Épisode introuvable')
        return
      }

      setCurrentSeason(s)
      setCurrentEpisode(ep)

      const langs = ep.languages || Object.keys(ep.urls || {})
      setAvailableLangs(langs)

      const lang = langs.includes('VOSTFR') ? 'VOSTFR' : langs[0] || 'VOSTFR'
      setSelectedLang(lang)

      const urls = ep.urls?.[lang] || []
      setSourceUrls(urls)
      setSourceIndex(0)

      if (urls.length > 0) {
        resolveVideo(urls[0])
      }
    } catch (e) {
      setError('Impossible de charger l\'épisode')
    } finally {
      setLoading(false)
    }
  }

  async function resolveVideo(url) {
    setVideoLoading(true)
    setVideoError('')
    setVideoKey(null)
    setPlayerType(null)
    setUseIframe(false)
    resolvedRef.current = false

    try {
      const data = await getVideoInfo(url)

      if (!data.success) {
        if (data.use_iframe) {
          setUseIframe(true)
          setIframeUrl(url)
          resolvedRef.current = true
        } else {
          setVideoError(data.error || 'Impossible de charger la vidéo')
        }
      } else {
        setPlayerType(data.player_type)
        setVideoKey(data.video_key)
        resolvedRef.current = true
      }
    } catch (e) {
      setVideoError('Erreur de connexion au serveur')
    } finally {
      setVideoLoading(false)
    }
  }

  // Changer langue
  function handleLangChange(lang) {
    setSelectedLang(lang)
    const urls = currentEpisode?.urls?.[lang] || []
    setSourceUrls(urls)
    setSourceIndex(0)
    if (urls.length > 0) resolveVideo(urls[0])
  }

  // Changer source
  function handleSourceChange(idx) {
    setSourceIndex(idx)
    resolveVideo(sourceUrls[idx])
  }

  // Navigation entre épisodes
  function getAdjacentEpisode(direction) {
    if (!currentSeason) return null
    const eps = currentSeason.episodes || []
    const curIdx = eps.findIndex((e) => e.episode_number === parseInt(episode))
    const nextIdx = curIdx + direction
    if (nextIdx < 0 || nextIdx >= eps.length) return null
    return eps[nextIdx]
  }

  const prevEp = getAdjacentEpisode(-1)
  const nextEp = getAdjacentEpisode(1)

  // Sauvegarde progression
  const saveProgressThrottled = useCallback(async () => {
    if (!videoRef.current || !activeProfile || !anime) return
    const time = videoRef.current.currentTime
    const duration = videoRef.current.duration || 0
    const completed = duration > 0 && time / duration > 0.9

    try {
      await saveProgress({
        username: activeProfile.username,
        anime_id: parseInt(animeId),
        season_number: parseInt(season),
        episode_number: parseInt(episode),
        time_position: time,
        completed,
      })
    } catch (e) {
      // silencieux
    }
  }, [activeProfile, anime, animeId, season, episode])

  useEffect(() => {
    saveIntervalRef.current = setInterval(saveProgressThrottled, 15000)
    return () => {
      clearInterval(saveIntervalRef.current)
      saveProgressThrottled()
    }
  }, [saveProgressThrottled])

  // URL du stream
  const streamUrl = videoKey ? `/api/video/stream/${encodeURIComponent(videoKey)}` : ''

  if (loading) {
    return (
      <div className="player-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Chargement de l'épisode…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="player-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="error-container">
          <div className="error-code">404</div>
          <div className="error-message">{error}</div>
          <Link to={`/anime/${animeId}`} className="btn btn-primary">Retour à l'anime</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="player-page">
      {/* Header */}
      <div className="player-header">
        <Link to={`/anime/${animeId}`} className="player-back-btn">
          <i className="fas fa-arrow-left"></i> Retour
        </Link>
        <div className="player-title-info">
          {anime?.title}
          <span>
            S{season}E{episode}{currentEpisode?.title ? ` — ${currentEpisode.title}` : ''}
          </span>
        </div>
      </div>

      {/* Sélecteur langue */}
      {availableLangs.length > 1 && (
        <div className="source-selector">
          <label>Langue :</label>
          {availableLangs.map((lang) => (
            <button
              key={lang}
              className={`lang-btn${selectedLang === lang ? ' active' : ''}`}
              onClick={() => handleLangChange(lang)}
            >
              {lang}
            </button>
          ))}
        </div>
      )}

      {/* Sélecteur source */}
      {sourceUrls.length > 1 && (
        <div className="source-selector">
          <label>Source :</label>
          {sourceUrls.map((url, idx) => {
            const domain = (() => {
              try { return new URL(url).hostname.replace('www.', '').split('.')[0] } catch { return `Source ${idx + 1}` }
            })()
            return (
              <button
                key={idx}
                className={`source-btn${sourceIndex === idx ? ' active' : ''}`}
                onClick={() => handleSourceChange(idx)}
              >
                {domain.charAt(0).toUpperCase() + domain.slice(1)}
              </button>
            )
          })}
        </div>
      )}

      {/* Zone vidéo */}
      <div className="video-container">
        {videoLoading && (
          <div className="video-loading">
            <div className="loading-spinner"></div>
            <p>Résolution de la source…</p>
          </div>
        )}

        {!videoLoading && videoError && (
          <div className="video-error">
            <i className="fas fa-exclamation-triangle" style={{ fontSize: '2.5rem', color: 'var(--accent-color)' }}></i>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{videoError}</p>
            {sourceUrls.length > 1 && sourceIndex < sourceUrls.length - 1 && (
              <button
                className="btn btn-primary"
                onClick={() => handleSourceChange(sourceIndex + 1)}
              >
                <i className="fas fa-forward"></i> Essayer la source suivante
              </button>
            )}
          </div>
        )}

        {!videoLoading && !videoError && useIframe && iframeUrl && (
          <iframe
            src={iframeUrl}
            allowFullScreen
            allow="autoplay; fullscreen"
            title="Lecteur vidéo"
          />
        )}

        {!videoLoading && !videoError && !useIframe && streamUrl && (
          <video
            ref={videoRef}
            src={streamUrl}
            controls
            autoPlay
            preload="metadata"
            onEnded={saveProgressThrottled}
            onError={() => {
              if (sourceIndex < sourceUrls.length - 1) {
                handleSourceChange(sourceIndex + 1)
              } else {
                setVideoError('Toutes les sources ont échoué.')
              }
            }}
          />
        )}
      </div>

      {/* Navigation épisodes */}
      <div className="player-bottom">
        <div className="episode-nav">
          {prevEp ? (
            <Link
              to={`/player/${animeId}/${season}/${prevEp.episode_number}`}
              className="btn btn-outline"
            >
              <i className="fas fa-step-backward"></i> Épisode précédent
            </Link>
          ) : <div />}

          <div className="episode-nav-info">
            Épisode {episode} / {currentSeason?.episodes?.length || '?'}
          </div>

          {nextEp ? (
            <Link
              to={`/player/${animeId}/${season}/${nextEp.episode_number}`}
              className="btn btn-primary"
            >
              Épisode suivant <i className="fas fa-step-forward"></i>
            </Link>
          ) : (
            <Link to={`/anime/${animeId}`} className="btn btn-outline">
              <i className="fas fa-list"></i> Liste des épisodes
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
