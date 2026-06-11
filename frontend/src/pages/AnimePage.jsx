/**
 * AnimePage.jsx - Page détail d'un anime : saisons, épisodes, favoris
 */

import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext'
import { getAnimeDetail, toggleFavorite } from '../api/client'

export default function AnimePage() {
  const { animeId } = useParams()
  const { activeProfile } = useProfile()
  const navigate = useNavigate()

  const [anime, setAnime] = useState(null)
  const [episodeProgress, setEpisodeProgress] = useState({})
  const [isFavorite, setIsFavorite] = useState(false)
  const [activeSeasonNum, setActiveSeasonNum] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activeProfile) { navigate('/'); return }
    loadAnime()
  }, [animeId, activeProfile])

  async function loadAnime() {
    setLoading(true)
    try {
      const data = await getAnimeDetail(animeId, activeProfile?.username)
      setAnime(data.anime)
      setEpisodeProgress(data.episode_progress || {})
      setIsFavorite(data.is_favorite || false)
      if (data.anime?.seasons?.length > 0) {
        setActiveSeasonNum(data.anime.seasons[0].season_number)
      }
    } catch (e) {
      setError('Anime introuvable')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleFavorite() {
    if (!activeProfile) return
    try {
      const data = await toggleFavorite(activeProfile.username, parseInt(animeId))
      setIsFavorite(data.action === 'added')
    } catch (e) {
      console.error(e)
    }
  }

  // Trouver le dernier épisode regardé
  function getLatestProgress() {
    if (!anime || !Object.keys(episodeProgress).length) return null
    const entries = Object.entries(episodeProgress)
      .filter(([, v]) => !v.completed)
      .sort((a, b) => (b[1].last_watched || '').localeCompare(a[1].last_watched || ''))
    if (!entries.length) return null
    const [key] = entries[0]
    const [season, episode] = key.split('_').map(Number)
    return { season, episode }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (error || !anime) {
    return (
      <div className="container error-container">
        <div className="error-code">404</div>
        <div className="error-message">{error || 'Anime introuvable'}</div>
        <Link to="/" className="btn btn-primary">Retour à l'accueil</Link>
      </div>
    )
  }

  const latestProgress = getLatestProgress()
  const activeSeason = anime.seasons?.find((s) => s.season_number === activeSeasonNum)

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/" style={{ color: 'var(--text-secondary)' }}>Accueil</Link>
        <span style={{ color: 'var(--text-muted)', margin: '0 0.5rem' }}>/</span>
        <span style={{ color: 'var(--text-primary)' }}>{anime.title}</span>
      </div>

      {/* Détail */}
      <div className="anime-detail">
        {/* Poster */}
        <div className="anime-poster">
          <img
            src={anime.image || anime.image_url}
            alt={anime.title}
            onError={(e) => { e.target.src = '/default_anime.jpg' }}
          />
        </div>

        {/* Infos */}
        <div className="anime-info">
          <h1 className="anime-title">{anime.title}</h1>

          <div className="anime-meta">
            <div className="anime-rating">
              <span className="rating-star"><i className="fas fa-star"></i></span>
              <span style={{ marginLeft: '0.5rem' }}>{anime.rating || '?'}/10</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {(anime.genres || []).map((g) => (
                <Link key={g} to={`/search?genre=${g.toLowerCase()}`} className="genre-tag">
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </Link>
              ))}
            </div>
            <div style={{ marginTop: '1rem' }}>
              <button
                className={`btn ${isFavorite ? 'btn-primary' : 'btn-outline'}`}
                onClick={handleToggleFavorite}
              >
                <i className="fas fa-heart"></i>{' '}
                {isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              </button>
            </div>
          </div>

          <div className="anime-description">{anime.description}</div>

          {/* Reprendre */}
          {latestProgress && (
            <div className="continue-watching-btn" style={{ marginBottom: '2rem' }}>
              <Link
                to={`/player/${animeId}/${latestProgress.season}/${latestProgress.episode}`}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}
              >
                <i className="fas fa-play-circle"></i>
                Continuer S{latestProgress.season}E{latestProgress.episode}
              </Link>
            </div>
          )}

          {/* Saisons */}
          <div className="anime-seasons">
            <h3>Saisons, Films et Épisodes</h3>
            <div className="anime-seasons-tabs">
              <div className="anime-seasons-container">
                {(anime.seasons || []).map((season) => (
                  <div
                    key={season.season_number}
                    className={`season-tab${activeSeasonNum === season.season_number ? ' active' : ''}`}
                    data-season={season.season_number}
                    onClick={() => setActiveSeasonNum(season.season_number)}
                  >
                    {season.season_number === 99
                      ? 'Films'
                      : season.name || `Saison ${season.season_number}`}
                  </div>
                ))}
              </div>
            </div>

            {/* Épisodes de la saison active */}
            {activeSeason && (
              <div className="season-content">
                {activeSeason.season_number === 99 && (
                  <h3 className="films-header">
                    <span className="films-icon">🎬</span> Films disponibles
                  </h3>
                )}
                {activeSeason.episodes && activeSeason.episodes.length > 0 ? (
                  <ul className="episodes-list">
                    {activeSeason.episodes.map((ep) => {
                      const key = `${activeSeason.season_number}_${ep.episode_number}`
                      const prog = episodeProgress[key]
                      const completed = prog?.completed
                      const timePos = prog?.time_position || 0
                      const progressPct = timePos > 0 ? Math.min((timePos / 1440) * 100, 100) : 0

                      return (
                        <li
                          key={ep.episode_number}
                          className={`episode-item${completed ? ' episode-completed' : prog ? ' episode-in-progress' : ''}`}
                        >
                          <Link
                            to={`/player/${animeId}/${activeSeason.season_number}/${ep.episode_number}`}
                            className="episode-link"
                          >
                            <div className="episode-number">{ep.episode_number}</div>
                            <div className="episode-details">
                              <div className="episode-title">
                                {ep.title}
                                {ep.languages?.includes('VF') && (
                                  <span className="language-badge vf">VF</span>
                                )}
                                {ep.languages?.includes('VOSTFR') && (
                                  <span className="language-badge vostfr">VOSTFR</span>
                                )}
                              </div>
                              {ep.description && (
                                <div className="episode-description">{ep.description}</div>
                              )}
                              {prog && (
                                <div className="progress-bar">
                                  <div className="progress-fill" style={{ width: `${progressPct}%` }}></div>
                                </div>
                              )}
                            </div>
                            <div style={{ marginLeft: 'auto' }}>
                              <i
                                className={`fas ${activeSeason.season_number === 99 ? 'fa-film' : 'fa-play-circle'}`}
                                style={{ fontSize: '1.5rem', color: 'var(--accent-color)' }}
                              ></i>
                            </div>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <div className="no-episodes-message">
                    <div className="icon"><i className="fas fa-exclamation-circle"></i></div>
                    <h3>Aucun épisode disponible</h3>
                    <p>Les épisodes pour cette saison ne sont pas encore disponibles.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
