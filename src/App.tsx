import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { useSettings } from './data/settings'
import { useCourse } from './content/store'
import { ArtDefs } from './art/Defs'
import { BottomNav } from './components/Nav'
import Today from './screens/Today'
import { Swallow } from './art/Swallow'

const MapScreen = lazy(() => import('./screens/MapScreen'))
const TargetScreen = lazy(() => import('./screens/TargetScreen'))
const Session = lazy(() => import('./screens/Session'))
const Journal = lazy(() => import('./screens/Journal'))
const Settings = lazy(() => import('./screens/Settings'))
const Teacher = lazy(() => import('./screens/Teacher'))
const About = lazy(() => import('./screens/About'))
const Onboarding = lazy(() => import('./screens/Onboarding'))

function Splash() {
  return (
    <div style={{ minHeight: '80dvh', display: 'grid', placeItems: 'center' }} aria-busy="true">
      <div className="floaty"><Swallow pose="fly" size={160} title="Schwa" /></div>
    </div>
  )
}

function Shell() {
  const { ready, s } = useSettings()
  const course = useCourse()
  const loc = useLocation()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [loc.pathname])
  if (!ready || !course) return <Splash />
  const hideNav = loc.pathname.startsWith('/welcome') || loc.pathname.startsWith('/session')
  if (!s.onboarded && !loc.pathname.startsWith('/welcome') && !loc.pathname.startsWith('/about')) return <Navigate to="/welcome" replace />
  return (
    <div className="shell" style={hideNav ? { paddingLeft: 0 } : undefined}>
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/map" element={<MapScreen />} />
          <Route path="/target/:id" element={<TargetScreen />} />
          <Route path="/target/:id/:step" element={<TargetScreen />} />
          <Route path="/session" element={<Session />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/teacher" element={<Teacher />} />
          <Route path="/about" element={<About />} />
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="/welcome/:part" element={<Onboarding />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {!hideNav && <BottomNav />}
    </div>
  )
}

export default function App() {
  const hydrate = useSettings((st) => st.hydrate)
  useEffect(() => { void hydrate() }, [hydrate])
  return (
    <BrowserRouter>
      <ArtDefs />
      <Shell />
    </BrowserRouter>
  )
}
