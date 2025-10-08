import { Activity, Clock3, GaugeCircle, ShieldCheck } from 'lucide-react'
import { badgeBaseClass } from '../styles/ui'
import type { OverviewMetrics, StreamStatus } from '../types'

interface OverviewCardsProps {
  overview?: OverviewMetrics
  lastCycleAt?: Date
  streamStatus: StreamStatus
}

const statusLabels: Record<StreamStatus, string> = {
  idle: 'offline',
  connecting: 'connecting…',
  open: 'live',
  error: 'error'
}

const statusStyles: Record<StreamStatus, string> = {
  idle: `${badgeBaseClass} border border-slate-600/60 bg-slate-800/60 text-slate-300`,
  connecting: `${badgeBaseClass} border border-sky-400/40 bg-sky-500/10 text-sky-200`,
  open: `${badgeBaseClass} border border-emerald-400/40 bg-emerald-500/15 text-emerald-100`,
  error: `${badgeBaseClass} border border-orange-400/40 bg-orange-500/15 text-orange-100`
}

const numberFormatter = new Intl.NumberFormat()

const formatTime = (value?: Date) => {
  if (!value) return '—'
  return `${value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export const OverviewCards = ({ overview, lastCycleAt, streamStatus }: OverviewCardsProps) => {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-100">Water Resource Dashboard</h1>
          <p className="max-w-3xl text-sm text-slate-400">
            Monitoring real-time flow, pressure, and storage health across the campus grid.
          </p>
        </div>
        <span className={statusStyles[streamStatus]}>{statusLabels[streamStatus]}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="flex flex-col gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-panel">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-300">
            <GaugeCircle size={18} aria-hidden />
            Total sensors
          </h3>
          <p className="text-3xl font-semibold text-slate-100">
            {overview ? numberFormatter.format(overview.totalSensors) : '—'}
          </p>
          <p className="text-sm text-slate-400">Active {overview ? overview.activeSensors : '—'}</p>
        </article>
        <article className="flex flex-col gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-panel">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-300">
            <ShieldCheck size={18} aria-hidden />
            Leak alerts (1h)
          </h3>
          <p className="text-3xl font-semibold text-sky-300">
            {overview ? overview.leakAlertsLastHour : '—'}
          </p>
          <p className="text-sm text-slate-400">Driven by anomaly detection on live flow.</p>
        </article>
        <article className="flex flex-col gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-panel">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-300">
            <Activity size={18} aria-hidden />
            Health score
          </h3>
          <p className="text-3xl font-semibold text-slate-100">
            {overview?.averageHealthScore ?? '—'}
          </p>
          <p className="text-sm text-slate-400">Composite of battery, stability, and leak signals.</p>
        </article>
        <article className="flex flex-col gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-panel">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-300">
            <Clock3 size={18} aria-hidden />
            Last update
          </h3>
          <p className="text-3xl font-semibold text-slate-100">{formatTime(lastCycleAt)}</p>
          <p className="text-sm text-slate-400">Refreshes automatically with simulator cycles.</p>
        </article>
      </div>
    </div>
  )
}

export default OverviewCards
