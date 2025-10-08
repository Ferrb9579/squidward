import { useEffect, useMemo, useRef, type ReactElement } from 'react'
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  MapPin,
  OctagonAlert,
  RefreshCw
} from 'lucide-react'
import {
  badgeBaseClass,
  buttonBaseClass,
  emptyStateClass,
  panelBodyClass,
  panelClass,
  panelHeaderClass,
  primaryButtonClass
} from '../styles/ui'
import type { LeakAlert } from '../types'

interface AlertCenterProps {
  alerts: LeakAlert[]
  isLoading?: boolean
  onRefresh: () => void
  onAcknowledge: (alertId: string) => void
  onResolve: (alertId: string) => void
  onFocusSensor?: (sensorId: string) => void
}

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit'
})

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto'
})

const SECONDS_IN_MINUTE = 60
const SECONDS_IN_HOUR = SECONDS_IN_MINUTE * 60
const SECONDS_IN_DAY = SECONDS_IN_HOUR * 24

const formatSince = (date: Date) => {
  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  if (Math.abs(deltaSeconds) < SECONDS_IN_MINUTE) {
    return relativeFormatter.format(deltaSeconds, 'second')
  }
  if (Math.abs(deltaSeconds) < SECONDS_IN_HOUR) {
    return relativeFormatter.format(Math.round(deltaSeconds / SECONDS_IN_MINUTE), 'minute')
  }
  if (Math.abs(deltaSeconds) < SECONDS_IN_DAY) {
    return relativeFormatter.format(Math.round(deltaSeconds / SECONDS_IN_HOUR), 'hour')
  }
  return relativeFormatter.format(Math.round(deltaSeconds / SECONDS_IN_DAY), 'day')
}

const severityLabel: Record<LeakAlert['severity'], string> = {
  warning: 'Warning',
  critical: 'Critical'
}

const severityClassName: Record<LeakAlert['severity'], string> = {
  warning: `${badgeBaseClass} border border-orange-400/60 bg-orange-500/20 text-orange-100`,
  critical: `${badgeBaseClass} border border-rose-500/60 bg-rose-500/20 text-rose-100`
}

const severityIcon: Record<LeakAlert['severity'], ReactElement> = {
  warning: <AlertTriangle size={14} aria-hidden />,
  critical: <OctagonAlert size={14} aria-hidden />
}

const metricLabel: Record<LeakAlert['metric'], string> = {
  flowRateLpm: 'Flow anomaly',
  pressureBar: 'Pressure spike',
  levelPercent: 'Level drop',
  composite: 'Composite signal',
  offline: 'Sensor offline'
}

const metricUnits: Partial<Record<LeakAlert['metric'], string>> = {
  flowRateLpm: ' L/min',
  pressureBar: ' bar',
  levelPercent: '%'
}

const formatValue = (value?: number, unit?: string) =>
  value === undefined ? null : `${Math.round(value * 10) / 10}${unit ?? ''}`

