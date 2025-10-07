import { create } from 'zustand'
import {
  fetchOverviewMetrics,
  fetchSensorMeasurements,
  fetchSensors,
  fetchZoneSnapshots
} from '../api/dashboard'
import {
  fetchLeakAlerts,
  acknowledgeLeakAlert,
  resolveLeakAlert
} from '../api/alerts'
import { ALERT_LIMIT, MEASUREMENT_LIMIT } from '../config'
import type {
  LeakAlert,
  LeakAlertEvent,
  LiveEvent,
  Measurement,
  OverviewMetrics,
  ReadingEventPayload,
  SensorState,
  StreamStatus,
  ZoneSnapshot
} from '../types'

interface DashboardState {
  sensors: SensorState[]
  selectedSensorId?: string
  measurements: Record<string, Measurement[]>
  zones: ZoneSnapshot[]
  overview?: OverviewMetrics
  lastCycleAt?: Date
  isLoading: boolean
  error?: string
  streamStatus: StreamStatus
  recentEvents: LiveEvent[]
  alerts: LeakAlert[]
  alertsLoading: boolean
  initialize: () => Promise<void>
  refreshAggregates: (timestamp?: Date) => Promise<void>
  selectSensor: (sensorId?: string) => void
  loadMeasurements: (sensorId: string) => Promise<void>
  applyReading: (payload: ReadingEventPayload) => void
  loadAlerts: (options?: { status?: 'active' | 'resolved' | 'all' }) => Promise<void>
  applyAlertEvent: (event: LeakAlertEvent) => void
  acknowledgeAlert: (alertId: string) => Promise<void>
  resolveAlert: (alertId: string) => Promise<void>
  setStreamStatus: (status: StreamStatus) => void
  setError: (message?: string) => void
}

const clampMeasurements = (items: Measurement[]): Measurement[] =>
  items
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, MEASUREMENT_LIMIT)

const clampEvents = (events: LiveEvent[]) =>
  events
    .sort(
      (a, b) => b.reading.timestamp.getTime() - a.reading.timestamp.getTime()
    )
    .slice(0, 40)

const clampAlerts = (alerts: LeakAlert[]) =>
  [...alerts]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, ALERT_LIMIT)

export const useDashboardStore = create<DashboardState>()((set, get) => ({
  sensors: [],
  measurements: {},
  zones: [],
  overview: undefined,
  lastCycleAt: undefined,
  isLoading: false,
  error: undefined,
  streamStatus: 'idle',
  recentEvents: [],
  alerts: [],
  alertsLoading: false,
  initialize: async () => {
    if (get().isLoading) return
    set({ isLoading: true, error: undefined, alertsLoading: true })
    try {
      const [sensors, overview, zones, alerts] = await Promise.all([
        fetchSensors(),
        fetchOverviewMetrics(),
        fetchZoneSnapshots(),
        fetchLeakAlerts({ status: 'all', limit: ALERT_LIMIT })
      ])

      const selectedSensorId =
        get().selectedSensorId ?? sensors.find((sensor) => sensor.isActive)?.id

      set({
        sensors,
        overview,
        zones,
        selectedSensorId,
        alerts: clampAlerts(alerts),
        isLoading: false,
        alertsLoading: false
      })

      if (selectedSensorId) {
        await get().loadMeasurements(selectedSensorId)
      }
    } catch (error) {
      console.error('Failed to initialize dashboard', error)
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected error loading dashboard',
        isLoading: false,
        alertsLoading: false
      })
    }
  },
  refreshAggregates: async (timestamp?: Date) => {
    try {
      const [overview, zones] = await Promise.all([
        fetchOverviewMetrics(),
        fetchZoneSnapshots()
      ])
      set({
        overview,
        zones,
        lastCycleAt: timestamp ?? new Date(),
        error: undefined
      })
    } catch (error) {
      console.error('Failed to refresh aggregates', error)
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to refresh aggregates'
      })
    }
  },
  selectSensor: (sensorId) => {
    if (sensorId === get().selectedSensorId) return
    set({ selectedSensorId: sensorId })
    if (sensorId) {
      void get().loadMeasurements(sensorId)
    }
  },
  loadMeasurements: async (sensorId: string) => {
    try {
      const { measurements } = await fetchSensorMeasurements(
        sensorId,
        MEASUREMENT_LIMIT
      )
      set((state) => ({
        measurements: {
          ...state.measurements,
          [sensorId]: clampMeasurements(measurements)
        },
        error: undefined
      }))
    } catch (error) {
      console.error('Failed to load measurements', error)
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load measurements'
      })
    }
  },
  applyReading: ({ sensor, reading }) => {
    set((state) => {
      const sensorExists = state.sensors.some((item) => item.id === sensor.id)
      const sensors = sensorExists
        ? state.sensors.map((item) =>
            item.id === sensor.id ? { ...sensor } : item
          )
        : [...state.sensors, sensor]

      const measurements = {
        ...state.measurements,
        [sensor.id]: clampMeasurements([
          reading,
          ...(state.measurements[sensor.id] ?? [])
        ])
      }

      const recentEvents = clampEvents([
        { sensor, reading },
        ...state.recentEvents
      ])

      return {
        sensors,
        measurements,
        recentEvents
      }
    })
  },
  loadAlerts: async (options) => {
    set({ alertsLoading: true })
    try {
      const alerts = await fetchLeakAlerts({
        status: options?.status ?? 'all',
        limit: ALERT_LIMIT
      })
      set({ alerts: clampAlerts(alerts), alertsLoading: false, error: undefined })
    } catch (error) {
      console.error('Failed to load leak alerts', error)
      set({
        alertsLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load leak alerts'
      })
    }
  },
  applyAlertEvent: (event) => {
    set((state) => {
      const next = state.alerts.filter((alert) => alert.id !== event.alert.id)
      next.unshift(event.alert)
      return {
        alerts: clampAlerts(next),
        alertsLoading: false
      }
    })
  },
  acknowledgeAlert: async (alertId: string) => {
    try {
      const updated = await acknowledgeLeakAlert(alertId)
      set((state) => {
        const next = state.alerts.filter((alert) => alert.id !== updated.id)
        next.unshift(updated)
        return {
          alerts: clampAlerts(next),
          error: undefined
        }
      })
    } catch (error) {
      console.error('Failed to acknowledge alert', error)
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to acknowledge alert'
      })
    }
  },
  resolveAlert: async (alertId: string) => {
    try {
      const updated = await resolveLeakAlert(alertId)
      set((state) => {
        const next = state.alerts.filter((alert) => alert.id !== updated.id)
        next.unshift(updated)
        return {
          alerts: clampAlerts(next),
          error: undefined
        }
      })
    } catch (error) {
      console.error('Failed to resolve alert', error)
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to resolve alert'
      })
    }
  },
  setStreamStatus: (status) => set({ streamStatus: status }),
  setError: (message) => set({ error: message })
}))
