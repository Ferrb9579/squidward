import { Maximize2, Minimize2 } from 'lucide-react'
import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap
} from 'react-leaflet'
import {
  buttonBaseClass,
  emptyStateClass,
  panelBodyClass,
  panelClass,
  panelHeaderClass,
  panelSectionClass
} from '../styles/ui'
import type { SensorState } from '../types'

type MetricKey =
  | 'flowRateLpm'
  | 'pressureBar'
  | 'levelPercent'
  | 'temperatureCelsius'
  | 'ph'
  | 'turbidityNTU'
  | 'conductivityUsCm'
  | 'batteryPercent'
  | 'healthScore'
  | 'leakDetected'

const metricOrder: MetricKey[] = [
  'flowRateLpm',
  'pressureBar',
  'levelPercent',
  'temperatureCelsius',
  'ph',
  'turbidityNTU',
  'conductivityUsCm',
  'batteryPercent',
  'healthScore',
  'leakDetected'
]

const metricLabel: Record<MetricKey, string> = {
  flowRateLpm: 'Flow',
  pressureBar: 'Pressure',
  levelPercent: 'Level',
  temperatureCelsius: 'Temperature',
  ph: 'pH',
  turbidityNTU: 'Turbidity',
  conductivityUsCm: 'Conductivity',
  batteryPercent: 'Battery',
  healthScore: 'Health score',
  leakDetected: 'Leak'
}

const formatMetricValue = (key: MetricKey, value: number | boolean) => {
  if (value === undefined || value === null) return '—'
  switch (key) {
    case 'flowRateLpm':
      return `${Number(value).toFixed(0)} L/min`
    case 'pressureBar':
      return `${Number(value).toFixed(2)} bar`
    case 'levelPercent':
      return `${Number(value).toFixed(1)}%`
    case 'temperatureCelsius':
      return `${Number(value).toFixed(1)} °C`
    case 'ph':
      return Number(value).toFixed(2)
    case 'turbidityNTU':
      return `${Number(value).toFixed(1)} NTU`
    case 'conductivityUsCm':
      return `${Math.round(Number(value))} µS/cm`
    case 'batteryPercent':
      return `${Number(value).toFixed(0)}%`
    case 'healthScore':
      return Number(value).toFixed(0)
    case 'leakDetected':
      return value ? 'Detected' : 'Clear'
    default:
      return String(value)
  }
}

interface MapPanelProps {
  sensors: SensorState[]
  selectedSensorId?: string
  onSelect: (sensorId: string) => void
  isExpanded?: boolean
  onToggleExpand?: (expanded: boolean) => void
}

const kindColors: Record<SensorState['kind'], string> = {
  flow: '#06b6d4',
  pressure: '#f97316',
  level: '#22c55e',
  composite: '#a855f7'
}

const markerGlyphs: Record<SensorState['kind'], string> = {
  flow: 'F',
  pressure: 'P',
  level: 'L',
  composite: 'Σ'
}

const searchMarkerIcon = L.divIcon({
  className: 'search-result-marker',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#38bdf8;border:3px solid rgba(15,23,42,0.88);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 18],
  popupAnchor: [0, -12]
})

interface SearchResult {
  place_id: string
  display_name: string
  lat: string
  lon: string
}

