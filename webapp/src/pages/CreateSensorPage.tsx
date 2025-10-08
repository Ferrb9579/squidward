import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
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

const RecenterMap = ({ position }: { position?: { lat: number; lng: number } }) => {
  const map = useMap()
  const previousPosition = useRef<{ lat: number; lng: number } | undefined>(undefined)

  useEffect(() => {
    if (!position) return
    if (
      previousPosition.current &&
      position.lat === previousPosition.current.lat &&
      position.lng === previousPosition.current.lng
    ) {
      return
    }
    previousPosition.current = position
    map.flyTo([position.lat, position.lng], map.getZoom(), { duration: 0.5 })
  }, [map, position])

  return null
}

const existingSensorIcon = L.divIcon({
  className: 'existing-sensor-marker',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#38bdf8;border:2px solid rgba(15,23,42,0.85);"></div>`
})

interface SearchResult {
  place_id: string
  display_name: string
  lat: string
  lon: string
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
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(initialCenter)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [successSensor, setSuccessSensor] = useState<SensorState | undefined>(
    undefined
  )
  const [isLocating, setIsLocating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | undefined>(undefined)
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

  useEffect(() => {
    if (!location) {
      setMapCenter(initialCenter)
    }
  }, [initialCenter, location])

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.')
      return
    }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
        setLocation(coords)
        setMapCenter(coords)
        setError(undefined)
        setIsLocating(false)
      },
      (geoError) => {
        console.error('Geolocation failed', geoError)
        setIsLocating(false)
        setError('Unable to access current location.')
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!searchQuery.trim()) {
      setSearchResults([])
      setSearchError('Enter a location to search for.')
      return
    }

    setIsSearching(true)
    setSearchError(undefined)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=5`
      )
      if (!response.ok) {
        throw new Error(`Search failed (${response.status})`)
      }
      const results = (await response.json()) as SearchResult[]
      setSearchResults(results)
      if (results.length === 0) {
        setSearchError('No matches found for that query.')
      }
    } catch (searchException) {
      console.error('Location search failed', searchException)
      setSearchError(
        searchException instanceof Error
          ? searchException.message
          : 'Unable to search for location.'
      )
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectResult = (result: SearchResult) => {
    const coords = {
      lat: Number.parseFloat(result.lat),
      lng: Number.parseFloat(result.lon)
    }
    setLocation(coords)
    setMapCenter(coords)
    setSearchResults([])
    setError(undefined)
    setSearchError(undefined)
    setSearchQuery(result.display_name)
  }

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
          <div className="flex flex-col gap-3 border-b border-slate-800/40 bg-slate-900/30 p-6 text-sm">
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSearch}>
              <label className="sr-only" htmlFor="search-location">
                Search for a location
              </label>
              <input
                id="search-location"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  if (searchError) setSearchError(undefined)
                }}
                placeholder="Search for a place or address"
                className="flex-1 rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSearching}
                className={`${buttonBaseClass} flex-shrink-0 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isSearching ? 'Searching…' : 'Search'}
              </button>
            </form>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className={`${buttonBaseClass} w-full px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto`}
            >
              {isLocating ? 'Locating…' : 'Use current location'}
            </button>
            {searchError ? (
              <p className="text-sm text-red-400">{searchError}</p>
            ) : null}
            {searchResults.length > 0 ? (
              <div className="rounded-md border border-slate-800/60 bg-slate-900/70">
                <ul className="divide-y divide-slate-800/60">
                  {searchResults.map((result) => (
                    <li key={result.place_id} className="p-3">
                      <button
                        type="button"
                        onClick={() => handleSelectResult(result)}
                        className="text-left text-sm text-slate-100 hover:text-sky-400"
                      >
                        {result.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <MapContainer
            key={sensors.length ? 'sensor-centred' : 'fallback-centre'}
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={17}
            className="h-[420px] w-full"
            scrollWheelZoom
            style={{ background: '#0f172a' }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <RecenterMap position={mapCenter} />
            {sensors.map((sensor) => (
              <Marker
                key={sensor.id}
                position={[sensor.location.latitude, sensor.location.longitude]}
                icon={existingSensorIcon}
              />
            ))}
            <LocationSelector
              onSelect={(lat, lng) => {
                const coords = { lat, lng }
                setLocation(coords)
                setMapCenter(coords)
                setError(undefined)
              }}
              position={location}
            />
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
