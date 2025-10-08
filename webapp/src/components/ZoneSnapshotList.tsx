import { Activity, Droplets, HeartPulse, Layers, Users } from 'lucide-react'
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
    <div className="panel zone-panel">
      <div className="panel__header">
        <h2 className="panel__title">
          <Layers size={18} aria-hidden />
          Zones
        </h2>
        <p className="panel__subtext">High-level pulse of campus distribution.</p>
      </div>
      <div className="panel__body">
        <table className="zone-table">
          <thead>
            <tr>
              <th>
                <span className="zone-table__heading">
                  <Droplets size={16} aria-hidden />
                  Zone
                </span>
              </th>
              <th>
                <span className="zone-table__heading">
                  <Users size={16} aria-hidden />
                  Sensors
                </span>
              </th>
              <th>
                <span className="zone-table__heading">
                  <Activity size={16} aria-hidden />
                  Active
                </span>
              </th>
              <th>
                <span className="zone-table__heading">
                  <HeartPulse size={16} aria-hidden />
                  Health
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone.zone.id}>
                <td>{zone.zone.name}</td>
                <td>{zone.sensorCount}</td>
                <td>{zone.activeSensors}</td>
                <td>
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
