import { Link } from 'react-router-dom'

export default function AnimeCard({ anime, showRemove, onRemove, progressInfo }) {
  const id = anime.anime_id || anime.id

  return (
    <div className="anime-card-wrapper">
      {showRemove && (
        <button
          className="remove-button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove && onRemove(id) }}
          title="Retirer de l'historique"
        >
          <i className="fas fa-times"></i>
        </button>
      )}
      <Link to={`/anime/${id}`} className="anime-card-link">
        <div className="anime-card fade-in">
          <div className="anime-card-link-img">
            <img
              src={anime.image || anime.image_url}
              alt={anime.title}
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
            <h3 className="anime-card-title">{anime.title}</h3>
            {progressInfo && (
              <p className="anime-card-episode">
                S{progressInfo.season}E{progressInfo.episode}: {progressInfo.episodeTitle || ''}
              </p>
            )}
            <div className="anime-card-info">
              <div className="anime-card-rating">
                <span className="rating-star"><i className="fas fa-star"></i></span>
                <span>{anime.rating || '?'}</span>
              </div>
            </div>
            <div className="anime-card-actions">
              {progressInfo ? (
                <span className="btn btn-primary btn-reprendre">
                  <i className="fas fa-play-circle"></i> Continuer
                </span>
              ) : (
                <span className="btn btn-outline">Regarder</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}
