import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { listApiKeys, createApiKey, deleteApiKey, type ApiKeySummary } from '../api/apiKeys'
import { buttonBaseClass, panelClass, panelHeaderClass } from '../styles/ui'
import { useDashboardStore } from '../store/dashboardStore'

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const formatRelative = (date?: Date) => {
  if (!date) return '—'
  const deltaMs = date.getTime() - Date.now()
  const deltaMinutes = Math.round(deltaMs / (60 * 1000))
  if (Math.abs(deltaMinutes) < 60) {
    return relativeFormatter.format(deltaMinutes, 'minute')
  }
  const deltaHours = Math.round(deltaMinutes / 60)
  if (Math.abs(deltaHours) < 48) {
    return relativeFormatter.format(deltaHours, 'hour')
  }
  return date.toLocaleString()
}

const ApiKeysPage = () => {
  const sensors = useDashboardStore((state) => state.sensors)
  const initialize = useDashboardStore((state) => state.initialize)
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)
  const [newKey, setNewKey] = useState<string | undefined>(undefined)
  const [formLabel, setFormLabel] = useState('')
  const [formSensorId, setFormSensorId] = useState('')
  const [creating, setCreating] = useState(false)

  const sensorOptions = useMemo(
    () =>
      sensors
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((sensor) => ({ id: sensor.id, name: sensor.name })),
    [sensors]
  )

  const loadKeys = async () => {
    setLoading(true)
    setError(undefined)
    try {
      const items = await listApiKeys()
      setApiKeys(items)
    } catch (loadError) {
      console.error('Failed to load API keys', loadError)
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load API keys'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadKeys()
  }, [])

  useEffect(() => {
    if (!sensors.length) {
      void initialize()
    }
  }, [initialize, sensors.length])

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formLabel.trim()) {
      setError('Provide a descriptive label for the API key.')
      return
    }
    setCreating(true)
    setError(undefined)
    try {
      const result = await createApiKey({
        label: formLabel.trim(),
        sensorId: formSensorId || undefined
      })
      setApiKeys((prev) => [result.apiKey, ...prev])
      setNewKey(result.key)
      setFormLabel('')
      setFormSensorId('')
    } catch (createError) {
      console.error('Failed to create API key', createError)
      setError(
        createError instanceof Error
          ? createError.message
          : 'Unable to create API key'
      )
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (apiKeyId: string) => {
    const shouldDelete = window.confirm('Revoke this API key? Devices using it will stop reporting data.')
    if (!shouldDelete) return
    try {
      await deleteApiKey(apiKeyId)
      setApiKeys((prev) => prev.filter((item) => item.id !== apiKeyId))
    } catch (deleteError) {
      console.error('Failed to delete API key', deleteError)
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to delete API key'
      )
    }
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-slate-100">API keys</h2>
        <p className="text-sm text-slate-400">
          Provision keys for IoT devices to authenticate against <code className="rounded bg-slate-900 px-1.5 py-0.5 text-slate-200">POST /sensor/&lt;sensor_id&gt;</code>.
        </p>
      </header>
      <section className={`${panelClass} p-6`}>
        <form className="flex flex-col gap-4" onSubmit={handleCreate}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
            <div className="flex-1">
              <label htmlFor="label" className="block text-sm font-medium text-slate-200">
                Label
              </label>
              <input
                id="label"
                value={formLabel}
                onChange={(event) => setFormLabel(event.target.value)}
                placeholder="West quad telemetry pod"
                className="mt-1 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="sensor" className="block text-sm font-medium text-slate-200">
                Bind to sensor (optional)
              </label>
              <select
                id="sensor"
                value={formSensorId}
                onChange={(event) => setFormSensorId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              >
                <option value="">Any sensor</option>
                {sensorOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={creating}
              className={`${buttonBaseClass} sm:h-fit ${creating ? 'opacity-70' : ''}`}
            >
              <Plus size={16} />
              {creating ? 'Creating…' : 'Create key'}
            </button>
          </div>
        </form>
        {newKey && (
          <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <p className="font-semibold">Copy this API key now</p>
            <p className="mt-1 text-xs text-emerald-200">
              This is the only time it will be shown. Store it securely and pass it to the IoT device.
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-2 font-mono text-base">
              <span className="truncate" title={newKey}>
                {newKey}
              </span>
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-wide text-emerald-100"
                onClick={() => navigator.clipboard.writeText(newKey).catch(() => {})}
              >
                Copy
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-100">
            {error}
          </div>
        )}
      </section>
      <section className={`${panelClass} p-0`}>
        <div className={`${panelHeaderClass} border-b border-slate-800/50 pb-3`}>Provisioned keys</div>
        {loading ? (
          <div className="px-6 py-8 text-sm text-slate-400">Loading API keys…</div>
        ) : apiKeys.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-400">No API keys created yet.</div>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-800/50">
            {apiKeys.map((key) => {
              const boundSensor = sensors.find((sensor) => sensor.id === key.sensorId)
              return (
                <li key={key.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-100">{key.label}</p>
                    <p className="text-xs text-slate-400">
                      Preview: <code className="rounded bg-slate-900 px-1.5 py-0.5">{key.preview}</code>
                    </p>
                    <p className="text-xs text-slate-500">
                      Created {formatRelative(key.createdAt)} · Last used {formatRelative(key.lastUsedAt)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Scope: {boundSensor ? boundSensor.name : 'Any sensor'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 transition hover:border-rose-500/60 hover:text-rose-200"
                    onClick={() => handleDelete(key.id)}
                  >
                    <Trash2 size={14} />
                    Revoke
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default ApiKeysPage
