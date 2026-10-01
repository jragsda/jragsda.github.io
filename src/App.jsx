import { HashRouter, Route, Routes, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AppStateProvider from '@/lib/AppState'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Picks from '@/pages/Picks'
import Results from '@/pages/Results'

// HashRouter keeps routes working on GitHub Pages (no server-side rewrites needed).
export default function App() {
  return (
    <AppStateProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/picks" element={<Picks />} />
            <Route path="/results" element={<Results />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      <Toaster position="bottom-center" />
    </AppStateProvider>
  )
}
