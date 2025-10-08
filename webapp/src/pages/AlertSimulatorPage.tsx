import { useEffect, useMemo, useState } from 'react'
import { fetchSensors } from '../api/dashboard'
import {
  simulateLeakAlert,
  type SimulateLeakAlertResult
} from '../api/alerts'
import type {
  LeakAlertMetric,
  LeakAlertSeverity,
  SensorState
} from '../types'
import {
  buttonBaseClass,
  panelBodyClass,
  panelClass,
  panelHeaderClass,
  panelSectionClass
} from '../styles/ui'

const metricOptions: Array<{ value: LeakAlertMetric; label: string; description: string }> = [
  {
    value: 'flowRateLpm',
    label: 'Flow rate spike',
    description: 'Detects sudden increases in litres-per-minute output.'
  },
  {
    value: 'pressureBar',
    label: 'Pressure surge',
    description: 'Flags unexpected bar-pressure increases.'
  },
  {
    value: 'levelPercent',
    label: 'Reservoir level drop',
    description: 'Alerts on sharp decreases in tank or reservoir level.'
  },
  {
    value: 'composite',
    label: 'Composite leak signature',
    description: 'Simulates the multi-metric leak classifier trigger.'
  },
  {
    value: 'offline',
    label: 'Sensor offline',
    description: 'Emits an outage alert for sensors that stop reporting.'
  }
]

const severityOptions: Array<{ value: LeakAlertSeverity; label: string }> = [
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' }
]

const formatDateTime = (value: Date) =>
  value.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium'
  })

