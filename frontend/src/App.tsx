import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { Navbar } from './components/Navbar'
import { PasskeyPromptBanner } from './components/PasskeyPromptBanner'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { TenantsPage } from './pages/TenantsPage'
import { TenantPage } from './pages/TenantPage'
import { WeeklyCalendarPage } from './pages/WeeklyCalendarPage'
import { MyBookingsPage } from './pages/MyBookingsPage'
import { ProfilePage } from './pages/ProfilePage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { TenantSettingsPage } from './pages/TenantSettingsPage'
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
      {!isLandingPage && !isInvitePage && <PasskeyPromptBanner />}
      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/tenants" element={<ProtectedRoute><TenantsPage /></ProtectedRoute>} />
          <Route path="/tenants/:slug" element={<ProtectedRoute><TenantPage /></ProtectedRoute>} />
          <Route path="/tenants/:slug/resources/:resourceId" element={<ProtectedRoute><WeeklyCalendarPage /></ProtectedRoute>} />
          <Route path="/tenants/:slug/settings" element={<ProtectedRoute><TenantSettingsPage /></ProtectedRoute>} />
          <Route path="/my-bookings" element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
          <Route path="/invite/:token" element={<InviteAcceptPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
