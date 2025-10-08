import { Maximize2, Minimize2 } from 'lucide-react'
import L from 'leaflet'
import { useEffect, useMemo, useRef } from 'react'
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
  panelHeaderClass
} from '../styles/ui'
import type { SensorState } from '../types'

type MetricKey =
  | 'flowRateLpm'
  | 'pressureBar'
  | 'levelPercent'
  | 'temperatureCelsius'
  | 'batteryPercent'
  | 'healthScore'
  | 'leakDetected'

const metricOrder: MetricKey[] = [
  'flowRateLpm',
  'pressureBar',
  'levelPercent',
  'temperatureCelsius',
  'batteryPercent',
  'healthScore',
  'leakDetected'
]

const metricLabel: Record<MetricKey, string> = {
  flowRateLpm: 'Flow',
  pressureBar: 'Pressure',
  levelPercent: 'Level',
  temperatureCelsius: 'Temperature',
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
      <div className={`${panelBodyClass} flex-1 gap-0 px-0 pb-0 pt-0`}>
        <MapContainer
          center={center}
          zoom={17}
          className={`${
            isExpanded
              ? 'flex-1 h-full min-h-[480px] w-full overflow-hidden rounded-2xl'
              : 'h-[360px] w-full overflow-hidden rounded-2xl'
          }`}
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
