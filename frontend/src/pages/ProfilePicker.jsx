/**
 * ProfilePicker.jsx - Écran de sélection de profil (style Netflix)
 * Cercles avec la première lettre du pseudo
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext'
import { getProfiles, createProfile, deleteProfile } from '../api/client'

const AVATAR_COLORS = [
  'linear-gradient(135deg, #6a1b9a, #ff4081)',
  'linear-gradient(135deg, #1565c0, #00bcd4)',
  'linear-gradient(135deg, #2e7d32, #76ff03)',
  'linear-gradient(135deg, #e65100, #ffca28)',
  'linear-gradient(135deg, #880e4f, #f06292)',
  'linear-gradient(135deg, #37474f, #90a4ae)',
]

export default function ProfilePicker() {
  const { selectProfile } = useProfile()
  const navigate = useNavigate()

  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    loadProfiles()
  }, [])

  async function loadProfiles() {
    try {
      const data = await getProfiles()
      setProfiles(data.profiles || [])
    } catch (e) {
      setError('Impossible de charger les profils. Le serveur est-il démarré ?')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setError('')
    try {
      await createProfile(newName.trim())
      setNewName('')
      setCreating(false)
      await loadProfiles()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDelete(username) {
    if (!confirm(`Supprimer le profil "${username}" ? Cette action est irréversible.`)) return
    try {
      await deleteProfile(username)
      await loadProfiles()
    } catch (e) {
      setError(e.message)
    }
  }

  function handleSelect(profile) {
    selectProfile(profile)
    navigate('/')
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.spinner}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.logo}>
        Anime<span style={{ color: 'var(--accent-color)' }}>Zone</span>
      </div>

      <h2 style={styles.title}>Qui regarde ?</h2>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.grid}>
        {profiles.map((profile, idx) => (
          <div key={profile.id} style={styles.profileItem}>
            <div
              style={{
                ...styles.avatar,
                background: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                cursor: editMode ? 'default' : 'pointer',
              }}
              onClick={() => !editMode && handleSelect(profile)}
              title={profile.username}
            >
              {profile.username[0].toUpperCase()}
              {editMode && (
                <button
                  style={styles.deleteBtn}
                  onClick={(e) => { e.stopPropagation(); handleDelete(profile.username) }}
                  title="Supprimer"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
            <span style={styles.profileName}>{profile.username}</span>
          </div>
        ))}

        {/* Bouton Ajouter un profil */}
        {!editMode && (
          <div style={styles.profileItem}>
            {creating ? (
              <form onSubmit={handleCreate} style={styles.createForm}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Nom du profil"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={styles.input}
                  maxLength={20}
                />
                <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%' }}>
                  Créer
                </button>
                <button
                  type="button"
                  onClick={() => { setCreating(false); setNewName('') }}
                  className="btn btn-outline"
                  style={{ marginTop: '0.25rem', width: '100%' }}
                >
                  Annuler
                </button>
              </form>
            ) : (
              <>
                <div style={styles.addAvatar} onClick={() => setCreating(true)}>
                  <i className="fas fa-plus" style={{ fontSize: '2rem' }}></i>
                </div>
                <span style={styles.profileName}>Ajouter un profil</span>
              </>
            )}
          </div>
        )}
      </div>

      {profiles.length > 0 && (
        <button
          className="btn btn-outline"
          style={{ marginTop: '2rem' }}
          onClick={() => setEditMode(!editMode)}
        >
          {editMode ? (
            <><i className="fas fa-check"></i> Terminé</>
          ) : (
            <><i className="fas fa-edit"></i> Gérer les profils</>
          )}
        </button>
      )}
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: 'var(--background-dark)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  logo: {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '2rem',
    color: 'var(--text-secondary)',
    marginBottom: '2.5rem',
    fontWeight: '400',
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '2rem',
    justifyContent: 'center',
    maxWidth: '800px',
  },
  profileItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  avatar: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '3rem',
    fontWeight: '800',
    color: 'white',
    position: 'relative',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  },
  addAvatar: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.08)',
    border: '2px dashed rgba(255,255,255,0.3)',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'all 0.2s ease',
  },
  profileName: {
    color: 'var(--text-secondary)',
    fontWeight: '600',
    fontSize: '1rem',
    textAlign: 'center',
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  deleteBtn: {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'rgba(220,53,69,0.9)',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
  },
  error: {
    color: '#ff6b6b',
    backgroundColor: 'rgba(220,53,69,0.1)',
    border: '1px solid rgba(220,53,69,0.3)',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    marginBottom: '1rem',
  },
  spinner: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: '4px solid rgba(255,255,255,0.1)',
    borderTopColor: 'var(--accent-color)',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '1rem',
  },
  input: {
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    width: '140px',
    textAlign: 'center',
  },
  createForm: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },
}
