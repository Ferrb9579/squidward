import { create } from 'zustand'
import {
  fetchOverviewMetrics,
  fetchSensorMeasurements,
  fetchSensors,
  fetchZoneSnapshots
} from '../api/dashboard'
import { MEASUREMENT_LIMIT } from '../config'
import type {
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
  initialize: () => Promise<void>
  refreshAggregates: (timestamp?: Date) => Promise<void>
  selectSensor: (sensorId?: string) => void
  loadMeasurements: (sensorId: string) => Promise<void>
  applyReading: (payload: ReadingEventPayload) => void
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
  initialize: async () => {
    if (get().isLoading) return
    set({ isLoading: true, error: undefined })
    try {
      const [sensors, overview, zones] = await Promise.all([
        fetchSensors(),
        fetchOverviewMetrics(),
        fetchZoneSnapshots()
      ])

      const selectedSensorId =
        get().selectedSensorId ?? sensors.find((sensor) => sensor.isActive)?.id

      set({
        sensors,
        overview,
        zones,
        selectedSensorId,
        isLoading: false
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
        isLoading: false
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
  setStreamStatus: (status) => set({ streamStatus: status }),
  setError: (message) => set({ error: message })
}))
