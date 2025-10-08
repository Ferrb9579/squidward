import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import {
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Link } from 'react-router-dom'
import { buttonBaseClass, panelClass, panelHeaderClass } from '../styles/ui'
import type { SensorState } from '../types'
import { createSensor } from '../api/sensors'
import { useDashboardStore } from '../store/dashboardStore'

const selectionIcon = L.divIcon({
  className: 'sensor-selection-marker',
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#38bdf8;border:2px solid rgba(15,23,42,.9);"></div>`
})

interface LocationSelectorProps {
  onSelect: (lat: number, lng: number) => void
  position?: { lat: number; lng: number }
}

const LocationSelector = ({ onSelect, position }: LocationSelectorProps) => {
  useMapEvents({
    click: (event) => {
      onSelect(event.latlng.lat, event.latlng.lng)
    }
  })

  return position ? <Marker position={position} icon={selectionIcon} /> : null
}

const kinds: Array<{ value: SensorState['kind']; label: string }> = [
  { value: 'flow', label: 'Flow' },
  { value: 'pressure', label: 'Pressure' },
  { value: 'level', label: 'Level' },
  { value: 'composite', label: 'Composite' }
]

const defaultForm = {
  sensorId: '',
  name: '',
  kind: kinds[0]!.value,
  zoneId: '',
  zoneName: '',
  installDepthMeters: '',
  description: '',
  isActive: true
}

type FormState = typeof defaultForm

const clampNumber = (value: string) =>
  value.trim() ? Number.parseFloat(value) : undefined

const CreateSensorPage = () => {
  const sensors = useDashboardStore((state) => state.sensors)
  const refresh = useDashboardStore((state) => state.initialize)

  const initialCenter = useMemo(() => {
    if (sensors.length === 0) {
      return { lat: 10.935, lng: 76.744 }
    }
    const [first] = sensors
    return {
      lat: first.location.latitude,
      lng: first.location.longitude
    }
  }, [sensors])

  const [form, setForm] = useState<FormState>(defaultForm)
  const [location, setLocation] = useState<{ lat: number; lng: number } | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [successSensor, setSuccessSensor] = useState<SensorState | undefined>(
    undefined
  )
  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = event.target
    const nextValue =
      type === 'checkbox' && event.target instanceof HTMLInputElement
        ? event.target.checked
        : value
    setForm((prev) => ({
      ...prev,
      [name]: nextValue
    }))
  }

  useEffect(() => {
    if (!sensors.length) {
      void refresh()
    }
  }, [refresh, sensors.length])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    if (!location) {
      setError('Select a location on the map before creating the sensor.')
      return
    }
    if (!form.name.trim() || !form.zoneId.trim() || !form.zoneName.trim()) {
      setError('Name, zone ID, and zone name are required.')
      return
    }

    setError(undefined)
    setIsSubmitting(true)
    try {
      const sensor = await createSensor({
        id: form.sensorId.trim() ? form.sensorId.trim() : undefined,
        name: form.name.trim(),
        kind: form.kind,
        zone: { id: form.zoneId.trim(), name: form.zoneName.trim() },
        location: { latitude: location.lat, longitude: location.lng },
        installDepthMeters: clampNumber(form.installDepthMeters),
        description: form.description.trim() ? form.description.trim() : undefined,
        isActive: form.isActive
      })

      setSuccessSensor(sensor)
      setForm(defaultForm)
      setLocation(undefined)
      await refresh()
    } catch (submissionError) {
      console.error('Failed to create sensor', submissionError)
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to create sensor'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-slate-100">Create sensor</h2>
        <p className="text-sm text-slate-400">
          Click anywhere on the map to drop a sensor marker, then fill out the details below to create it.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className={`${panelClass} overflow-hidden`}>
          <div className={`${panelHeaderClass} border-b border-slate-800/50 pb-4`}>Location</div>
          <MapContainer
            key={sensors.length ? 'sensor-centred' : 'fallback-centre'}
            center={[initialCenter.lat, initialCenter.lng]}
            zoom={17}
            className="h-[420px] w-full"
            scrollWheelZoom
            style={{ background: '#0f172a' }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationSelector onSelect={(lat, lng) => setLocation({ lat, lng })} position={location} />
          </MapContainer>
          <div className="border-t border-slate-800/40 bg-slate-900/40 px-6 py-4 text-sm text-slate-300">
            {location ? (
              <div className="flex flex-col gap-1">
                <span>
                  Latitude: <strong>{location.lat.toFixed(6)}</strong>
                </span>
                <span>
                  Longitude: <strong>{location.lng.toFixed(6)}</strong>
                </span>
              </div>
            ) : (
              <span>Tap or click the map to set sensor coordinates.</span>
            )}
          </div>
        </div>
        <form
          onSubmit={handleSubmit}
          className={`${panelClass} flex flex-col gap-4 p-6`}
        >
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-200">
              Sensor name
            </label>
            <input
              id="name"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              placeholder="Karunya CSE Block Flow"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sensorId" className="block text-sm font-medium text-slate-200">
                Sensor ID (optional)
              </label>
              <input
                id="sensorId"
                name="sensorId"
                value={form.sensorId}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                placeholder="karunya-cse-block-flow"
              />
            </div>
            <div>
              <label htmlFor="kind" className="block text-sm font-medium text-slate-200">
                Sensor kind
              </label>
              <select
                id="kind"
                name="kind"
                value={form.kind}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              >
                {kinds.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="zoneId" className="block text-sm font-medium text-slate-200">
                Zone ID
              </label>
              <input
                id="zoneId"
                name="zoneId"
                value={form.zoneId}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                placeholder="karunya-cse"
              />
            </div>
            <div>
              <label htmlFor="zoneName" className="block text-sm font-medium text-slate-200">
                Zone name
              </label>
              <input
                id="zoneName"
                name="zoneName"
                value={form.zoneName}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                placeholder="Karunya CSE Block"
              />
            </div>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-200">
              Description (optional)
            </label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              placeholder="Primary distribution feed for the CSE academic block"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="installDepthMeters" className="block text-sm font-medium text-slate-200">
                Install depth (m)
              </label>
              <input
                id="installDepthMeters"
                name="installDepthMeters"
                value={form.installDepthMeters}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                placeholder="1.2"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={handleChange}
                className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-400"
              />
              <label htmlFor="isActive" className="text-sm text-slate-200">
                Sensor is active immediately
              </label>
            </div>
          </div>
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`${buttonBaseClass} ${isSubmitting ? 'opacity-70' : ''}`}
            >
              {isSubmitting ? 'Creating…' : 'Create sensor'}
            </button>
            <span className="text-xs text-slate-500">Location selection is required.</span>
          </div>
          {successSensor && (
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3 text-sm text-slate-200">
              <h3 className="text-base font-semibold text-slate-100">Sensor created</h3>
              <p className="mt-1 text-xs text-slate-400">
                ID: <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-100">{successSensor.id}</code>
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Consider generating an API key so the IoT device can report readings.
                <Link to="/api-keys" className="ml-2 font-semibold text-sky-300 hover:text-sky-200">
                  Manage API keys →
                </Link>
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default CreateSensorPage