const AlertSimulatorPage = () => {
  const [sensors, setSensors] = useState<SensorState[]>([])
  const [sensorsLoading, setSensorsLoading] = useState(true)
  const [sensorError, setSensorError] = useState<string>()

  const [selectedSensorId, setSelectedSensorId] = useState('')
  const [metric, setMetric] = useState<LeakAlertMetric>('flowRateLpm')
  const [severity, setSeverity] = useState<LeakAlertSeverity>('critical')
  const [message, setMessage] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [baselineValue, setBaselineValue] = useState('')
  const [delta, setDelta] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>()
  const [result, setResult] = useState<SimulateLeakAlertResult>()

  useEffect(() => {
    let cancelled = false
    const loadSensors = async () => {
      setSensorsLoading(true)
      setSensorError(undefined)
      try {
        const allSensors = await fetchSensors()
        if (cancelled) return
        setSensors(allSensors)
        if (allSensors.length > 0) {
          setSelectedSensorId((prev) => prev || allSensors[0]!.id)
        }
      } catch (error) {
        console.error('Failed to load sensors', error)
        if (!cancelled) {
          setSensorError(
            error instanceof Error
              ? error.message
              : 'Unable to load sensors from the API.'
          )
        }
      } finally {
        if (!cancelled) {
          setSensorsLoading(false)
        }
      }
    }

    void loadSensors()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedSensor = useMemo(
    () => sensors.find((sensor) => sensor.id === selectedSensorId),
    [sensors, selectedSensorId]
  )

  const parseNumberField = (label: string, value: string) => {
    if (!value.trim()) {
      return { ok: true, value: undefined as number | undefined }
    }

    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      setSubmitError(`${label} must be a number`)
      return { ok: false as const }
    }

    return { ok: true as const, value: parsed }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    if (!selectedSensorId) {
      setSubmitError('Select a sensor to simulate an alert for.')
      return
    }

    const currentValueParsed = parseNumberField('Current value', currentValue)
    if (!currentValueParsed.ok) return

    const baselineValueParsed = parseNumberField('Baseline value', baselineValue)
    if (!baselineValueParsed.ok) return

    const deltaParsed = parseNumberField('Delta', delta)
    if (!deltaParsed.ok) return

    setSubmitError(undefined)
    setIsSubmitting(true)
    try {
      const simulation = await simulateLeakAlert({
        sensorId: selectedSensorId,
        metric,
        severity,
        message: message.trim() || undefined,
        currentValue: currentValueParsed.value,
        baselineValue: baselineValueParsed.value,
        delta: deltaParsed.value
      })
      setResult(simulation)
    } catch (error) {
      console.error('Alert simulation failed', error)
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Failed to trigger the alert simulation.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-slate-100">Alert simulator</h2>
        <p className="text-sm text-slate-400">
          Trigger a manual leak alert for any sensor to verify downstream notifications, including email delivery and live dashboards.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <form className={`${panelClass} gap-0`} onSubmit={handleSubmit}>
          <div className={`${panelHeaderClass} border-b border-slate-800/50`}>Simulation details</div>
          <div className={`${panelBodyClass} gap-6`}>            
            <div className="flex flex-col gap-2">
              <label htmlFor="sensor-id" className="text-sm font-medium text-slate-200">
                Target sensor
              </label>
              <select
                id="sensor-id"
                value={selectedSensorId}
                onChange={(event) => setSelectedSensorId(event.target.value)}
                disabled={sensorsLoading}
                className="rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sensors.length === 0 ? (
                  <option value="" disabled>
                    {sensorsLoading ? 'Loading sensors…' : 'No sensors found'}
                  </option>
                ) : null}
                {sensors.map((sensor) => (
                  <option key={sensor.id} value={sensor.id}>
                    {sensor.name} · {sensor.zone.name}
                  </option>
                ))}
              </select>
              {sensorError ? (
                <p className="text-sm text-red-400">{sensorError}</p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="metric" className="text-sm font-medium text-slate-200">
                  Alert metric
                </label>
                <select
                  id="metric"
                  value={metric}
                  onChange={(event) => setMetric(event.target.value as LeakAlertMetric)}
                  className="rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                >
                  {metricOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400">
                  {metricOptions.find((option) => option.value === metric)?.description}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="severity" className="text-sm font-medium text-slate-200">
                  Severity
                </label>
                <select
                  id="severity"
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value as LeakAlertSeverity)}
                  className="rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                >
                  {severityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400">
                  Use "Critical" to fan out paging and escalations configured on email rules.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="current-value" className="text-sm font-medium text-slate-200">
                  Current value
                </label>
                <input
                  id="current-value"
                  inputMode="decimal"
                  value={currentValue}
                  onChange={(event) => setCurrentValue(event.target.value)}
                  placeholder={metric === 'offline' ? 'N/A' : 'e.g. 180'}
                  className="rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="baseline-value" className="text-sm font-medium text-slate-200">
                  Baseline value
                </label>
                <input
                  id="baseline-value"
                  inputMode="decimal"
                  value={baselineValue}
                  onChange={(event) => setBaselineValue(event.target.value)}
                  placeholder={metric === 'offline' ? 'N/A' : 'e.g. 95'}
                  className="rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="delta" className="text-sm font-medium text-slate-200">
                  Delta
                </label>
                <input
                  id="delta"
                  inputMode="decimal"
                  value={delta}
                  onChange={(event) => setDelta(event.target.value)}
                  placeholder={metric === 'offline' ? 'N/A' : 'e.g. 72'}
                  className="rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="message" className="text-sm font-medium text-slate-200">
                Alert message (optional)
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                className="rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                placeholder={`Manual alert copy shown to operators. Defaults to a template for ${selectedSensor?.name ?? 'the sensor'}.`}
              />
              <p className="text-xs text-slate-500">
                Leave blank to use the auto-generated phrasing for the chosen metric and sensor.
              </p>
            </div>

            {submitError ? (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {submitError}
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-slate-800/60 bg-slate-900/40 px-6 py-4">
            <div className="text-xs text-slate-500">
              Emails send only if SMTP is configured via <code className="rounded bg-slate-800/80 px-1 py-0.5 text-[11px]">EMAIL_*</code> variables.
            </div>
            <button
              type="submit"
              disabled={isSubmitting || sensorsLoading || !selectedSensorId}
              className={`${buttonBaseClass} px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isSubmitting ? 'Triggering…' : 'Trigger alert now'}
            </button>
          </div>
        </form>

        <div className={`${panelClass} gap-0`}>
          <div className={`${panelHeaderClass} border-b border-slate-800/50`}>Latest simulation</div>
          <div className={`${panelBodyClass} gap-4`}>
            {result ? (
              <div className="flex flex-col gap-4">
                <div className={`${panelSectionClass} gap-2`}>                  
                  <span className="text-sm font-semibold text-slate-100">
                    {result.alert.sensorName}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-full border border-slate-700/70 bg-slate-900/70 px-2 py-1 font-medium uppercase tracking-widest text-[11px]">
                      {result.alert.metric}
                    </span>
                    <span className={`rounded-full px-2 py-1 font-semibold uppercase tracking-widest text-[11px] ${
                      result.alert.severity === 'critical'
                        ? 'border border-red-500/70 bg-red-500/15 text-red-200'
                        : 'border border-yellow-500/60 bg-yellow-500/10 text-yellow-100'
                    }`}>
                      {result.alert.severity}
                    </span>
                    <span className="text-slate-500">
                      Triggered {formatDateTime(result.alert.triggeredAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{result.alert.message}</p>
                  <dl className="grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                    <div>
                      <dt className="font-semibold text-slate-300">Current</dt>
                      <dd>{result.alert.currentValue ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-300">Baseline</dt>
                      <dd>{result.alert.baselineValue ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-300">Delta</dt>
                      <dd>{result.alert.delta ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
                <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">
                  Email dispatch status:{' '}
                  <span
                    className={
                      result.emailDispatchScheduled
                        ? 'font-semibold text-green-300'
                        : 'font-semibold text-yellow-200'
                    }
                  >
                    {result.emailDispatchScheduled ? 'Queued for delivery' : 'Skipped — email not configured'}
                  </span>
                </div>
                <div className={`${panelSectionClass} text-sm text-slate-300`}>                  
                  <p className="font-semibold text-slate-100">Next steps</p>
                  <ul className="list-disc space-y-1 pl-5 text-slate-400">
                    <li>Check your inbox for the alert email (may take a few seconds).</li>
                    <li>Open the Alert Center on the dashboard to confirm the banner appears.</li>
                    <li>Monitor the live feed stream for the <code className="rounded bg-slate-800/80 px-1 py-0.5 text-[11px]">leak-alert</code> SSE event.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-slate-400">
                <span className="text-sm">No manual alerts yet.</span>
                <span className="text-xs">
                  Choose a sensor and trigger an alert to see the full payload and email diagnostics.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AlertSimulatorPage
