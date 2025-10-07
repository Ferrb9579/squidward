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
        <h2>Zones</h2>
        <p className="panel__subtext">High-level pulse of campus distribution.</p>
      </div>
      <div className="panel__body">
        <table className="zone-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Sensors</th>
              <th>Active</th>
              <th>Health</th>
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
