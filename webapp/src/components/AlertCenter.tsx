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
  warning: 'alert-badge alert-badge--warning',
  critical: 'alert-badge alert-badge--critical'
}

const severityIcon: Record<LeakAlert['severity'], ReactElement> = {
  warning: <AlertTriangle size={14} aria-hidden />,
  critical: <OctagonAlert size={14} aria-hidden />
}

const metricLabel: Record<LeakAlert['metric'], string> = {
  flowRateLpm: 'Flow anomaly',
  pressureBar: 'Pressure spike',
  levelPercent: 'Level drop',
  composite: 'Composite signal'
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
  <ul className="alert-center__list">
    {items.map((alert) => (
      <li key={alert.id} className="alert-item">
        <div className="alert-item__header">
          <span className={severityClassName[alert.severity]}>
            {severityIcon[alert.severity]}
            {severityLabel[alert.severity]}
          </span>
          <span className="alert-item__metric">{metricLabel[alert.metric]}</span>
          <span className="alert-item__time" title={alert.triggeredAt.toLocaleString()}>
            {formatSince(alert.triggeredAt)} • {timeFormatter.format(alert.triggeredAt)}
          </span>
        </div>
        <div className="alert-item__body">
          <div className="alert-item__message">{alert.message}</div>
          <dl className="alert-item__meta">
            <div>
              <dt>Sensor</dt>
              <dd>{alert.sensorName}</dd>
            </div>
            <div>
              <dt>Zone</dt>
              <dd>{alert.zone.name}</dd>
            </div>
            {alert.currentValue !== undefined && (
              <div>
                <dt>Current</dt>
                <dd>{formatValue(alert.currentValue, metricUnits[alert.metric])}</dd>
              </div>
            )}
            {alert.baselineValue !== undefined && (
              <div>
                <dt>Baseline</dt>
                <dd>{formatValue(alert.baselineValue, metricUnits[alert.metric])}</dd>
              </div>
            )}
            {alert.delta !== undefined && (
              <div>
                <dt>Change</dt>
                <dd>{formatValue(alert.delta, metricUnits[alert.metric])}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="alert-item__actions">
          {onFocusSensor && (
            <button
              type="button"
              className="alert-item__button"
              onClick={() => onFocusSensor(alert.sensorId)}
            >
              <MapPin size={14} aria-hidden />
              View sensor
            </button>
          )}
          {!alert.acknowledged && (
            <button
              type="button"
              className="alert-item__button"
              onClick={() => onAcknowledge(alert.id)}
            >
              <CheckCircle2 size={14} aria-hidden />
              Acknowledge
            </button>
          )}
          {!alert.resolvedAt && (
            <button
              type="button"
              className="alert-item__button alert-item__button--primary"
              onClick={() => onResolve(alert.id)}
            >
              <Clock3 size={14} aria-hidden />
              Mark resolved
            </button>
          )}
          {alert.acknowledged && (
            <span className="alert-item__acknowledged">
              Acknowledged
              {alert.acknowledgedAt
                ? ` ${formatSince(alert.acknowledgedAt)}`
                : ''}
            </span>
          )}
          {alert.resolvedAt && (
            <span className="alert-item__resolved">
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
    <div ref={rootRef} className="panel alert-center">
      <div className="panel__header alert-center__header">
        <div>
          <h2 className="panel__title">
            <BellRing size={18} aria-hidden />
            Leak alerts
          </h2>
          <p className="panel__subtext">
            Monitoring anomalies reported by the detection service.
          </p>
        </div>
        <div className="alert-center__toolbar">
          <span className="alert-center__badge" data-active={activeAlerts.length > 0}>
            {activeAlerts.length} active
          </span>
          <button
            type="button"
            className="alert-center__refresh"
            onClick={onRefresh}
            aria-label="Refresh alerts"
          >
            <RefreshCw size={16} aria-hidden />
            Refresh
          </button>
        </div>
      </div>
      <div className="panel__body alert-center__body">
        {isLoading ? (
          <div className="panel__body--empty">
            <p>Loading leak alerts…</p>
          </div>
        ) : showEmptyState ? (
          <div className="panel__body--empty">
            <p>No active leak alerts. All clear for now.</p>
          </div>
        ) : (
          <AlertList
            items={activeAlerts.length > 0 ? activeAlerts : recentResolved}
            onAcknowledge={onAcknowledge}
            onResolve={onResolve}
            onFocusSensor={onFocusSensor}
          />
        )}
        {activeAlerts.length > 0 && recentResolved.length > 0 && (
          <div className="alert-center__resolved">
            <h3>Recently resolved</h3>
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
