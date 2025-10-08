import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import CreateSensorPage from './pages/CreateSensorPage'
import ApiKeysPage from './pages/ApiKeysPage'
import AutomationsPage from './pages/AutomationsPage'
import AlertSimulatorPage from './pages/AlertSimulatorPage'
import AgentAssistant from './components/AgentAssistant'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
    isActive
      ? 'bg-slate-800/80 text-slate-100 shadow-inner'
      : 'text-slate-400 hover:text-slate-200'
  }`

function App() {
  return (
    <>
      <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Hydrogrid Console</h1>
            {/* <p className="text-xs text-slate-400">Manage sensors, ingestion keys, and live telemetry.</p> */}
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <NavLink to="/" className={navLinkClass} end>
              Dashboard
            </NavLink>
            <NavLink to="/sensors/new" className={navLinkClass}>
              Create sensor
            </NavLink>
            <NavLink to="/automations" className={navLinkClass}>
              Automations
            </NavLink>
            <NavLink to="/alerts/simulate" className={navLinkClass}>
              Alert tester
            </NavLink>
            <NavLink to="/api-keys" className={navLinkClass}>
              API keys
            </NavLink>
          </nav>
        </div>
      </header>
  <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-10">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/sensors/new" element={<CreateSensorPage />} />
          <Route path="/automations" element={<AutomationsPage />} />
          <Route path="/alerts/simulate" element={<AlertSimulatorPage />} />
          <Route path="/api-keys" element={<ApiKeysPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      </div>
      <AgentAssistant />
    </>
  )
}

export default App
