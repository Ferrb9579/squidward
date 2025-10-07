import { useMemo, useState } from 'react'
import type { SensorState } from '../types'

interface SensorListProps {
  sensors: SensorState[]
  selectedSensorId?: string
  onSelect: (sensorId: string) => void
}

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit'
})

const sensorComparator = (a: SensorState, b: SensorState) => {
  if (a.zone.name === b.zone.name) {
    return a.name.localeCompare(b.name)
  }
  return a.zone.name.localeCompare(b.zone.name)
}

export const SensorList = ({ sensors, selectedSensorId, onSelect }: SensorListProps) => {
  const [search, setSearch] = useState('')

  const groupedSensors = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const filtered = normalizedSearch
      ? sensors.filter((sensor) =>
          `${sensor.name} ${sensor.zone.name}`
            .toLowerCase()
            .includes(normalizedSearch)
        )
      : sensors

    const sorted = [...filtered].sort(sensorComparator)

    return sorted.reduce(
      (acc, sensor) => {
        const key = sensor.zone.id
        if (!acc[key]) {
          acc[key] = { zone: sensor.zone, items: [] as SensorState[] }
        }
        acc[key].items.push(sensor)
        return acc
      },
      {} as Record<string, { zone: SensorState['zone']; items: SensorState[] }>
    )
  }, [sensors, search])

  const zoneEntries = Object.values(groupedSensors)

  return (
    <div className="panel sensor-list">
      <div className="panel__header">
        <h2>Sensors</h2>
        <input
          className="sensor-list__search"
          placeholder="Search by name or zone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="panel__body sensor-list__body">
        {zoneEntries.length === 0 ? (
          <p className="panel__empty">No sensors match your filter.</p>
        ) : (
          zoneEntries.map(({ zone, items }) => (
            <section key={zone.id} className="sensor-list__group">
              <header className="sensor-list__group-header">
                <h3>{zone.name}</h3>
                <span>{items.length}</span>
              </header>
              <ul className="sensor-list__items">
                {items.map((sensor) => {
                  const lastSeen = sensor.lastReadingAt
                    ? timeFormatter.format(sensor.lastReadingAt)
                    : '—'
                  const itemClass = [
                    'sensor-list__item',
                    sensor.id === selectedSensorId ? 'sensor-list__item--active' : '',
                    sensor.isActive ? '' : 'sensor-list__item--inactive'
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <li key={sensor.id} className={itemClass}>
                      <button type="button" onClick={() => onSelect(sensor.id)}>
                        <div className="sensor-list__item-main">
                          <span className="sensor-list__item-name">{sensor.name}</span>
                          <span className={`sensor-kind sensor-kind--${sensor.kind}`}>
                            {sensor.kind}
                          </span>
                        </div>
                        <div className="sensor-list__item-meta">
                          <span>{sensor.zone.name}</span>
                          <span>Updated {lastSeen}</span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  )
}

export default SensorList
