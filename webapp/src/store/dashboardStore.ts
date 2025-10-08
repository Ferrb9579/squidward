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
import { fetchUsageAnalytics } from '../api/analytics'
import {
  fetchWaterQualitySummaries,
  fetchWaterQualityForSensor
} from '../api/waterQuality'
import { ALERT_LIMIT, MEASUREMENT_LIMIT } from '../config'
import type {
  LeakAlert,
  LeakAlertEvent,
  LiveEvent,
  Measurement,
  OverviewMetrics,
  ReadingEventPayload,
  UsageAnalytics,
  SensorState,
  StreamStatus,
  WaterQualitySummary,
  ZoneSnapshot
} from '../types'
import { evaluateWaterQuality } from '../utils/waterQuality'

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
  analytics?: UsageAnalytics
  analyticsLoading: boolean
  waterQuality: Record<string, WaterQualitySummary>
  waterQualityLoading: boolean
  initialize: () => Promise<void>
  refreshAggregates: (timestamp?: Date) => Promise<void>
  selectSensor: (sensorId?: string) => void
  loadMeasurements: (sensorId: string) => Promise<void>
  applyReading: (payload: ReadingEventPayload) => void
  loadAlerts: (options?: { status?: 'active' | 'resolved' | 'all' }) => Promise<void>
  applyAlertEvent: (event: LeakAlertEvent) => void
  acknowledgeAlert: (alertId: string) => Promise<void>
  resolveAlert: (alertId: string) => Promise<void>
  loadAnalytics: () => Promise<void>
  loadWaterQuality: () => Promise<void>
  loadWaterQualityForSensor: (sensorId: string) => Promise<void>
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

const indexWaterQuality = (summaries: WaterQualitySummary[]) =>
  summaries.reduce<Record<string, WaterQualitySummary>>((acc, summary) => {
    acc[summary.sensorId] = summary
    return acc
  }, {})

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
  analytics: undefined,
  analyticsLoading: false,
  waterQuality: {},
  waterQualityLoading: false,
  initialize: async () => {
    if (get().isLoading) return
    set({
      isLoading: true,
      error: undefined,
      alertsLoading: true,
      analyticsLoading: true,
      waterQualityLoading: true
    })
    try {
      const [sensors, overview, zones, alerts, analytics, waterQuality] = await Promise.all([
        fetchSensors(),
        fetchOverviewMetrics(),
        fetchZoneSnapshots(),
        fetchLeakAlerts({ status: 'all', limit: ALERT_LIMIT }),
        fetchUsageAnalytics(),
        fetchWaterQualitySummaries()
      ])

      const selectedSensorId =
        get().selectedSensorId ?? sensors.find((sensor) => sensor.isActive)?.id

      set({
        sensors,
        overview,
        zones,
        selectedSensorId,
        alerts: clampAlerts(alerts),
        analytics,
        isLoading: false,
        alertsLoading: false,
        analyticsLoading: false,
        waterQuality: indexWaterQuality(waterQuality),
        waterQualityLoading: false
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
        alertsLoading: false,
        analyticsLoading: false,
        waterQualityLoading: false
      })
    }
  },
  refreshAggregates: async (timestamp?: Date) => {
    set({ analyticsLoading: true, waterQualityLoading: true })
    try {
      const [overview, zones, analytics, waterQuality] = await Promise.all([
        fetchOverviewMetrics(),
        fetchZoneSnapshots(),
        fetchUsageAnalytics(),
        fetchWaterQualitySummaries()
      ])
      set({
        overview,
        zones,
        analytics,
        lastCycleAt: timestamp ?? new Date(),
        analyticsLoading: false,
        waterQuality: indexWaterQuality(waterQuality),
        waterQualityLoading: false,
        error: undefined
      })
    } catch (error) {
      console.error('Failed to refresh aggregates', error)
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to refresh aggregates',
        analyticsLoading: false,
        waterQualityLoading: false
      })
    }
  },
  selectSensor: (sensorId) => {
    if (sensorId === get().selectedSensorId) return
    set({ selectedSensorId: sensorId })
    if (sensorId) {
      void get().loadMeasurements(sensorId)
      if (!get().waterQuality[sensorId]) {
        void get().loadWaterQualityForSensor(sensorId)
      }
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

      const hasWaterQualitySample =
        reading.ph !== undefined ||
        reading.turbidityNTU !== undefined ||
        reading.conductivityUsCm !== undefined ||
        reading.temperatureCelsius !== undefined

      const waterQuality = hasWaterQualitySample
        ? {
            ...state.waterQuality,
            [sensor.id]: evaluateWaterQuality(sensor, {
              sensorId: reading.sensorId,
              timestamp: reading.timestamp,
              ph: reading.ph,
              temperatureCelsius: reading.temperatureCelsius,
              turbidityNTU: reading.turbidityNTU,
              conductivityUsCm: reading.conductivityUsCm
            })
          }
        : state.waterQuality

      return {
        sensors,
        measurements,
        recentEvents,
        waterQuality
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
  loadAnalytics: async () => {
    set({ analyticsLoading: true })
    try {
      const analytics = await fetchUsageAnalytics()
      set({ analytics, analyticsLoading: false, error: undefined })
    } catch (error) {
      console.error('Failed to load usage analytics', error)
      set({
        analyticsLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load usage analytics'
      })
    }
  },
  loadWaterQuality: async () => {
    set({ waterQualityLoading: true })
    try {
      const summaries = await fetchWaterQualitySummaries()
      set({
        waterQuality: indexWaterQuality(summaries),
        waterQualityLoading: false,
        error: undefined
      })
    } catch (error) {
      console.error('Failed to load water quality summaries', error)
      set({
        waterQualityLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load water quality summaries'
      })
    }
  },
  loadWaterQualityForSensor: async (sensorId) => {
    set({ waterQualityLoading: true })
    try {
      const summary = await fetchWaterQualityForSensor(sensorId)
      set((state) => ({
        waterQuality: {
          ...state.waterQuality,
          [sensorId]: summary
        },
        waterQualityLoading: false,
        error: undefined
      }))
    } catch (error) {
      console.error('Failed to load water quality for sensor', { sensorId, error })
      set({ waterQualityLoading: false })
    }
  },
  setStreamStatus: (status) => set({ streamStatus: status }),
  setError: (message) => set({ error: message })
}))
