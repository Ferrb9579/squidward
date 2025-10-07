import L from 'leaflet'
import { useEffect } from 'react'
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

const createSensorIcon = (sensor: SensorState, isSelected: boolean) => {
  const color = kindColors[sensor.kind] ?? '#38bdf8'
  const className = `sensor-marker ${isSelected ? 'sensor-marker--selected' : ''}`
  const size = isSelected ? 36 : 24

  return L.divIcon({
    html: `<span class="sensor-marker__dot" style="background:${color}"></span>`,
    className,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  })
}

const RecenterOnSelection = ({
  sensor
}: {
  sensor?: SensorState
}) => {
  const map = useMap()
  useEffect(() => {
    if (!sensor) return
    const { latitude, longitude } = sensor.location
    map.flyTo([latitude, longitude], 18, { duration: 0.6 })
  }, [sensor, map])
  return null
}

export const MapPanel = ({ sensors, selectedSensorId, onSelect }: MapPanelProps) => {
  const fallbackSensor = sensors.find((sensor) => sensor.id === selectedSensorId)
    ?? sensors.find((sensor) => sensor.isActive)
    ?? sensors[0]

  if (!fallbackSensor) {
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

  const center: [number, number] = [
    fallbackSensor.location.latitude,
    fallbackSensor.location.longitude
  ]

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
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterOnSelection sensor={fallbackSensor} />
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
