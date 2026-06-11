/**
 * ProfileContext.jsx - Contexte global du profil actif
 * Persisté dans localStorage entre les sessions
 */

import { createContext, useContext, useState, useEffect } from 'react'

const ProfileContext = createContext(null)

export function ProfileProvider({ children }) {
  const [activeProfile, setActiveProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('az_profile')) || null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (activeProfile) {
      localStorage.setItem('az_profile', JSON.stringify(activeProfile))
    } else {
      localStorage.removeItem('az_profile')
    }
  }, [activeProfile])

  const selectProfile = (profile) => setActiveProfile(profile)
  const logoutProfile = () => setActiveProfile(null)

  return (
    <ProfileContext.Provider value={{ activeProfile, selectProfile, logoutProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export const useProfile = () => {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider')
  return ctx
}
