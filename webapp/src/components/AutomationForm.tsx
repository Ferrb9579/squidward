import { useEffect, useMemo, useState } from 'react'
import {
  buttonBaseClass,
  panelBodyClass,
  panelClass,
  panelHeaderClass
} from '../styles/ui'
import type {
  AutomationComparison,
  AutomationHttpMethod,
  AutomationMetric,
  SensorAutomation
} from '../types'

export interface AutomationFormValues {
  name: string
  description: string
  metric: AutomationMetric
  comparison: AutomationComparison
  threshold: string
  action: string
  targetMethod: AutomationHttpMethod
  targetUrl: string
  targetSensorId: string
  payloadTemplate: string
  headers: string
  timeoutMs: string
  cooldownSeconds: string
  enabled: boolean
}

const metricOptions: Array<{ value: AutomationMetric; label: string; isBoolean: boolean }> = [
  { value: 'flowRateLpm', label: 'Flow rate (L/min)', isBoolean: false },
  { value: 'pressureBar', label: 'Pressure (bar)', isBoolean: false },
  { value: 'levelPercent', label: 'Level (%)', isBoolean: false },
  { value: 'temperatureCelsius', label: 'Temperature (°C)', isBoolean: false },
  { value: 'batteryPercent', label: 'Battery (%)', isBoolean: false },
  { value: 'healthScore', label: 'Health score', isBoolean: false },
  { value: 'leakDetected', label: 'Leak detected state', isBoolean: true }
]

const comparisonOptions: Array<{ value: AutomationComparison; label: string }> = [
  { value: 'lt', label: 'Less than (<)' },
  { value: 'lte', label: 'Less than or equal (≤)' },
  { value: 'gt', label: 'Greater than (>)' },
  { value: 'gte', label: 'Greater than or equal (≥)' },
  { value: 'eq', label: 'Equal to (=)' },
  { value: 'neq', label: 'Not equal (!=)' }
]

const methodOptions: Array<{ value: AutomationHttpMethod; label: string }> = [
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'GET', label: 'GET' },
  { value: 'DELETE', label: 'DELETE' }
]

const isBooleanMetric = (metric: AutomationMetric) =>
  metricOptions.find((option) => option.value === metric)?.isBoolean ?? false

const defaultValues: AutomationFormValues = {
  name: '',
  description: '',
  metric: 'flowRateLpm',
  comparison: 'lt',
  threshold: '',
  action: '',
  targetMethod: 'POST',
  targetUrl: '',
  targetSensorId: '',
  payloadTemplate: '',
  headers: '',
  timeoutMs: '8000',
  cooldownSeconds: '30',
  enabled: true
}

interface AutomationFormProps {
  mode: 'create' | 'edit'
  initialValues?: AutomationFormValues
  onSubmit: (values: AutomationFormValues) => Promise<void> | void
  onCancel?: () => void
  isSubmitting?: boolean
  submitLabel?: string
  errorMessage?: string
}

