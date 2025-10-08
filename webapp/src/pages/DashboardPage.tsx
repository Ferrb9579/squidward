import { useEffect, useMemo, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { OverviewCards } from '../components/OverviewCards'
import { LiveFeed } from '../components/LiveFeed'
import { MapPanel } from '../components/MapPanel'
import { SensorDetails } from '../components/SensorDetails'
import { SensorList } from '../components/SensorList'
import { ZoneSnapshotList } from '../components/ZoneSnapshotList'
import { AlertCenter } from '../components/AlertCenter'
import { UsageAnalyticsPanel } from '../components/UsageAnalyticsPanel'
import { useEventStream } from '../hooks/useEventStream'
import { useDashboardStore } from '../store/dashboardStore'

export const DashboardPage = () => {
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
  const analytics = useDashboardStore((state) => state.analytics)
  const analyticsLoading = useDashboardStore((state) => state.analyticsLoading)
  const alerts = useDashboardStore((state) => state.alerts)
  const alertsLoading = useDashboardStore((state) => state.alertsLoading)
  const loadAlerts = useDashboardStore((state) => state.loadAlerts)
  const acknowledgeAlert = useDashboardStore((state) => state.acknowledgeAlert)
  const resolveAlert = useDashboardStore((state) => state.resolveAlert)
  const loadAnalytics = useDashboardStore((state) => state.loadAnalytics)

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
    if (sensorId === selectedSensorId) {
      selectSensor(undefined)
      setTimeout(() => {
        selectSensor(sensorId)
      }, 0)
      return
    }
    selectSensor(sensorId)
  }

  const handleRefreshAlerts = () => {
    void loadAlerts({ status: 'all' })
  }

  const handleRefreshAnalytics = () => {
    void loadAnalytics()
  }

  const [isMapExpanded, setIsMapExpanded] = useState(false)

  return (
    <div className="flex min-h-full flex-col gap-6 px-6 pb-8 pt-6">
      <OverviewCards
        overview={overview}
        lastCycleAt={lastCycleAt}
        streamStatus={streamStatus}
      />
      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-5 py-4 text-sm text-rose-100">
          <strong className="mr-1 font-semibold">Heads up:</strong>
          {error}
        </div>
      )}
      <div className="flex flex-1 min-h-0 gap-6">
        <section className="flex min-w-0 flex-1 flex-col gap-6">
          {!isMapExpanded && (
            <MapPanel
              sensors={sensors}
              selectedSensorId={selectedSensorId}
              onSelect={handleSelectSensor}
              isExpanded={false}
              onToggleExpand={setIsMapExpanded}
            />
          )}
          <SensorDetails
            sensor={selectedSensor}
            measurements={selectedMeasurements}
          />
          <UsageAnalyticsPanel
            analytics={analytics}
            isLoading={analyticsLoading && !analytics}
            onRefresh={handleRefreshAnalytics}
          />
        </section>
        <aside className="flex h-full w-[340px] min-w-[280px] flex-col gap-6 overflow-y-auto pr-1.5">
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
            onFocusSensor={handleSelectSensor}
          />
          <ZoneSnapshotList zones={zones} />
          <LiveFeed events={recentEvents} />
        </aside>
      </div>
      {isLoading && sensors.length === 0 && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-950/80 backdrop-blur">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-600/40 border-t-accent" />
          <p className="text-slate-100">Syncing with backend simulator…</p>
        </div>
      )}
      {isMapExpanded && (
        <div className="fixed inset-0 z-50 flex min-h-0 flex-col bg-slate-950/85 backdrop-blur-sm p-4 sm:p-6">
          <div className="flex h-full w-full flex-1 min-h-0">
            <MapPanel
              sensors={sensors}
              selectedSensorId={selectedSensorId}
              onSelect={handleSelectSensor}
              isExpanded
              onToggleExpand={setIsMapExpanded}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardPage
