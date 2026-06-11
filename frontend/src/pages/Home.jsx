/**
 * Home.jsx - Page d'accueil AnimeZone
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext'
import { getFeatured, getHistory, getFavorites, removeFromWatching } from '../api/client'
import AnimeCard from '../components/AnimeCard'

export default function Home() {
  const { activeProfile } = useProfile()
  const navigate = useNavigate()

  const [featured, setFeatured] = useState([])
  const [history, setHistory] = useState([])
  const [favorites, setFavorites] = useState([])
  const [totalAnimes, setTotalAnimes] = useState('...')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeProfile) { navigate('/'); return }
    loadData()
  }, [activeProfile])

  async function loadData() {
    setLoading(true)
    try {
      const [featuredData, historyData, favData] = await Promise.all([
        getFeatured(),
        getHistory(activeProfile.username, 20),
        getFavorites(activeProfile.username),
      ])
      const animes = featuredData.animes || []
      setFeatured(animes)
      setTotalAnimes(featuredData.total || animes.length)
      setHistory(historyData.history || [])
      setFavorites(favData.favorites || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove(animeId) {
    try {
      await removeFromWatching(activeProfile.username, animeId)
      setHistory((prev) => prev.filter((h) => (h.anime?.anime_id || h.anime?.id) !== animeId))
    } catch (e) {
      console.error(e)
    }
  }

  // Dédoublonner historique
  const continueWatching = []
  const seen = new Set()
  for (const item of history) {
    const id = item.anime?.anime_id || item.anime?.id
    if (id && !seen.has(id) && item.episode) {
      seen.add(id)
      continueWatching.push(item)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <>
      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-line"></div>
        <div className="container hero-content">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot"></span>
            Streaming illimité
          </div>
          <h1 className="hero-title">
            Bienvenue sur<br />
            <span className="hero-title-highlight">AnimeZone</span>
          </h1>
          <p className="hero-subtitle">
            Reprenez votre visionnage où vous vous êtes arrêté, ou découvrez
            de nouvelles séries parmi notre vaste collection.
          </p>
          <div className="hero-actions">
            <Link to="/search" className="btn btn-primary">
              <i className="fas fa-play"></i> Explorer le catalogue
            </Link>
            {continueWatching.length > 0 && (
              <a
                href="#continuer"
                className="btn btn-secondary"
                onClick={(e) => { e.preventDefault(); document.getElementById('continuer')?.scrollIntoView({ behavior: 'smooth' }) }}
              >
                <i className="fas fa-history"></i> Continuer à regarder
              </a>
            )}
          </div>
          <div className="hero-stats">
            <div>
              <div className="hero-stat-value">{typeof totalAnimes === 'number' ? totalAnimes + '+' : totalAnimes}</div>
              <div className="hero-stat-label">Animes</div>
            </div>
            <div>
              <div className="hero-stat-value">VF & VOSTFR</div>
              <div className="hero-stat-label">Langues</div>
            </div>
            <div>
              <div className="hero-stat-value">HD</div>
              <div className="hero-stat-label">Qualité</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTINUER À REGARDER ── */}
      {continueWatching.length > 0 && (
        <section className="section" id="continuer">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title-bar"></span>
                Continuer à regarder
              </h2>
            </div>
            <div className="anime-grid">
              {continueWatching.map((item) => {
                const id = item.anime?.anime_id || item.anime?.id
                return (
                  <div key={id} className="anime-card-wrapper">
                    <button className="remove-button" onClick={() => handleRemove(id)}>
                      <i className="fas fa-times"></i>
                    </button>
                    <Link
                      to={`/player/${id}/${item.progress.season}/${item.progress.episode}`}
                      className="anime-card-link"
                    >
                      <div className="anime-card fade-in">
                        <div className="anime-card-link-img">
                          <img
                            src={item.anime.image || item.anime.image_url}
                            alt={item.anime.title}
                            className="anime-card-image"
                            loading="lazy"
                            onError={(e) => { e.target.src = '/default_anime.jpg' }}
                          />
                          <div className="anime-card-overlay">
                            <div className="watch-status">
                              <i className="fas fa-play-circle"></i> Regarder
                            </div>
                          </div>
                        </div>
                        <div className="anime-card-body">
                          <h3 className="anime-card-title">{item.anime.title}</h3>
                          <p className="anime-card-episode">
                            S{item.progress.season}E{item.progress.episode}
                            {item.episode?.title ? `: ${item.episode.title}` : ''}
                          </p>
                          <div className="anime-card-actions">
                            <span className="btn btn-reprendre">
                              <i className="fas fa-play-circle"></i> Continuer
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── DÉCOUVRIR ── */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-title-bar"></span>
              À découvrir
            </h2>
            <Link to="/search" className="section-link">
              Voir tout <i className="fas fa-arrow-right"></i>
            </Link>
          </div>
          <div className="anime-grid">
            {featured.map((anime) => (
              <AnimeCard key={anime.anime_id || anime.id} anime={anime} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FAVORIS ── */}
      {favorites.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title-bar"></span>
                Mes favoris
              </h2>
            </div>
            <div className="anime-grid">
              {favorites.map((anime) => (
                <AnimeCard key={anime.anime_id || anime.id} anime={anime} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
