import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { Navbar } from './components/Navbar'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { SpacesPage } from './pages/SpacesPage'
import { SpacePage } from './pages/SpacePage'
import { WeeklyCalendarPage } from './pages/WeeklyCalendarPage'
import { MyBookingsPage } from './pages/MyBookingsPage'
import { ProfilePage } from './pages/ProfilePage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { SpaceSettingsPage } from './pages/SpaceSettingsPage'
import { UpgradePage } from './pages/UpgradePage'
import { InviteAcceptPage } from './pages/InviteAcceptPage'
import { setAuthToken, setupAuthHandlers } from './api/client'
import './App.css'

function App() {
  const auth = useAuth()
  const location = useLocation()
  const isLandingPage = location.pathname === '/'
  const isInvitePage = location.pathname.startsWith('/invite/')

  useEffect(() => {
    setAuthToken(auth.user?.access_token ?? null)
    setupAuthHandlers(
      () => auth.signinSilent(),
      () => auth.signoutRedirect(),
    )
  }, [auth, auth.user?.access_token])

  if (auth.isLoading) {
    return <div className="app-loading">Loading…</div>
  }

  if (auth.error) {
    return <div className="app-error">Authentication error: {auth.error.message}</div>
  }

  return (
    <div className="app">
      {!isLandingPage && !isInvitePage && <Navbar />}

      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/spaces" element={<ProtectedRoute><SpacesPage /></ProtectedRoute>} />
          <Route path="/spaces/:slug" element={<ProtectedRoute><SpacePage /></ProtectedRoute>} />
          <Route path="/spaces/:slug/resources/:resourceId" element={<ProtectedRoute><WeeklyCalendarPage /></ProtectedRoute>} />
          <Route path="/spaces/:slug/settings" element={<ProtectedRoute><SpaceSettingsPage /></ProtectedRoute>} />
          <Route path="/my-bookings" element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
          <Route path="/upgrade" element={<UpgradePage />} />
          <Route path="/invite/:token" element={<InviteAcceptPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
