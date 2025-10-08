import { useMemo, useState } from 'react'
import {
  emptyStateClass,
  panelBodyClass,
  panelClass,
  panelHeaderClass
} from '../styles/ui'
import type { SensorState, WaterQualitySummary } from '../types'

interface SensorListProps {
  sensors: SensorState[]
  selectedSensorId?: string
  onSelect: (sensorId: string) => void
  waterQuality?: Record<string, WaterQualitySummary>
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

export const SensorList = ({
  sensors,
  selectedSensorId,
  onSelect,
  waterQuality
}: SensorListProps) => {
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
    <div className={panelClass}>
      <div className={`${panelHeaderClass} gap-3`}>
        <h2 className="text-lg font-semibold text-slate-100">Sensors</h2>
        <input
          className="w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-0"
          placeholder="Search by name or zone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
  <div className={`${panelBodyClass} gap-5 overflow-y-auto`}>
        {zoneEntries.length === 0 ? (
          <p className={emptyStateClass}>No sensors match your filter.</p>
        ) : (
          zoneEntries.map(({ zone, items }) => (
            <section key={zone.id} className="space-y-3">
              <header className="flex items-center justify-between text-xs font-medium uppercase tracking-widest text-slate-400">
                <h3>{zone.name}</h3>
                <span className="rounded-full bg-slate-800/70 px-2 py-0.5 text-[0.7rem] text-slate-300">
                  {items.length}
                </span>
              </header>
              <ul className="flex flex-col gap-2">
                {items.map((sensor) => {
                  const lastSeen = sensor.lastReadingAt
                    ? timeFormatter.format(sensor.lastReadingAt)
                    : '—'
                  const quality = waterQuality?.[sensor.id]
                  const qualityBadge = quality
                    ? quality.status === 'contaminated'
                      ? 'bg-rose-500/15 text-rose-200 border border-rose-500/40'
                      : quality.status === 'warning'
                        ? 'bg-amber-500/15 text-amber-200 border border-amber-500/40'
                        : quality.status === 'safe'
                          ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40'
                          : 'bg-slate-800/70 text-slate-300 border border-slate-700/60'
                    : undefined
                  const baseItem = 'rounded-xl border border-slate-700/50 bg-slate-900/60 transition hover:border-sky-400/50'
                  const activeItem = sensor.id === selectedSensorId
                    ? ' border-sky-400/70 bg-sky-500/10 shadow-panel'
                    : ''
                  const inactiveItem = sensor.isActive ? '' : ' opacity-50'

                  return (
                    <li key={sensor.id} className={`${baseItem}${activeItem}${inactiveItem}`}>
                      <button
                        type="button"
                        className="flex w-full flex-col gap-2 px-4 py-3 text-left"
                        onClick={() => onSelect(sensor.id)}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-100">{sensor.name}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                              sensor.kind === 'flow'
                                ? 'bg-cyan-500/20 text-cyan-200'
                                : sensor.kind === 'pressure'
                                  ? 'bg-orange-500/20 text-orange-200'
                                  : sensor.kind === 'level'
                                    ? 'bg-emerald-500/20 text-emerald-200'
                                    : 'bg-violet-500/20 text-violet-200'
                            }`}
                          >
                            {sensor.kind}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-400">
                          <span>{sensor.zone.name}</span>
                          <span>Updated {lastSeen}</span>
                        </div>
                        {quality && (
                          <div className={`w-fit rounded-full px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.25em] ${qualityBadge ?? ''}`}>
                            {quality.status === 'missing' ? 'no data' : quality.status}
                          </div>
                        )}
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
