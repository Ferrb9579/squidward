import {
  emptyStateClass,
  panelBodyClass,
  panelClass,
  panelHeaderClass
} from '../styles/ui'
import type {
  Measurement,
  SensorState,
  WaterQualitySummary
} from '../types'

interface SensorDetailsProps {
  sensor?: SensorState
  measurements: Measurement[]
  waterQuality?: WaterQualitySummary
  waterQualityLoading?: boolean
  onRefreshWaterQuality?: () => void
}

const formatDateTime = (value?: Date) => {
  if (!value) return '—'
  return value.toLocaleString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const metricLabels: Record<string, string> = {
  flowRateLpm: 'Flow (L/min)',
  pressureBar: 'Pressure (bar)',
  levelPercent: 'Level (%)',
  temperatureCelsius: 'Temperature (°C)',
  ph: 'pH',
  turbidityNTU: 'Turbidity (NTU)',
  conductivityUsCm: 'Conductivity (µS/cm)',
  batteryPercent: 'Battery (%)',
  healthScore: 'Health score'
}

const formatStatusLabel = (status: WaterQualitySummary['status']) =>
  status.charAt(0).toUpperCase() + status.slice(1)

const formatWaterQualityValue = (metric: WaterQualitySummary['metrics'][number]) => {
  if (metric.value === undefined || !Number.isFinite(metric.value)) {
    return '—'
  }

  const value =
    metric.metric === 'ph'
      ? metric.value.toFixed(2)
      : metric.metric === 'conductivityUsCm'
        ? Math.round(metric.value).toString()
        : metric.value.toFixed(1)

  return `${value}${metric.unit ? ` ${metric.unit}` : ''}`
}

const renderMetricValue = (value: number | boolean | undefined) => {
  if (value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (!Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? value : value.toFixed(1)
}

export const SensorDetails = ({
  sensor,
  measurements,
  waterQuality,
  waterQualityLoading,
  onRefreshWaterQuality
}: SensorDetailsProps) => {
  if (!sensor) {
    return (
      <div className={panelClass}>
        <div className={panelHeaderClass}>
          <h2 className="text-lg font-semibold text-slate-100">Sensor details</h2>
        </div>
        <div className={`${panelBodyClass} ${emptyStateClass}`}>
          <p>Select a sensor to view its telemetry timeline.</p>
        </div>
      </div>
    )
  }

  const latest = measurements[0]
  const detailMetrics = Object.entries({
    flowRateLpm: latest?.flowRateLpm ?? sensor.lastValues?.flowRateLpm,
    pressureBar: latest?.pressureBar ?? sensor.lastValues?.pressureBar,
    levelPercent: latest?.levelPercent ?? sensor.lastValues?.levelPercent,
    temperatureCelsius:
      latest?.temperatureCelsius ?? sensor.lastValues?.temperatureCelsius,
    ph: latest?.ph ?? sensor.lastValues?.ph,
    turbidityNTU: latest?.turbidityNTU ?? sensor.lastValues?.turbidityNTU,
    conductivityUsCm:
      latest?.conductivityUsCm ?? sensor.lastValues?.conductivityUsCm,
    batteryPercent: latest?.batteryPercent ?? sensor.lastValues?.batteryPercent,
    healthScore: latest?.healthScore ?? sensor.lastValues?.healthScore,
    leakDetected: latest?.leakDetected ?? sensor.lastValues?.leakDetected
  })

  const history = measurements.slice(0, 10)

  return (
    <div className={panelClass}>
      <div className={panelHeaderClass}>
        <h2 className="text-lg font-semibold text-slate-100">{sensor.name}</h2>
        <p className="text-sm text-slate-400">
          {sensor.zone.name} • {sensor.kind.toUpperCase()}
        </p>
      </div>
      <div className={`${panelBodyClass} max-h-[32rem] gap-5 overflow-y-auto`}>
        <section className="space-y-4 rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
            Live metrics
          </h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            {detailMetrics.map(([key, value]) => {
              if (key === 'leakDetected') return null
              const label = metricLabels[key] ?? key
              return (
                <div key={key} className="flex flex-col gap-1 rounded-lg bg-slate-900/40 p-3">
                  <dt className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">
                    {label}
                  </dt>
                  <dd className="text-sm font-semibold text-slate-100">
                    {renderMetricValue(value as number | undefined)}
                  </dd>
                </div>
              )
            })}
            <div className="flex flex-col gap-1 rounded-lg bg-slate-900/40 p-3">
              <dt className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">
                Leak status
              </dt>
              <dd className="text-sm font-semibold text-slate-100">
                {renderMetricValue(
                  detailMetrics.find(([key]) => key === 'leakDetected')?.[1] as
                    | boolean
                    | undefined
                )}
              </dd>
            </div>
          </dl>
        </section>
        <section className="space-y-4 rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
              Water quality
            </h3>
            {onRefreshWaterQuality && (
              <button
                type="button"
                onClick={onRefreshWaterQuality}
                disabled={waterQualityLoading}
                className={`text-xs font-semibold uppercase tracking-widest transition ${
                  waterQualityLoading
                    ? 'cursor-not-allowed text-slate-500'
                    : 'text-sky-300 hover:text-sky-200'
                }`}
              >
                {waterQualityLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            )}
          </div>
          {waterQualityLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-600 border-t-sky-300" />
              Updating water quality…
            </div>
          )}
          {waterQuality ? (
            <div className="space-y-3">
              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold ${
                  waterQuality.status === 'contaminated'
                    ? 'bg-rose-500/15 text-rose-200 border border-rose-500/40'
                    : waterQuality.status === 'warning'
                      ? 'bg-amber-500/15 text-amber-200 border border-amber-500/40'
                      : waterQuality.status === 'safe'
                        ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40'
                        : 'bg-slate-800/40 text-slate-200 border border-slate-700/40'
                }`}
              >
                <span>
                  {waterQuality.status === 'missing'
                    ? 'No water quality data yet'
                    : `Status: ${formatStatusLabel(waterQuality.status)}`}
                </span>
                {waterQuality.measuredAt && (
                  <span className="text-xs font-normal text-slate-300">
                    Updated {formatDateTime(waterQuality.measuredAt)}
                  </span>
                )}
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                {waterQuality.metrics.map((metric) => (
                  <div
                    key={metric.metric}
                    className="flex flex-col gap-1 rounded-lg border border-slate-800/60 bg-slate-900/50 p-3"
                  >
                    <dt className="text-[0.6rem] uppercase tracking-[0.25em] text-slate-400">
                      {metric.label}
                    </dt>
                    <dd className="text-sm font-semibold text-slate-100">
                      {formatWaterQualityValue(metric)}
                    </dd>
                    <dd
                      className={`text-xs ${
                        metric.status === 'contaminated'
                          ? 'text-rose-300'
                          : metric.status === 'warning'
                            ? 'text-amber-200'
                            : metric.status === 'safe'
                              ? 'text-emerald-200'
                              : 'text-slate-400'
                      }`}
                    >
                      {metric.message}
                    </dd>
                    <dd className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                      Range: {metric.recommendedRange}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-300">
              No water quality samples reported for this sensor yet.
            </div>
          )}
        </section>
        <section className="space-y-4 rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
            Recent timeline
          </h3>
          <ul className="space-y-3">
            {history.length === 0 ? (
              <li className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-4 text-center text-sm text-slate-400">
                Awaiting measurements for this sensor.
              </li>
            ) : (
              history.map((entry) => (
                <li
                  key={entry.id}
                  className="space-y-2 rounded-lg border border-slate-700/40 bg-slate-900/40 p-4"
                >
                  <span className="text-xs text-slate-400">
                    {formatDateTime(entry.timestamp)}
                  </span>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                    {entry.flowRateLpm !== undefined && (
                      <span>{entry.flowRateLpm.toFixed(0)} L/min</span>
                    )}
                    {entry.pressureBar !== undefined && (
                      <span>{entry.pressureBar.toFixed(2)} bar</span>
                    )}
                    {entry.levelPercent !== undefined && (
                      <span>{entry.levelPercent.toFixed(1)}%</span>
                    )}
                    {entry.ph !== undefined && (
                      <span>pH {entry.ph.toFixed(2)}</span>
                    )}
                    {entry.turbidityNTU !== undefined && (
                      <span>{entry.turbidityNTU.toFixed(1)} NTU</span>
                    )}
                    {entry.conductivityUsCm !== undefined && (
                      <span>{Math.round(entry.conductivityUsCm)} µS/cm</span>
                    )}
                    {entry.healthScore !== undefined && (
                      <span>Health {entry.healthScore}</span>
                    )}
                    {entry.leakDetected && (
                      <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-orange-200">
                        Leak?
                      </span>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="space-y-4 rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
            Metadata
          </h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">
                Installed
              </dt>
              <dd className="text-sm text-slate-200">{formatDateTime(sensor.createdAt)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">
                Last service
              </dt>
              <dd className="text-sm text-slate-200">{formatDateTime(sensor.updatedAt)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">
                Coordinates
              </dt>
              <dd className="text-sm text-slate-200">
                {sensor.location.latitude.toFixed(5)}, {sensor.location.longitude.toFixed(5)}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">
                Status
              </dt>
              <dd className="text-sm text-slate-200">{sensor.isActive ? 'Active' : 'Offline'}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  )
}

export default SensorDetails
