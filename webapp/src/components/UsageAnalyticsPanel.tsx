import { useMemo } from 'react'
import type { UsageAnalytics } from '../types'

interface UsageAnalyticsPanelProps {
  analytics?: UsageAnalytics
  isLoading: boolean
  onRefresh: () => void
}

const formatHour = (date: Date) =>
  date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })

const formatDateRange = (start?: Date, end?: Date) => {
  if (!start || !end) return '—'
  const startStr = start.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  const endStr = end.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${startStr} → ${endStr}`
}

const formatNumber = (value?: number, digits = 1) =>
  value === undefined || Number.isNaN(value)
    ? '—'
    : Number(value).toFixed(digits)

const useFlowChartPoints = (analytics?: UsageAnalytics) => {
  return useMemo(() => {
    if (!analytics) return []
    const flowPoints = analytics.hourly.filter(
      (point) => point.avgFlowLpm !== undefined
    )
    if (flowPoints.length === 0) return []

    const maxFlow = Math.max(...flowPoints.map((point) => point.avgFlowLpm ?? 0))
    if (maxFlow <= 0) return []

    const minTime = flowPoints[0]?.hour.getTime() ?? 0
    const maxTime = flowPoints[flowPoints.length - 1]?.hour.getTime() ?? minTime
    const span = Math.max(maxTime - minTime, 1)

    return flowPoints.map((point) => {
      const x = ((point.hour.getTime() - minTime) / span) * 100
      const y = 100 - ((point.avgFlowLpm ?? 0) / maxFlow) * 90 - 5
      return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }
    })
  }, [analytics])
}

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto'
})

const formatRelative = (date: Date) => {
  const deltaMinutes = Math.round((date.getTime() - Date.now()) / (60 * 1000))
  if (Math.abs(deltaMinutes) < 60) {
    return relativeFormatter.format(deltaMinutes, 'minute')
  }
  return relativeFormatter.format(Math.round(deltaMinutes / 60), 'hour')
}

export const UsageAnalyticsPanel = ({
  analytics,
  isLoading,
  onRefresh
}: UsageAnalyticsPanelProps) => {
  const chartPoints = useFlowChartPoints(analytics)
  const maxZoneFlow = useMemo(() => {
    if (!analytics || analytics.zoneFlow.length === 0) return 0
    return Math.max(...analytics.zoneFlow.map((zone) => zone.avgFlowLpm))
  }, [analytics])
  const latestFlow = useMemo(() => {
    if (!analytics) return undefined
    const copy = [...analytics.hourly]
    for (let index = copy.length - 1; index >= 0; index -= 1) {
      const value = copy[index]?.avgFlowLpm
      if (value !== undefined && value !== null) {
        return value
      }
    }
    return undefined
  }, [analytics])

  const showEmptyState = !isLoading && !analytics

  return (
    <div className="panel usage-analytics">
      <div className="panel__header usage-analytics__header">
        <div>
          <h2>Usage analytics</h2>
          <p className="panel__subtext">
            Flow, pressure, and reservoir insight over the last day.
          </p>
        </div>
        <div className="usage-analytics__meta">
          <span className="usage-analytics__range">
            {analytics ? formatDateRange(analytics.windowStart, analytics.windowEnd) : '—'}
          </span>
          <button type="button" className="usage-analytics__refresh" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>
      <div className="panel__body usage-analytics__body">
        {isLoading ? (
          <div className="panel__body--empty">
            <p>Loading usage analytics…</p>
          </div>
        ) : showEmptyState ? (
          <div className="panel__body--empty">
            <p>No analytics data yet. Waiting on measurements.</p>
          </div>
        ) : analytics ? (
          <div className="usage-analytics__grid">
            <section className="usage-analytics__section usage-analytics__section--primary">
              <header>
                <h3>Flow trend</h3>
                <span className="usage-analytics__trend-label">
                  Latest avg: {formatNumber(latestFlow, 1)} L/min
                </span>
              </header>
              {chartPoints.length > 1 ? (
                <div className="usage-analytics__chart">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polyline points={chartPoints.map((p) => `${p.x},${p.y}`).join(' ')} />
                  </svg>
                  <div className="usage-analytics__chart-axis">
                    {analytics.hourly.slice(-6).map((point) => (
                      <span key={point.hour.toISOString()}>{formatHour(point.hour)}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="usage-analytics__chart-empty">Not enough readings for a trend line.</p>
              )}
            </section>
            <section className="usage-analytics__section">
              <header>
                <h3>Zones by flow</h3>
              </header>
              {analytics.zoneFlow.length === 0 ? (
                <p className="usage-analytics__empty">Awaiting zone measurements.</p>
              ) : (
                <ul className="usage-analytics__zones">
                  {analytics.zoneFlow.map((zone) => {
                    const width = maxZoneFlow > 0 ? (zone.avgFlowLpm / maxZoneFlow) * 100 : 0
                    return (
                      <li key={zone.zoneId}>
                        <div className="usage-analytics__zone-header">
                          <span>{zone.zoneName}</span>
                          <span>{formatNumber(zone.avgFlowLpm, 1)} L/min</span>
                        </div>
                        <div className="usage-analytics__zone-bar">
                          <span style={{ width: `${Math.max(width, 4)}%` }} />
                        </div>
                        <div className="usage-analytics__zone-meta">
                          Peak {formatNumber(zone.peakFlowLpm, 1)} L/min · {zone.sensorsReporting} sensors
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
            <section className="usage-analytics__section">
              <header>
                <h3>Top flow events</h3>
              </header>
              {analytics.topFlowEvents.length === 0 ? (
                <p className="usage-analytics__empty">No recent flow spikes.</p>
              ) : (
                <ul className="usage-analytics__events">
                  {analytics.topFlowEvents.map((event) => (
                    <li key={`${event.sensorId}-${event.timestamp.toISOString()}`}>
                      <div className="usage-analytics__event-main">
                        <strong>{formatNumber(event.value, 0)} L/min</strong>
                        <span>{event.sensorName}</span>
                      </div>
                      <div className="usage-analytics__event-meta">
                        <span>{event.zone.name}</span>
                        <span title={event.timestamp.toLocaleString()}>
                          {formatRelative(event.timestamp)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="usage-analytics__section">
              <header>
                <h3>Pressure extremes</h3>
              </header>
              <div className="usage-analytics__extremes">
                <div>
                  <h4>Highest</h4>
                  {analytics.pressureExtremes.max ? (
                    <div className="usage-analytics__extreme-card">
                      <strong>{formatNumber(analytics.pressureExtremes.max.value, 2)} bar</strong>
                      <span>{analytics.pressureExtremes.max.sensorName}</span>
                      <span>{analytics.pressureExtremes.max.zone.name}</span>
                    </div>
                  ) : (
                    <p className="usage-analytics__empty">—</p>
                  )}
                </div>
                <div>
                  <h4>Lowest</h4>
                  {analytics.pressureExtremes.min ? (
                    <div className="usage-analytics__extreme-card">
                      <strong>{formatNumber(analytics.pressureExtremes.min.value, 2)} bar</strong>
                      <span>{analytics.pressureExtremes.min.sensorName}</span>
                      <span>{analytics.pressureExtremes.min.zone.name}</span>
                    </div>
                  ) : (
                    <p className="usage-analytics__empty">—</p>
                  )}
                </div>
              </div>
            </section>
            <section className="usage-analytics__section">
              <header>
                <h3>Reservoir watch</h3>
              </header>
              {analytics.lowReservoirs.length === 0 ? (
                <p className="usage-analytics__empty">All reservoirs above 35% capacity.</p>
              ) : (
                <ul className="usage-analytics__reservoirs">
                  {analytics.lowReservoirs.map((entry) => (
                    <li key={`${entry.sensorId}-${entry.timestamp.toISOString()}`}>
                      <div className="usage-analytics__reservoir-main">
                        <span>{entry.sensorName}</span>
                        <strong>{formatNumber(entry.value, 1)}%</strong>
                      </div>
                      <div className="usage-analytics__reservoir-meta">
                        <span>{entry.zone.name}</span>
                        <span title={entry.timestamp.toLocaleString()}>
                          {formatRelative(entry.timestamp)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
