import { useEffect, useMemo, useState } from 'react'
import { Trash2, Plus, RefreshCcw, Edit2, Power } from 'lucide-react'
import {
  buttonBaseClass,
  emptyStateClass,
  panelBodyClass,
  panelClass,
  panelHeaderClass,
  panelSectionClass
} from '../styles/ui'
import { useAutomationStore } from '../store/automationStore'
import { AutomationForm, type AutomationFormValues, toFormValues, defaultAutomationFormValues } from '../components/AutomationForm'
import type { AutomationComparison, AutomationMetric, SensorAutomation } from '../types'

const booleanMetrics: AutomationMetric[] = ['leakDetected']

const parseThreshold = (metric: AutomationMetric, rawValue: string) => {
  if (booleanMetrics.includes(metric)) {
    const normalized = rawValue.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
    throw new Error('Threshold must be true or false for leak-detected automations.')
  }

  const value = Number(rawValue)
  if (!Number.isFinite(value)) {
    throw new Error('Threshold must be a numeric value.')
  }
  return value
}

const parseHeadersForCreate = (text: string) => {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Headers must be a JSON object.')
    }
    const headers = Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof value !== 'string') {
        throw new Error('Header values must be strings.')
      }
      acc[key] = value
      return acc
    }, {})
    return Object.keys(headers).length ? headers : undefined
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid headers JSON: ${error.message}`)
    }
    throw new Error('Invalid headers JSON.')
  }
}

const parseHeadersForUpdate = (text: string) => {
  const trimmed = text.trim()
  if (!trimmed) return null
  return parseHeadersForCreate(text) ?? null
}

const parsePayloadForCreate = (text: string) => {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Payload template must be a JSON object.')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid payload template JSON: ${error.message}`)
    }
    throw new Error('Invalid payload template JSON.')
  }
}

const parsePayloadForUpdate = (text: string) => {
  const trimmed = text.trim()
  if (!trimmed) return null
  return parsePayloadForCreate(text) ?? null
}

const prepareTimeout = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Timeout must be a positive number of milliseconds.')
  }
  return Math.round(parsed)
}

const prepareCooldown = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Cooldown must be zero or a positive number of seconds.')
  }
  return Math.round(parsed)
}

const automationStatusBadge = (automation: SensorAutomation) => {
  const parts = [] as string[]
  if (automation.enabled) {
    parts.push('Enabled')
  } else {
    parts.push('Disabled')
  }
  if (automation.lastTriggeredAt) {
    parts.push(`Last triggered ${automation.lastTriggeredAt.toLocaleString()}`)
  } else {
    parts.push('Never triggered')
  }
  return parts.join(' • ')
}

