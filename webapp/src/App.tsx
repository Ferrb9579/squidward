import { useEffect, useMemo } from 'react'
import 'leaflet/dist/leaflet.css'
import './App.css'
import { OverviewCards } from './components/OverviewCards'
import { LiveFeed } from './components/LiveFeed'
import { MapPanel } from './components/MapPanel'
import { SensorDetails } from './components/SensorDetails'
import { SensorList } from './components/SensorList'
import { ZoneSnapshotList } from './components/ZoneSnapshotList'
import { AlertCenter } from './components/AlertCenter'
import { useEventStream } from './hooks/useEventStream'
import { useDashboardStore } from './store/dashboardStore'

function App() {
  const initialize = useDashboardStore((state) => state.initialize)
  const sensors = useDashboardStore((state) => state.sensors)
  const selectedSensorId = useDashboardStore((state) => state.selectedSensorId)
  const selectSensor = useDashboardStore((state) => state.selectSensor)
  const measurements = useDashboardStore((state) => state.measurements)
  const zones = useDashboardStore((state) => state.zones)
  const overview = useDashboardStore((state) => state.overview)
  const lastCycleAt = useDashboardStore((state) => state.lastCycleAt)
  const streamStatus = useDashboardStore((state) => state.streamStatus)
  const isLoading = useDashboardStore((state) => state.isLoading)
  const error = useDashboardStore((state) => state.error)
  const recentEvents = useDashboardStore((state) => state.recentEvents)
  const alerts = useDashboardStore((state) => state.alerts)
  const alertsLoading = useDashboardStore((state) => state.alertsLoading)
  const loadAlerts = useDashboardStore((state) => state.loadAlerts)
  const acknowledgeAlert = useDashboardStore((state) => state.acknowledgeAlert)
  const resolveAlert = useDashboardStore((state) => state.resolveAlert)

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEventStream()

  const selectedSensor = useMemo(
    () => sensors.find((sensor) => sensor.id === selectedSensorId),
    [sensors, selectedSensorId]
  )

  const selectedMeasurements = selectedSensorId
    ? measurements[selectedSensorId] ?? []
    : []

  const handleSelectSensor = (sensorId: string) => {
    selectSensor(sensorId)
  }

  const handleRefreshAlerts = () => {
    void loadAlerts({ status: 'all' })
  }

  return (
    <div className="dashboard">
      <OverviewCards
        overview={overview}
        lastCycleAt={lastCycleAt}
        streamStatus={streamStatus}
      />
      {error && (
        <div className="dashboard__banner dashboard__banner--error">
          <strong>Heads up:</strong> {error}
        </div>
      )}
      <div className="dashboard__content">
        <section className="dashboard__main">
          <MapPanel
            sensors={sensors}
            selectedSensorId={selectedSensorId}
            onSelect={handleSelectSensor}
          />
          <SensorDetails
            sensor={selectedSensor}
            measurements={selectedMeasurements}
          />
        </section>
        <aside className="dashboard__sidebar">
          <SensorList
            sensors={sensors}
            selectedSensorId={selectedSensorId}
            onSelect={handleSelectSensor}
          />
          <AlertCenter
            alerts={alerts}
            isLoading={alertsLoading}
            onRefresh={handleRefreshAlerts}
            onAcknowledge={(alertId) => {
              void acknowledgeAlert(alertId)
            }}
            onResolve={(alertId) => {
              void resolveAlert(alertId)
            }}
          />
          <ZoneSnapshotList zones={zones} />
          <LiveFeed events={recentEvents} />
        </aside>
      </div>
      {isLoading && sensors.length === 0 && (
        <div className="dashboard__loading-overlay">
          <div className="spinner" />
          <p>Syncing with backend simulator…</p>
        </div>
      )}
    </div>
  )
}

export default App
