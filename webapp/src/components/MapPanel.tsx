import L from 'leaflet'
import { useEffect, useMemo, useRef } from 'react'
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap
} from 'react-leaflet'
import type { SensorState } from '../types'

interface MapPanelProps {
  sensors: SensorState[]
  selectedSensorId?: string
  onSelect: (sensorId: string) => void
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

export const MapPanel = ({ sensors, selectedSensorId, onSelect }: MapPanelProps) => {
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

  if (!initialSensor || !center) {
    return (
      <div className="panel map-panel">
        <div className="panel__header">
          <h2>Campus map</h2>
        </div>
        <div className="panel__body panel__body--empty">
          <p>No sensors available yet. Data will appear once the simulator seeds sensors.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="panel map-panel">
      <div className="panel__header">
        <h2>Campus map</h2>
        <p className="panel__subtext">Click a marker to inspect a sensor.</p>
      </div>
      <div className="map-panel__map">
        <MapContainer
          center={center}
          zoom={17}
          minZoom={13}
          className="map-panel__container"
          scrollWheelZoom
          keyboard={false}
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
                  <div className="map-popup">
                    <h3>{sensor.name}</h3>
                    <p className="map-popup__meta">
                      <span>{sensor.zone.name}</span>
                      <span>{sensor.kind.toUpperCase()}</span>
                    </p>
                    {sensor.lastReadingAt ? (
                      <p className="map-popup__timestamp">
                        Updated {sensor.lastReadingAt.toLocaleTimeString()}
                      </p>
                    ) : (
                      <p className="map-popup__timestamp">Awaiting readings</p>
                    )}
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
