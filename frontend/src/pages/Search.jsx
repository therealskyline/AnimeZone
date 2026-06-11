/**
 * Search.jsx - Page catalogue sans filtres genres
 */

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAnimeList } from '../api/client'
import AnimeCard from '../components/AnimeCard'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const query = searchParams.get('query') || ''

  useEffect(() => {
    performSearch()
  }, [query])

  async function performSearch() {
    setLoading(true)
    try {
      const params = { limit: 200 }
      if (query) params.query = query
      const data = await getAnimeList(params)
      setResults(data.animes || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault()
    const q = e.target.elements.q.value.trim()
    const newParams = new URLSearchParams()
    if (q) newParams.set('query', q)
    setSearchParams(newParams)
  }

  return (
    <div className="container" style={{ marginTop: '2rem', paddingBottom: '3rem' }}>
      {/* Titre */}
      <h1 className="catalogue-title">Catalogue</h1>

      {/* Barre de recherche */}
      <form onSubmit={handleSearchSubmit} className="catalogue-search-form">
        <input
          name="q"
          defaultValue={query}
          key={query}
          type="text"
          className="catalogue-search-input"
          placeholder="Rechercher un anime..."
        />
        <button type="submit" className="btn btn-primary">
          <i className="fas fa-search"></i> Rechercher
        </button>
      </form>

      {/* Résultats */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
        </div>
      ) : (
        <>
          <p className="results-count">
            {results.length} anime{results.length !== 1 ? 's' : ''}
            {query ? ` pour "${query}"` : ' disponibles'}
          </p>
          {results.length > 0 ? (
            <div className="anime-grid">
              {results.map((anime) => (
                <AnimeCard key={anime.anime_id || anime.id} anime={anime} />
              ))}
            </div>
          ) : (
            <div className="no-results">
              <i className="fas fa-search"></i>
              <h3>Aucun résultat</h3>
              <p>Essayez un autre terme de recherche.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
