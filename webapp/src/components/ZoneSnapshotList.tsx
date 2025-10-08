import { Activity, Droplets, HeartPulse, Layers, Users } from 'lucide-react'
import { panelBodyClass, panelClass, panelHeaderClass } from '../styles/ui'
import type { ZoneSnapshot } from '../types'

interface ZoneSnapshotListProps {
  zones: ZoneSnapshot[]
}

const averageFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})

export const ZoneSnapshotList = ({ zones }: ZoneSnapshotListProps) => {
  if (!zones.length) {
    return null
  }

  return (
    <div className={`${panelClass} max-h-[18rem]`}>
      <div className={panelHeaderClass}>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Layers size={18} aria-hidden />
          Zones
        </h2>
        <p className="text-sm text-slate-400">High-level pulse of campus distribution.</p>
      </div>
  <div className={`${panelBodyClass} overflow-auto`}>
        <table className="min-w-full table-auto divide-y divide-slate-700/40 text-sm text-slate-300">
          <thead className="text-xs uppercase tracking-[0.3em] text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">
                <span className="flex items-center gap-2">
                  <Droplets size={16} aria-hidden />
                  Zone
                </span>
              </th>
              <th className="px-3 py-2 text-left">
                <span className="flex items-center gap-2">
                  <Users size={16} aria-hidden />
                  Sensors
                </span>
              </th>
              <th className="px-3 py-2 text-left">
                <span className="flex items-center gap-2">
                  <Activity size={16} aria-hidden />
                  Active
                </span>
              </th>
              <th className="px-3 py-2 text-left">
                <span className="flex items-center gap-2">
                  <HeartPulse size={16} aria-hidden />
                  Health
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {zones.map((zone) => (
              <tr key={zone.zone.id} className="text-sm">
                <td className="px-3 py-3 text-slate-100">{zone.zone.name}</td>
                <td className="px-3 py-3">{zone.sensorCount}</td>
                <td className="px-3 py-3">{zone.activeSensors}</td>
                <td className="px-3 py-3">
                  {zone.averageHealthScore !== null
                    ? averageFormatter.format(zone.averageHealthScore)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ZoneSnapshotList
