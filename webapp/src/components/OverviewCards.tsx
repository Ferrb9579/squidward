import { Activity, Clock3, GaugeCircle, ShieldCheck } from 'lucide-react'
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
  idle: 'status-chip status-chip--idle',
  connecting: 'status-chip status-chip--connecting',
  open: 'status-chip status-chip--open',
  error: 'status-chip status-chip--error'
}

const numberFormatter = new Intl.NumberFormat()

const formatTime = (value?: Date) => {
  if (!value) return '—'
  return `${value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export const OverviewCards = ({ overview, lastCycleAt, streamStatus }: OverviewCardsProps) => {
  return (
    <div className="overview">
      <div className="overview__header">
        <div>
          <h1>Water Resource Dashboard</h1>
          <p className="overview__subtitle">
            Monitoring real-time flow, pressure, and storage health across the campus grid.
          </p>
        </div>
        <span className={statusStyles[streamStatus]}>{statusLabels[streamStatus]}</span>
      </div>
      <div className="overview__grid">
        <article className="overview-card">
          <h3 className="overview-card__title">
            <GaugeCircle size={18} aria-hidden />
            Total sensors
          </h3>
          <p className="overview-card__value">
            {overview ? numberFormatter.format(overview.totalSensors) : '—'}
          </p>
          <p className="overview-card__meta">Active {overview ? overview.activeSensors : '—'}</p>
        </article>
        <article className="overview-card">
          <h3 className="overview-card__title">
            <ShieldCheck size={18} aria-hidden />
            Leak alerts (1h)
          </h3>
          <p className="overview-card__value accent">
            {overview ? overview.leakAlertsLastHour : '—'}
          </p>
          <p className="overview-card__meta">Driven by anomaly detection on live flow.</p>
        </article>
        <article className="overview-card">
          <h3 className="overview-card__title">
            <Activity size={18} aria-hidden />
            Health score
          </h3>
          <p className="overview-card__value">
            {overview?.averageHealthScore ?? '—'}
          </p>
          <p className="overview-card__meta">Composite of battery, stability, and leak signals.</p>
        </article>
        <article className="overview-card">
          <h3 className="overview-card__title">
            <Clock3 size={18} aria-hidden />
            Last update
          </h3>
          <p className="overview-card__value">{formatTime(lastCycleAt)}</p>
          <p className="overview-card__meta">Refreshes automatically with simulator cycles.</p>
        </article>
      </div>
    </div>
  )
}

export default OverviewCards
