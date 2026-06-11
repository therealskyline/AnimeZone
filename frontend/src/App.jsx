/**
 * App.jsx - Routeur principal AnimeZone
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ProfileProvider } from './context/ProfileContext'
import { useProfile } from './context/ProfileContext'

import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProfilePicker from './pages/ProfilePicker'
import Home from './pages/Home'
import Search from './pages/Search'
import AnimePage from './pages/AnimePage'
import PlayerPage from './pages/PlayerPage'

function RequireProfile({ children }) {
  const { activeProfile } = useProfile()
  if (!activeProfile) return <Navigate to="/" replace />
  return children
}

function AppLayout() {
  const { activeProfile } = useProfile()

  if (!activeProfile) {
    return (
      <Routes>
        <Route path="*" element={<ProfilePicker />} />
      </Routes>
    )
  }

  return (
    <>
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/anime/:animeId" element={<AnimePage />} />
          <Route path="/player/:animeId/:season/:episode" element={<PlayerPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <ProfileProvider>
      <Router>
        <AppLayout />
      </Router>
    </ProfileProvider>
  )
}