const AlertList = ({
  items,
  onAcknowledge,
  onResolve,
  onFocusSensor
}: {
  items: LeakAlert[]
  onAcknowledge: (alertId: string) => void
  onResolve: (alertId: string) => void
  onFocusSensor?: (sensorId: string) => void
}) => (
  <ul className="flex flex-col gap-4">
    {items.map((alert) => (
      <li
        key={alert.id}
        className="flex flex-col gap-3 rounded-2xl border border-slate-700/45 bg-slate-900/75 p-4 shadow-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={severityClassName[alert.severity]}>
            {severityIcon[alert.severity]}
            {severityLabel[alert.severity]}
          </span>
          <span className="text-sm font-medium text-slate-200">{metricLabel[alert.metric]}</span>
          <span className="text-xs text-slate-400" title={alert.triggeredAt.toLocaleString()}>
            {formatSince(alert.triggeredAt)} • {timeFormatter.format(alert.triggeredAt)}
          </span>
        </div>
        <div className="space-y-3">
          <div className="text-sm text-slate-100">{alert.message}</div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">Sensor</dt>
              <dd className="text-sm text-slate-200">{alert.sensorName}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">Zone</dt>
              <dd className="text-sm text-slate-200">{alert.zone.name}</dd>
            </div>
            {alert.currentValue !== undefined && (
              <div className="flex flex-col gap-1">
                <dt className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">Current</dt>
                <dd className="text-sm text-slate-200">
                  {formatValue(alert.currentValue, metricUnits[alert.metric])}
                </dd>
              </div>
            )}
            {alert.baselineValue !== undefined && (
              <div className="flex flex-col gap-1">
                <dt className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">Baseline</dt>
                <dd className="text-sm text-slate-200">
                  {formatValue(alert.baselineValue, metricUnits[alert.metric])}
                </dd>
              </div>
            )}
            {alert.delta !== undefined && (
              <div className="flex flex-col gap-1">
                <dt className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">Change</dt>
                <dd className="text-sm text-slate-200">
                  {formatValue(alert.delta, metricUnits[alert.metric])}
                </dd>
              </div>
            )}
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          {onFocusSensor && (
            <button type="button" className={buttonBaseClass} onClick={() => onFocusSensor(alert.sensorId)}>
              <MapPin size={14} aria-hidden />
              View sensor
            </button>
          )}
          {!alert.acknowledged && (
            <button type="button" className={buttonBaseClass} onClick={() => onAcknowledge(alert.id)}>
              <CheckCircle2 size={14} aria-hidden />
              Acknowledge
            </button>
          )}
          {!alert.resolvedAt && (
            <button type="button" className={primaryButtonClass} onClick={() => onResolve(alert.id)}>
              <Clock3 size={14} aria-hidden />
              Mark resolved
            </button>
          )}
          {alert.acknowledged && (
            <span className="rounded-full bg-slate-800/60 px-3 py-1 text-xs uppercase tracking-widest text-slate-300">
              Acknowledged
              {alert.acknowledgedAt ? ` ${formatSince(alert.acknowledgedAt)}` : ''}
            </span>
          )}
          {alert.resolvedAt && (
            <span className="rounded-full bg-emerald-600/20 px-3 py-1 text-xs uppercase tracking-widest text-emerald-200">
              Resolved {formatSince(alert.resolvedAt)}
            </span>
          )}
        </div>
      </li>
    ))}
  </ul>
)

export const AlertCenter = ({
  alerts,
  isLoading = false,
  onRefresh,
  onAcknowledge,
  onResolve,
  onFocusSensor
}: AlertCenterProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null)

  const { activeAlerts, recentResolved } = useMemo(() => {
    const activeAlerts = alerts.filter((alert) => !alert.resolvedAt)
    const resolvedAlerts = alerts
      .filter((alert) => Boolean(alert.resolvedAt))
      .slice(0, 5)
    return { activeAlerts, recentResolved: resolvedAlerts }
  }, [alerts])

  const showEmptyState = !isLoading && activeAlerts.length === 0

  useEffect(() => {
    const activeElement = (typeof document !== 'undefined'
      ? document.activeElement
      : null) as HTMLElement | null
    if (!activeElement) return
    if (!rootRef.current) return
    if (rootRef.current.contains(activeElement) && typeof activeElement.blur === 'function') {
      activeElement.blur()
    }
  }, [alerts])

  return (
    <div ref={rootRef} className={`${panelClass} max-h-[28rem] overflow-hidden`}>
      <div className={`${panelHeaderClass} flex-col gap-3 lg:flex-row lg:items-start lg:justify-between`}>
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <BellRing size={18} aria-hidden />
            Alert center
          </h2>
          <p className="text-sm text-slate-400">
            Monitoring leak anomalies and device health notifications.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`${badgeBaseClass} border border-slate-600/60 bg-slate-800/60 text-slate-300`}
            data-active={activeAlerts.length > 0}
          >
            {activeAlerts.length} active
          </span>
          <button
            type="button"
            className={buttonBaseClass}
            onClick={onRefresh}
            aria-label="Refresh alerts"
          >
            <RefreshCw size={16} aria-hidden />
            Refresh
          </button>
        </div>
      </div>
  <div className={`${panelBodyClass} flex-1 overflow-y-auto pr-2`}>
        {isLoading ? (
          <div className={emptyStateClass}>Loading leak alerts…</div>
        ) : showEmptyState ? (
          <div className={emptyStateClass}>No active alerts. All clear for now.</div>
        ) : (
          <AlertList
            items={activeAlerts.length > 0 ? activeAlerts : recentResolved}
            onAcknowledge={onAcknowledge}
            onResolve={onResolve}
            onFocusSensor={onFocusSensor}
          />
        )}
        {activeAlerts.length > 0 && recentResolved.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 border-t border-slate-700/40 pt-4">
            <h3 className="text-sm font-semibold text-slate-300">Recently resolved</h3>
            <AlertList
              items={recentResolved}
              onAcknowledge={onAcknowledge}
              onResolve={onResolve}
              onFocusSensor={onFocusSensor}
            />
          </div>
        )}
      </div>
    </div>
  )
}
