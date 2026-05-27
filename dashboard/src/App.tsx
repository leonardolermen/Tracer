import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Sidebar } from './components/Sidebar'
import { LoginPage } from './pages/LoginPage'
import { TracesPage } from './pages/TracesPage'
import { TraceDetailPage } from './pages/TraceDetailPage'
import { ServicesPage } from './pages/ServicesPage'
import { ServiceDetailPage } from './pages/ServiceDetailPage'
import { AlertsPage } from './pages/AlertsPage'
import { HomePage } from './pages/HomePage'
import { SettingsPage } from './pages/SettingsPage'

function Layout() {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/traces" element={<TracesPage />} />
          <Route path="/traces/:traceId" element={<TraceDetailPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/services/:serviceName" element={<ServiceDetailPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<Layout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
