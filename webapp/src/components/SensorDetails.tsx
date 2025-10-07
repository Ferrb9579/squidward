import type { Measurement, SensorState } from '../types'

interface SensorDetailsProps {
  sensor?: SensorState
  measurements: Measurement[]
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
  batteryPercent: 'Battery (%)',
  healthScore: 'Health score'
}

const renderMetricValue = (value: number | boolean | undefined) => {
  if (value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (!Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? value : value.toFixed(1)
}

export const SensorDetails = ({ sensor, measurements }: SensorDetailsProps) => {
  if (!sensor) {
    return (
      <div className="panel sensor-details">
        <div className="panel__header">
          <h2>Sensor details</h2>
        </div>
        <div className="panel__body panel__body--empty">
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
    batteryPercent: latest?.batteryPercent ?? sensor.lastValues?.batteryPercent,
    healthScore: latest?.healthScore ?? sensor.lastValues?.healthScore,
    leakDetected: latest?.leakDetected ?? sensor.lastValues?.leakDetected
  })

  const history = measurements.slice(0, 10)

  return (
    <div className="panel sensor-details">
      <div className="panel__header">
        <h2>{sensor.name}</h2>
        <p className="panel__subtext">
          {sensor.zone.name} • {sensor.kind.toUpperCase()}
        </p>
      </div>
      <div className="panel__body sensor-details__body">
        <section className="sensor-details__section">
          <h3>Live metrics</h3>
          <dl className="sensor-details__metrics">
            {detailMetrics.map(([key, value]) => {
              if (key === 'leakDetected') return null
              const label = metricLabels[key] ?? key
              return (
                <div key={key} className="sensor-details__metric">
                  <dt>{label}</dt>
                  <dd>{renderMetricValue(value as number | undefined)}</dd>
                </div>
              )
            })}
            <div className="sensor-details__metric">
              <dt>Leak status</dt>
              <dd>
                {renderMetricValue(
                  detailMetrics.find(([key]) => key === 'leakDetected')?.[1] as
                    | boolean
                    | undefined
                )}
              </dd>
            </div>
          </dl>
        </section>
        <section className="sensor-details__section">
          <h3>Recent timeline</h3>
          <ul className="sensor-details__timeline">
            {history.length === 0 ? (
              <li className="sensor-details__timeline-empty">
                Awaiting measurements for this sensor.
              </li>
            ) : (
              history.map((entry) => (
                <li key={entry.id}>
                  <span className="sensor-details__timeline-time">
                    {formatDateTime(entry.timestamp)}
                  </span>
                  <div className="sensor-details__timeline-values">
                    {entry.flowRateLpm !== undefined && (
                      <span>{entry.flowRateLpm.toFixed(0)} L/min</span>
                    )}
                    {entry.pressureBar !== undefined && (
                      <span>{entry.pressureBar.toFixed(2)} bar</span>
                    )}
                    {entry.levelPercent !== undefined && (
                      <span>{entry.levelPercent.toFixed(1)}%</span>
                    )}
                    {entry.healthScore !== undefined && (
                      <span>Health {entry.healthScore}</span>
                    )}
                    {entry.leakDetected && <span className="tag tag--alert">Leak?</span>}
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="sensor-details__section">
          <h3>Metadata</h3>
          <dl className="sensor-details__meta">
            <div>
              <dt>Installed</dt>
              <dd>{formatDateTime(sensor.createdAt)}</dd>
            </div>
            <div>
              <dt>Last service</dt>
              <dd>{formatDateTime(sensor.updatedAt)}</dd>
            </div>
            <div>
              <dt>Coordinates</dt>
              <dd>
                {sensor.location.latitude.toFixed(5)},
                {' '}
                {sensor.location.longitude.toFixed(5)}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{sensor.isActive ? 'Active' : 'Offline'}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  )
}

export default SensorDetails
