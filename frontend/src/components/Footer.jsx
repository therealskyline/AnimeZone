import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-brand">
            Anime<span>Zone</span>
          </div>
          <p className="footer-text">Votre destination pour regarder des animes.</p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/" className="footer-text">Accueil</Link>
            <Link to="/search" className="footer-text">Catalogue</Link>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>© 2026 AnimeZone. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  )
}
