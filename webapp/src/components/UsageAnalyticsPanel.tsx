import { useMemo } from 'react'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  TimeScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type ScatterDataPoint,
  type TooltipItem
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { Line } from 'react-chartjs-2'
import {
  buttonBaseClass,
  emptyStateClass,
  panelBodyClass,
  panelClass,
  panelHeaderClass,
  panelSectionClass
} from '../styles/ui'
import type { UsageAnalytics } from '../types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  TimeScale
)

interface UsageAnalyticsPanelProps {
  analytics?: UsageAnalytics
  isLoading: boolean
  onRefresh: () => void
}

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
  const flowChartData = useMemo<ChartData<'line', ScatterDataPoint[]> | null>(() => {
    if (!analytics) return null
    const points = analytics.hourly
      .filter((point) => point.avgFlowLpm !== undefined)
      .map((point) => ({
        x: point.hour.getTime(),
        y: point.avgFlowLpm as number
      }))

    if (points.length < 2) {
      return null
    }

    return {
      datasets: [
        {
          label: 'Average Flow',
          data: points,
          parsing: false,
          tension: 0.35,
          fill: 'origin',
          borderColor: 'rgba(56, 189, 248, 0.8)',
          backgroundColor: 'rgba(56, 189, 248, 0.18)',
          pointRadius: 0,
          pointHitRadius: 10,
          borderWidth: 2
        }
      ]
    }
  }, [analytics])

  const flowChartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'minute',
            displayFormats: {
              minute: 'HH:mm'
            }
          },
          ticks: {
            color: 'rgba(148, 163, 184, 0.85)'
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.15)'
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: 'rgba(148, 163, 184, 0.85)',
            callback: (value: string | number) => `${value} L/min`
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.12)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          intersect: false,
          mode: 'index',
          callbacks: {
            label: (context: TooltipItem<'line'>) =>
              context.parsed.y !== undefined
                ? `${context.parsed.y.toFixed(1)} L/min`
                : '—'
          }
        }
      }
    }),
    []
  )

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
    <div className={panelClass}>
      <div className={`${panelHeaderClass} gap-3 md:flex-row md:items-start md:justify-between`}>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-100">Usage analytics</h2>
          <p className="text-sm text-slate-400">
            Flow, pressure, and reservoir insight over the last few hours.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
            {analytics ? formatDateRange(analytics.windowStart, analytics.windowEnd) : '—'}
          </span>
          <button type="button" className={buttonBaseClass} onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>
  <div className={`${panelBodyClass} gap-5`}>
        {isLoading ? (
          <div className={emptyStateClass}>Loading usage analytics…</div>
        ) : showEmptyState ? (
          <div className={emptyStateClass}>No analytics data yet. Waiting on measurements.</div>
        ) : analytics ? (
          <div className="flex flex-wrap gap-4">
            <section className={`${panelSectionClass} basis-full`}>
              <header className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-100">Flow trend</h3>
                <span className="text-xs text-slate-400">
                  Latest avg: {formatNumber(latestFlow, 1)} L/min
                </span>
              </header>
              {flowChartData ? (
                <div className="relative h-48 w-full">
                  <Line data={flowChartData} options={flowChartOptions} />
                </div>
              ) : (
                <p className="text-sm text-slate-400">Not enough readings for a trend line.</p>
              )}
            </section>
            <section className={panelSectionClass}>
              <header className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">Zones by flow</h3>
              </header>
              {analytics.zoneFlow.length === 0 ? (
                <p className="text-sm text-slate-400">Awaiting zone measurements.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {analytics.zoneFlow.map((zone) => {
                    const width = maxZoneFlow > 0 ? (zone.avgFlowLpm / maxZoneFlow) * 100 : 0
                    return (
                      <li key={zone.zoneId} className="space-y-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-3 text-sm text-slate-300">
                          <span className="min-w-0 flex-1 truncate" title={zone.zoneName}>
                            {zone.zoneName}
                          </span>
                          <strong className="shrink-0 rounded-md bg-slate-800/70 px-2 py-0.5 text-base text-slate-100">
                            {formatNumber(zone.avgFlowLpm, 1)} L/min
                          </strong>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800/80">
                          <span
                            className="block h-full rounded-full bg-sky-400/70"
                            style={{ width: `${Math.max(width, 4)}%` }}
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          Peak {formatNumber(zone.peakFlowLpm, 1)} L/min · {zone.sensorsReporting} sensors
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
            <section className={panelSectionClass}>
              <header className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">Top flow events</h3>
              </header>
              {analytics.topFlowEvents.length === 0 ? (
                <p className="text-sm text-slate-400">No recent flow spikes.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {analytics.topFlowEvents.map((event) => (
                    <li
                      key={`${event.sensorId}-${event.timestamp.toISOString()}`}
                      className="rounded-lg border border-slate-700/40 bg-slate-900/50 p-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-3 text-sm text-slate-200">
                        <strong className="shrink-0 rounded-md bg-slate-800/70 px-2 py-0.5 text-base text-slate-100">
                          {formatNumber(event.value, 0)} L/min
                        </strong>
                        <span className="min-w-0 flex-1 truncate" title={event.sensorName}>
                          {event.sensorName}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                        <span>{event.zone.name}</span>
                        <span title={event.timestamp.toLocaleString()} className="shrink-0">
                          {formatRelative(event.timestamp)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className={panelSectionClass}>
              <header className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">Pressure extremes</h3>
              </header>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                    Highest
                  </h4>
                  {analytics.pressureExtremes.max ? (
                    <div className="rounded-lg border border-slate-700/40 bg-slate-900/50 p-3 text-sm text-slate-200">
                      <strong className="block text-base text-slate-100">
                        {formatNumber(analytics.pressureExtremes.max.value, 2)} bar
                      </strong>
                      <span>{analytics.pressureExtremes.max.sensorName}</span>
                      <span className="block text-xs text-slate-400">
                        {analytics.pressureExtremes.max.zone.name}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">—</p>
                  )}
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                    Lowest
                  </h4>
                  {analytics.pressureExtremes.min ? (
                    <div className="rounded-lg border border-slate-700/40 bg-slate-900/50 p-3 text-sm text-slate-200">
                      <strong className="block text-base text-slate-100">
                        {formatNumber(analytics.pressureExtremes.min.value, 2)} bar
                      </strong>
                      <span>{analytics.pressureExtremes.min.sensorName}</span>
                      <span className="block text-xs text-slate-400">
                        {analytics.pressureExtremes.min.zone.name}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">—</p>
                  )}
                </div>
              </div>
            </section>
            <section className={panelSectionClass}>
              <header className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">Reservoir watch</h3>
              </header>
              {analytics.lowReservoirs.length === 0 ? (
                <p className="text-sm text-slate-400">All reservoirs above 35% capacity.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {analytics.lowReservoirs.map((entry) => (
                    <li
                      key={`${entry.sensorId}-${entry.timestamp.toISOString()}`}
                      className="rounded-lg border border-slate-700/40 bg-slate-900/50 p-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-3 text-sm text-slate-200">
                        <span className="min-w-0 flex-1 truncate font-medium" title={entry.sensorName}>
                          {entry.sensorName}
                        </span>
                        <strong className="shrink-0 rounded-md bg-slate-800/70 px-2 py-0.5 text-base text-slate-100">
                          {formatNumber(entry.value, 1)}%
                        </strong>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                        <span>{entry.zone.name}</span>
                        <span title={entry.timestamp.toLocaleString()} className="shrink-0">
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