const AutomationCard = ({
  automation,
  onEdit,
  onDelete,
  onToggleEnabled,
  isMutating
}: {
  automation: SensorAutomation
  onEdit: (automation: SensorAutomation) => void
  onDelete: (automation: SensorAutomation) => void
  onToggleEnabled: (automation: SensorAutomation) => void
  isMutating: boolean
}) => {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-5 text-sm text-slate-200 shadow-lg shadow-slate-950/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100">{automation.name}</h3>
          {automation.description ? (
            <p className="text-xs text-slate-400">{automation.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleEnabled(automation)}
            disabled={isMutating}
            className={`${buttonBaseClass} flex items-center gap-1 bg-slate-800/60 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Power size={14} />
            {automation.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            type="button"
            onClick={() => onEdit(automation)}
            disabled={isMutating}
            className={`${buttonBaseClass} flex items-center gap-1 bg-sky-500/20 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Edit2 size={14} /> Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(automation)}
            disabled={isMutating}
            className={`${buttonBaseClass} flex items-center gap-1 bg-rose-500/10 px-3 py-1 text-xs hover:border-rose-400/60 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 text-xs text-slate-300 md:grid-cols-2">
        <div className="space-y-1">
          <p>
            <span className="font-semibold text-slate-200">Metric:</span> {automation.metric}
          </p>
          <p>
            <span className="font-semibold text-slate-200">Comparison:</span> {automation.comparison}
          </p>
          <p>
            <span className="font-semibold text-slate-200">Threshold:</span> {String(automation.threshold)}
          </p>
        </div>
        <div className="space-y-1">
          <p>
            <span className="font-semibold text-slate-200">HTTP:</span> {automation.targetMethod} → {automation.targetUrl}
          </p>
          {automation.targetSensorId ? (
            <p>
              <span className="font-semibold text-slate-200">Target sensor:</span> {automation.targetSensorId}
            </p>
          ) : null}
          <p>
            <span className="font-semibold text-slate-200">Timeout:</span> {automation.timeoutMs} ms • <span className="font-semibold text-slate-200">Cooldown:</span> {automation.cooldownSeconds} s
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-400">{automationStatusBadge(automation)}</p>
    </div>
  )
}

const AutomationsPage = () => {
  const {
    sensors,
    automations,
    selectedSensorId,
    loadingSensors,
    loadingAutomations,
    isMutating,
    error,
    initialize,
    selectSensor,
    refreshAutomations,
    refreshSensors,
    createAutomation,
    updateAutomation,
    removeAutomation,
    clearError
  } = useAutomationStore()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState<SensorAutomation | null>(null)
  const [formError, setFormError] = useState<string | undefined>(undefined)
  const [localSaving, setLocalSaving] = useState(false)

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    if (!showCreateForm && !editingAutomation) {
      setFormError(undefined)
    }
  }, [showCreateForm, editingAutomation])

  const selectedSensor = useMemo(
    () => sensors.find((sensor) => sensor.id === selectedSensorId),
    [sensors, selectedSensorId]
  )

  const handleSelectSensor = (sensorId: string) => {
    clearError()
    setShowCreateForm(false)
    setEditingAutomation(null)
    selectSensor(sensorId)
  }

  const handleRefresh = () => {
    clearError()
    void refreshAutomations()
  }

  const handleRefreshSensors = () => {
    clearError()
    void refreshSensors()
  }

  const handleCreateClick = () => {
    clearError()
    setEditingAutomation(null)
    setShowCreateForm(true)
  }

  const handleCancelForm = () => {
    setShowCreateForm(false)
    setEditingAutomation(null)
    setFormError(undefined)
    clearError()
  }

  const convertCreatePayload = (values: AutomationFormValues) => {
    const threshold = parseThreshold(values.metric, values.threshold)
    const headers = parseHeadersForCreate(values.headers)
    const payloadTemplate = parsePayloadForCreate(values.payloadTemplate)
    const timeoutMs = prepareTimeout(values.timeoutMs)
    const cooldownSeconds = prepareCooldown(values.cooldownSeconds)

    return {
      name: values.name.trim(),
      description: values.description.trim() ? values.description.trim() : undefined,
      metric: values.metric,
      comparison: values.comparison,
      threshold,
      action: values.action.trim() ? values.action.trim() : undefined,
      targetMethod: values.targetMethod,
      targetUrl: values.targetUrl.trim(),
      targetSensorId: values.targetSensorId.trim() ? values.targetSensorId.trim() : undefined,
      payloadTemplate,
      headers,
      timeoutMs,
      cooldownSeconds,
      enabled: values.enabled
    }
  }

  const convertUpdatePayload = (values: AutomationFormValues) => {
    const threshold = values.threshold
      ? parseThreshold(values.metric, values.threshold)
      : undefined
    const headers = parseHeadersForUpdate(values.headers)
    const payloadTemplate = parsePayloadForUpdate(values.payloadTemplate)
    const timeoutMs = prepareTimeout(values.timeoutMs)
    const cooldownSeconds = prepareCooldown(values.cooldownSeconds)

    return {
      name: values.name.trim(),
      description: values.description.trim() ? values.description.trim() : null,
      metric: values.metric,
      comparison: values.comparison,
      threshold,
      action: values.action.trim() ? values.action.trim() : null,
      targetMethod: values.targetMethod,
      targetUrl: values.targetUrl.trim(),
      targetSensorId: values.targetSensorId.trim() ? values.targetSensorId.trim() : null,
      payloadTemplate,
      headers,
      timeoutMs,
      cooldownSeconds,
      enabled: values.enabled
    }
  }

  const handleCreateSubmit = async (values: AutomationFormValues) => {
    try {
      setLocalSaving(true)
      const payload = convertCreatePayload(values)
      const created = await createAutomation(payload)
      if (created) {
        setShowCreateForm(false)
        setFormError(undefined)
      }
    } catch (error) {
      if (error instanceof Error) {
        setFormError(error.message)
      } else {
        setFormError('Unable to create automation.')
      }
    } finally {
      setLocalSaving(false)
    }
  }

  const handleEditSubmit = async (values: AutomationFormValues) => {
    if (!editingAutomation) return
    try {
      setLocalSaving(true)
      const payload = convertUpdatePayload(values)
      const updated = await updateAutomation(editingAutomation.id, payload)
      if (updated) {
        setEditingAutomation(null)
        setFormError(undefined)
      }
    } catch (error) {
      if (error instanceof Error) {
        setFormError(error.message)
      } else {
        setFormError('Unable to update automation.')
      }
    } finally {
      setLocalSaving(false)
    }
  }

  const handleEdit = (automation: SensorAutomation) => {
    clearError()
    setShowCreateForm(false)
    setEditingAutomation(automation)
  }

  const handleDelete = (automation: SensorAutomation) => {
    clearError()
    const confirmed = window.confirm(
      `Delete automation "${automation.name}"? This cannot be undone.`
    )
    if (!confirmed) return
    void removeAutomation(automation.id)
  }

  const handleToggleEnabled = (automation: SensorAutomation) => {
    clearError()
    void updateAutomation(automation.id, { enabled: !automation.enabled })
  }

  const formInitialValues = useMemo(() => {
    if (editingAutomation) {
      return toFormValues(editingAutomation)
    }
    if (showCreateForm) {
      return {
        ...defaultAutomationFormValues,
        metric: 'levelPercent' as AutomationMetric,
  comparison: 'lt' as AutomationComparison,
        threshold: '35',
        timeoutMs: '8000',
        cooldownSeconds: '30',
        enabled: true
      }
    }
    return { ...defaultAutomationFormValues }
  }, [editingAutomation, showCreateForm])

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Sensor automations</h2>
            <p className="text-sm text-slate-400">
              Configure conditional actions that fire HTTP requests to downstream controllers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshSensors}
              className={`${buttonBaseClass} inline-flex items-center gap-2 bg-slate-800/60 px-3 py-2 text-sm`}
            >
              <RefreshCcw size={16} /> Sensors
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              className={`${buttonBaseClass} inline-flex items-center gap-2 bg-slate-800/60 px-3 py-2 text-sm`}
            >
              <RefreshCcw size={16} /> Automations
            </button>
            <button
              type="button"
              onClick={handleCreateClick}
              className={`${buttonBaseClass} inline-flex items-center gap-2 bg-sky-500/20 px-3 py-2 text-sm`}
            >
              <Plus size={16} /> New automation
            </button>
          </div>
        </div>
        {error ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="flex flex-col gap-4">
          <div className={`${panelClass} overflow-hidden`}>
            <div className={`${panelHeaderClass} border-b border-slate-800/60`}>Sensors</div>
            <div className={`${panelBodyClass} gap-3`}>
              {loadingSensors ? (
                <p className="text-sm text-slate-400">Loading sensors…</p>
              ) : sensors.length === 0 ? (
                <div className={emptyStateClass}>
                  <p>No sensors found. Create a sensor first to attach automations.</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {sensors.map((sensor) => {
                    const isSelected = sensor.id === selectedSensorId
                    return (
                      <li key={sensor.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectSensor(sensor.id)}
                          className={`${
                            isSelected
                              ? 'border-sky-400/70 bg-sky-500/10 text-slate-100'
                              : 'border-slate-800/70 text-slate-300 hover:border-sky-400/40 hover:text-slate-100'
                          } flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left transition`}
                        >
                          <span className="text-sm font-semibold">{sensor.name}</span>
                          <span className="text-xs text-slate-400">
                            {sensor.zone.name} • {sensor.kind.toUpperCase()}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </aside>

        <section className="flex flex-col gap-6">
          <div className={`${panelClass} overflow-hidden`}>
            <div className={`${panelHeaderClass} border-b border-slate-800/60`}>Automations</div>
            <div className={`${panelBodyClass} gap-4`}>
              {loadingAutomations ? (
                <p className="text-sm text-slate-400">Loading automations…</p>
              ) : !selectedSensor ? (
                <div className={emptyStateClass}>
                  <p>Select a sensor to view its automations.</p>
                </div>
              ) : automations.length === 0 ? (
                <div className={emptyStateClass}>
                  <p>No automations configured for {selectedSensor.name}.</p>
                  <button
                    type="button"
                    onClick={handleCreateClick}
                    className={`${buttonBaseClass} mt-2 bg-sky-500/20 text-sm`}
                  >
                    Add automation
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {automations.map((automation) => (
                    <AutomationCard
                      key={automation.id}
                      automation={automation}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleEnabled={handleToggleEnabled}
                      isMutating={isMutating}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {(showCreateForm || editingAutomation) && (
            <div className={panelSectionClass}>
              <h3 className="text-lg font-semibold text-slate-100">
                {editingAutomation ? `Edit automation: ${editingAutomation.name}` : 'Create automation'}
              </h3>
              <AutomationForm
                mode={editingAutomation ? 'edit' : 'create'}
                initialValues={formInitialValues}
                onSubmit={editingAutomation ? handleEditSubmit : handleCreateSubmit}
                onCancel={handleCancelForm}
                isSubmitting={localSaving || isMutating}
                submitLabel={editingAutomation ? 'Save changes' : 'Create automation'}
                errorMessage={formError}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default AutomationsPage