const createSensorIcon = (sensor: SensorState, isSelected: boolean) => {
  const color = kindColors[sensor.kind] ?? '#38bdf8'
  const glyph = markerGlyphs[sensor.kind] ?? 'S'
  const width = isSelected ? 44 : 32
  const height = Math.round(width * 1.35)
  const className = `sensor-marker-icon${isSelected ? ' sensor-marker-icon--selected' : ''}`
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="${width}" height="${height}" aria-hidden="true" focusable="false">
      <path d="M12 1.8c-4.3 0-7.8 3.5-7.8 7.8 0 5.4 7.2 13.4 7.5 13.7a0.7 0.7 0 0 0 1 0c0.3-0.3 7.5-8.3 7.5-13.7 0-4.3-3.5-7.8-7.8-7.8Z" fill="${color}" stroke="rgba(15,23,42,0.85)" stroke-width="1.4" />
      <circle cx="12" cy="11.2" r="5.4" fill="rgba(15, 23, 42, 0.82)" />
      <text x="12" y="13.4" text-anchor="middle" font-family="'Inter',system-ui,-apple-system,'Segoe UI',sans-serif" font-size="7.5" font-weight="600" fill="#e2e8f0">${glyph}</text>
      <ellipse cx="12" cy="28.5" rx="6" ry="2.2" fill="rgba(15, 23, 42, 0.28)" />
    </svg>
  `

  return L.divIcon({
    html: svg,
    className,
    iconSize: [width, height],
    iconAnchor: [width / 2, height - 4],
    popupAnchor: [0, -(height * 0.45)]
  })
}

const RecenterOnSelection = ({
  sensor
}: {
  sensor?: SensorState
}) => {
  const map = useMap()
  const lastSensorId = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!sensor) return
    if (lastSensorId.current === sensor.id) {
      return
    }
    lastSensorId.current = sensor.id
    const { latitude, longitude } = sensor.location
    map.flyTo([latitude, longitude], 18, { duration: 0.6 })
    requestAnimationFrame(() => {
      map.getContainer().blur()
    })
  }, [sensor, map])
  return null
}

export const MapPanel = ({
  sensors,
  selectedSensorId,
  onSelect,
  isExpanded = false,
  onToggleExpand
}: MapPanelProps) => {
  const selectedSensor = useMemo(
    () => sensors.find((sensor) => sensor.id === selectedSensorId),
    [sensors, selectedSensorId]
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchError, setSearchError] = useState<string | undefined>(undefined)
  const [locationError, setLocationError] = useState<string | undefined>(undefined)
  const [isSearching, setIsSearching] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [searchMarker, setSearchMarker] = useState<
    { lat: number; lng: number; label?: string } | undefined
  >(undefined)

  const mapClassName = `w-full overflow-hidden rounded-2xl ${
    isExpanded ? 'flex-1 h-full min-h-[480px]' : 'h-[360px]'
  }`
  const initialSensor = useMemo(
    () => sensors.find((sensor) => sensor.isActive) ?? sensors[0],
    [sensors]
  )

  const initialCenterRef = useRef<[number, number] | null>(null)

  useEffect(() => {
    if (!initialSensor) {
      initialCenterRef.current = null
    }
  }, [initialSensor])

  if (initialSensor && !initialCenterRef.current) {
    initialCenterRef.current = [
      initialSensor.location.latitude,
      initialSensor.location.longitude
    ]
  }

  const center = initialCenterRef.current

  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current) return
    const handle = window.setTimeout(() => {
      mapRef.current?.invalidateSize()
    }, 120)
    return () => window.clearTimeout(handle)
  }, [isExpanded])

  const handleToggleExpand = () => {
    if (!onToggleExpand) return
    onToggleExpand(!isExpanded)
  }

  const flyToLocation = (lat: number, lng: number, zoom = 17) => {
    mapRef.current?.flyTo([lat, lng], zoom, { duration: 0.6 })
  }

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchQuery.trim()
    if (!query) {
      setSearchResults([])
      setSearchError('Enter a location to search for.')
      return
    }

    setIsSearching(true)
    setSearchError(undefined)
    setLocationError(undefined)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6`
      )
      if (!response.ok) {
        throw new Error(`Search failed (${response.status})`)
      }
      const results = (await response.json()) as SearchResult[]
      setSearchResults(results)
      if (results.length === 0) {
        setSearchError('No matches found for that query.')
      }
    } catch (error) {
      console.error('Map search failed', error)
      setSearchError(
        error instanceof Error ? error.message : 'Unable to search for that location.'
      )
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectResult = (result: SearchResult) => {
    const lat = Number.parseFloat(result.lat)
    const lng = Number.parseFloat(result.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setSearchError('The selected result does not have valid coordinates.')
      return
    }
    setSearchMarker({ lat, lng, label: result.display_name })
    setSearchResults([])
    setSearchQuery(result.display_name)
    setSearchError(undefined)
    setLocationError(undefined)
    flyToLocation(lat, lng)
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported in this browser.')
      return
    }

    setIsLocating(true)
    setLocationError(undefined)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setSearchMarker({ lat, lng, label: 'Current location' })
        setSearchResults([])
        setSearchQuery('')
        setIsLocating(false)
        flyToLocation(lat, lng)
      },
      (error) => {
        console.error('Geolocation failed', error)
        setIsLocating(false)
        setLocationError('Unable to access current location.')
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const popupMetrics = (sensor?: SensorState) => {
    if (!sensor?.lastValues) return []
    return metricOrder
      .map((key) => {
        const raw = sensor.lastValues?.[key as keyof typeof sensor.lastValues]
        if (raw === undefined) return null
        return {
          key,
          label: metricLabel[key],
          value: formatMetricValue(key, raw)
        }
      })
      .filter(Boolean) as Array<{ key: MetricKey; label: string; value: string }>
  }

  if (!initialSensor || !center) {
    return (
      <div className={`${panelClass} ${isExpanded ? 'h-full w-full flex-1' : ''}`}>
        <div className={panelHeaderClass}>
          <h2 className="text-lg font-semibold text-slate-100">Campus map</h2>
        </div>
        <div className={`${panelBodyClass} ${emptyStateClass}`}>
          <p>No sensors available yet. Data will appear once the simulator seeds sensors.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${panelClass} ${isExpanded ? 'h-full w-full flex-1' : ''}`}>
      <div className={`${panelHeaderClass} gap-3 md:flex-row md:items-start md:justify-between`}>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Campus map</h2>
          <p className="text-sm text-slate-400">Click a marker to inspect a sensor.</p>
        </div>
        {onToggleExpand && (
          <button
            type="button"
            onClick={handleToggleExpand}
            className={`${buttonBaseClass} text-xs`}
            aria-label={isExpanded ? 'Exit full-screen map' : 'Expand map to full-screen'}
          >
            {isExpanded ? (
              <>
                <Minimize2 size={14} aria-hidden />
                Exit full view
              </>
            ) : (
              <>
                <Maximize2 size={14} aria-hidden />
                Fullscreen
              </>
            )}
          </button>
        )}
      </div>
      <div className={`${panelBodyClass} flex-1`}>
        <div className={`${panelSectionClass} text-sm text-slate-200`}>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSearchSubmit}>
            <label htmlFor="map-search-input" className="sr-only">
              Search for a location
            </label>
            <input
              id="map-search-input"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                if (searchError) setSearchError(undefined)
              }}
              placeholder="Search campus landmarks or addresses"
              className="flex-1 rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
              disabled={isSearching}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={isSearching}
                className={`${buttonBaseClass} justify-center text-sm disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isSearching ? 'Searching…' : 'Search'}
              </button>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                className={`${buttonBaseClass} justify-center text-sm disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isLocating ? 'Locating…' : 'Use current location'}
              </button>
            </div>
          </form>
          {searchError ? (
            <p className="text-xs text-red-400">{searchError}</p>
          ) : null}
          {locationError ? (
            <p className="text-xs text-red-400">{locationError}</p>
          ) : null}
          {searchMarker ? (
            <p className="text-xs text-slate-300">
              Showing pin at {searchMarker.label ?? `${searchMarker.lat.toFixed(5)}, ${searchMarker.lng.toFixed(5)}`}
            </p>
          ) : null}
          {searchResults.length > 0 ? (
            <ul className="max-h-44 overflow-y-auto rounded-lg border border-slate-800/60 bg-slate-900/80">
              {searchResults.map((result) => (
                <li key={result.place_id} className="border-b border-slate-800/60 last:border-none">
                  <button
                    type="button"
                    onClick={() => handleSelectResult(result)}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-slate-800/60"
                  >
                    {result.display_name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <MapContainer
          center={center}
          zoom={17}
          className={mapClassName}
          scrollWheelZoom
          keyboard={false}
          ref={(instance) => {
            mapRef.current = instance
          }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterOnSelection sensor={selectedSensor} />
          {searchMarker ? (
            <Marker position={[searchMarker.lat, searchMarker.lng]} icon={searchMarkerIcon}>
              {searchMarker.label ? <Popup>{searchMarker.label}</Popup> : null}
            </Marker>
          ) : null}
          {sensors.map((sensor) => {
            const {
              location: { latitude, longitude }
            } = sensor
            const isSelected = sensor.id === selectedSensorId
            const icon = createSensorIcon(sensor, isSelected)
            const metrics = popupMetrics(sensor)
            return (
              <Marker
                key={sensor.id}
                position={[latitude, longitude]}
                icon={icon}
                eventHandlers={{
                  click: () => onSelect(sensor.id)
                }}
              >
                <Popup>
                  <div className="space-y-3 text-slate-800">
                    <div>
                      <h3 className="text-base font-semibold">{sensor.name}</h3>
                      <p className="flex items-center justify-between text-xs font-medium uppercase tracking-widest text-slate-500">
                        <span>{sensor.zone.name}</span>
                        <span>{sensor.kind.toUpperCase()}</span>
                      </p>
                    </div>
                    {metrics.length > 0 ? (
                      <dl className="grid gap-2 text-xs text-slate-600">
                        {metrics.map((metric) => (
                          <div key={metric.key} className="flex items-center justify-between gap-3">
                            <dt className="font-medium text-slate-500">{metric.label}</dt>
                            <dd
                              className={`text-slate-800 ${
                                metric.key === 'leakDetected' && metric.value === 'Detected'
                                  ? 'font-semibold text-orange-600'
                                  : ''
                              }`}
                            >
                              {metric.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-xs text-slate-500">No recent telemetry.</p>
                    )}
                    <div className="text-xs text-slate-500">
                      {sensor.lastReadingAt
                        ? `Updated ${sensor.lastReadingAt.toLocaleTimeString()}`
                        : 'Awaiting readings'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}

export default MapPanel
