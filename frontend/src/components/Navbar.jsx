import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext'

export default function Navbar() {
  const { activeProfile, logoutProfile } = useProfile()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?query=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <Link to="/" className="navbar-brand">
          Anime<span>Zone</span>
        </Link>

        <ul className={`navbar-nav${menuOpen ? ' show' : ''}`}>
          <li className="nav-item">
            <Link to="/" className="nav-link" onClick={() => setMenuOpen(false)}>Accueil</Link>
          </li>
          <li className="nav-item">
            <Link to="/search" className="nav-link" onClick={() => setMenuOpen(false)}>Catalogue</Link>
          </li>
        </ul>

        <div className="search-container">
          <form onSubmit={handleSearch}>
            <input
              type="text"
              className="search-input"
              placeholder="Rechercher un anime..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="search-button">
              <i className="fas fa-search"></i>
            </button>
          </form>
        </div>

        {activeProfile && (
          <div className="user-menu">
            <div
              className="user-avatar"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              title={activeProfile.username}
            >
              <span>{activeProfile.username[0].toUpperCase()}</span>
            </div>
            <div className={`user-dropdown${dropdownOpen ? ' show' : ''}`}>
              <div className="user-dropdown-header">
                <div className="user-info">
                  <span className="username">{activeProfile.username}</span>
                </div>
              </div>
              <ul className="user-dropdown-menu">
                <li>
                  <Link to="/profile" onClick={() => setDropdownOpen(false)}>
                    <i className="fas fa-user"></i> Mon Profil
                  </Link>
                </li>
                <li className="dropdown-divider"></li>
                <li>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      logoutProfile()
                      setDropdownOpen(false)
                      navigate('/')
                    }}
                  >
                    <i className="fas fa-sign-out-alt"></i> Changer de profil
                  </a>
                </li>
              </ul>
            </div>
          </div>
        )}

        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          <i className="fas fa-bars"></i>
        </button>
      </div>
    </nav>
  )
}