export const AutomationForm = ({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
  errorMessage
}: AutomationFormProps) => {
  const [values, setValues] = useState<AutomationFormValues>(initialValues ?? defaultValues)
  const [localError, setLocalError] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (initialValues) {
      setValues(initialValues)
    }
  }, [initialValues])

  const metricIsBoolean = useMemo(() => isBooleanMetric(values.metric), [values.metric])

  useEffect(() => {
    setLocalError(undefined)
  }, [values])

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = event.target
    if (type === 'checkbox') {
      const input = event.target as HTMLInputElement
      setValues((prev) => ({
        ...prev,
        [name]: input.checked
      }))
      return
    }

    setValues((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const handleMetricChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMetric = event.target.value as AutomationMetric
    setValues((prev) => ({
      ...prev,
      metric: nextMetric,
      threshold: isBooleanMetric(nextMetric)
        ? prev.threshold === 'false'
          ? 'false'
          : 'true'
        : prev.threshold && prev.threshold !== 'true' && prev.threshold !== 'false'
          ? prev.threshold
          : ''
    }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!values.name.trim()) {
      setLocalError('Name is required.')
      return
    }
    if (!values.targetUrl.trim()) {
      setLocalError('Target URL is required.')
      return
    }
    if (!metricIsBoolean && !values.threshold.trim()) {
      setLocalError('Threshold is required for numeric metrics.')
      return
    }

    setLocalError(undefined)
    await onSubmit(values)
  }

  const effectiveError = localError ?? errorMessage

  return (
    <form
      onSubmit={handleSubmit}
      className={`${panelClass} overflow-hidden border border-slate-700/40 bg-slate-900/60`}
    >
      <div className={`${panelHeaderClass} border-b border-slate-800/60`}>Automation details</div>
      <div className={`${panelBodyClass} gap-6`}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Name
            </span>
            <input
              name="name"
              value={values.name}
              onChange={handleChange}
              placeholder="Reservoir low - start pump"
              className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Action (optional)
            </span>
            <input
              name="action"
              value={values.action}
              onChange={handleChange}
              placeholder="start-pump"
              className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Description (optional)
            </span>
            <textarea
              name="description"
              value={values.description}
              onChange={handleChange}
              rows={2}
              placeholder="Describe what this automation controls."
              className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr,1fr,1fr]">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Metric
            </span>
            <select
              name="metric"
              value={values.metric}
              onChange={handleMetricChange}
              className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none"
            >
              {metricOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Comparison
            </span>
            <select
              name="comparison"
              value={values.comparison}
              onChange={handleChange}
              className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none"
            >
              {comparisonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Threshold
            </span>
            {metricIsBoolean ? (
              <select
                name="threshold"
                value={values.threshold === 'false' ? 'false' : 'true'}
                onChange={handleChange}
                className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none"
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : (
              <input
                name="threshold"
                value={values.threshold}
                onChange={handleChange}
                type="number"
                step="any"
                placeholder="e.g. 35"
                className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none"
              />
            )}
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              HTTP method
            </span>
            <select
              name="targetMethod"
              value={values.targetMethod}
              onChange={handleChange}
              className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none"
            >
              {methodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Target URL
            </span>
            <input
              name="targetUrl"
              value={values.targetUrl}
              onChange={handleChange}
              placeholder="https://automation-service/sensors/pump"
              className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none"
              required
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Target sensor ID (optional)
            </span>
            <input
              name="targetSensorId"
              value={values.targetSensorId}
              onChange={handleChange}
              placeholder="pump-controller"
              className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Timeout (ms)
            </span>
            <input
              name="timeoutMs"
              value={values.timeoutMs}
              onChange={handleChange}
              type="number"
              min={100}
              step={100}
              className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Cooldown (seconds)
            </span>
            <input
              name="cooldownSeconds"
              value={values.cooldownSeconds}
              onChange={handleChange}
              type="number"
              min={0}
              step={1}
              className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-200">
            <input
              type="checkbox"
              name="enabled"
              checked={values.enabled}
              onChange={handleChange}
              className="h-4 w-4 rounded border-slate-700/60 bg-slate-950/60 text-sky-400 focus:ring-sky-400"
            />
            Enabled
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Headers JSON (optional)
            </span>
            <textarea
              name="headers"
              value={values.headers}
              onChange={handleChange}
              rows={4}
              placeholder='{"Authorization":"Bearer ..."}'
              className="min-h-[120px] rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none"
            />
            <span className="text-xs text-slate-500">
              Provide a JSON object of header key/value pairs.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Payload template JSON (optional)
            </span>
            <textarea
              name="payloadTemplate"
              value={values.payloadTemplate}
              onChange={handleChange}
              rows={4}
              placeholder='{"command":"start"}'
              className="min-h-[120px] rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none"
            />
            <span className="text-xs text-slate-500">
              These fields merge with the default automation payload when triggering.
            </span>
          </label>
        </div>

        {effectiveError ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {effectiveError}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className={`${buttonBaseClass} justify-center bg-transparent text-sm`}
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`${buttonBaseClass} justify-center bg-sky-500/20 text-sm disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {isSubmitting ? (mode === 'create' ? 'Creating…' : 'Saving…') : submitLabel ?? (mode === 'create' ? 'Create automation' : 'Save changes')}
          </button>
        </div>
      </div>
    </form>
  )
}

export const toFormValues = (automation?: SensorAutomation): AutomationFormValues => {
  if (!automation) {
    return { ...defaultValues, threshold: '' }
  }

  const headers = automation.headers
    ? JSON.stringify(automation.headers, null, 2)
    : ''
  const payloadTemplate = automation.payloadTemplate
    ? JSON.stringify(automation.payloadTemplate, null, 2)
    : ''

  return {
    name: automation.name,
    description: automation.description ?? '',
    metric: automation.metric,
    comparison: automation.comparison,
    threshold:
      typeof automation.threshold === 'boolean'
        ? automation.threshold
          ? 'true'
          : 'false'
        : String(automation.threshold),
    action: automation.action ?? '',
    targetMethod: automation.targetMethod,
    targetUrl: automation.targetUrl,
    targetSensorId: automation.targetSensorId ?? '',
    payloadTemplate,
    headers,
    timeoutMs: String(automation.timeoutMs ?? 8000),
    cooldownSeconds: String(automation.cooldownSeconds ?? 0),
    enabled: automation.enabled
  }
}

export const defaultAutomationFormValues = defaultValues
