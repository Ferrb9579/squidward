import { create } from 'zustand'
import { fetchSensors } from '../api/dashboard'
import {
  createSensorAutomation,
  deleteAutomation,
  fetchSensorAutomations,
  updateAutomation,
  type CreateAutomationPayload,
  type UpdateAutomationPayload
} from '../api/automations'
import type { SensorAutomation, SensorState } from '../types'

interface AutomationState {
  sensors: SensorState[]
  automations: SensorAutomation[]
  selectedSensorId?: string
  loadingSensors: boolean
  loadingAutomations: boolean
  isMutating: boolean
  error?: string
  initialize: () => Promise<void>
  selectSensor: (sensorId: string) => void
  refreshSensors: () => Promise<void>
  refreshAutomations: () => Promise<void>
  createAutomation: (payload: CreateAutomationPayload) => Promise<SensorAutomation | undefined>
  updateAutomation: (
    automationId: string,
    payload: UpdateAutomationPayload
  ) => Promise<SensorAutomation | undefined>
  removeAutomation: (automationId: string) => Promise<boolean>
  clearError: () => void
}

const sortAutomations = (items: SensorAutomation[]): SensorAutomation[] => {
  return [...items].sort((a, b) => {
    const aTime = a.updatedAt ?? a.createdAt ?? new Date(0)
    const bTime = b.updatedAt ?? b.createdAt ?? new Date(0)
    return bTime.getTime() - aTime.getTime()
  })
}

export const useAutomationStore = create<AutomationState>()((set, get) => ({
  sensors: [],
  automations: [],
  selectedSensorId: undefined,
  loadingSensors: false,
  loadingAutomations: false,
  isMutating: false,
  error: undefined,
  initialize: async () => {
    if (get().loadingSensors) return
    set({ loadingSensors: true, error: undefined })
    try {
      const sensors = await fetchSensors()
      const selectedSensorId = get().selectedSensorId ?? sensors[0]?.id
      set({ sensors, selectedSensorId, loadingSensors: false })
      if (selectedSensorId) {
        await get().refreshAutomations()
      }
    } catch (error) {
      console.error('Failed to load sensors for automations', error)
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load sensors',
        loadingSensors: false
      })
    }
  },
  selectSensor: (sensorId) => {
    if (sensorId === get().selectedSensorId) return
    set({ selectedSensorId: sensorId })
    void get().refreshAutomations()
  },
  refreshSensors: async () => {
    set({ loadingSensors: true })
    try {
      const sensors = await fetchSensors()
      const selectedSensorId = get().selectedSensorId ?? sensors[0]?.id
      set({ sensors, selectedSensorId, loadingSensors: false })
      if (selectedSensorId) {
        await get().refreshAutomations()
      } else {
        set({ automations: [] })
      }
    } catch (error) {
      console.error('Failed to refresh sensors for automations', error)
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to refresh sensors',
        loadingSensors: false
      })
    }
  },
  refreshAutomations: async () => {
    const sensorId = get().selectedSensorId
    if (!sensorId) {
      set({ automations: [] })
      return
    }
    set({ loadingAutomations: true, error: undefined })
    try {
      const { automations } = await fetchSensorAutomations(sensorId)
      set({ automations: sortAutomations(automations), loadingAutomations: false })
    } catch (error) {
      console.error('Failed to load automations', error)
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load automations',
        loadingAutomations: false
      })
    }
  },
  createAutomation: async (payload) => {
    const sensorId = get().selectedSensorId
    if (!sensorId) {
      set({ error: 'Select a sensor before creating an automation.' })
      return undefined
    }

    set({ isMutating: true, error: undefined })
    try {
      const automation = await createSensorAutomation(sensorId, payload)
      set((state) => ({
        automations: sortAutomations([...state.automations, automation]),
        isMutating: false
      }))
      return automation
    } catch (error) {
      console.error('Failed to create automation', error)
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create automation',
        isMutating: false
      })
      return undefined
    }
  },
  updateAutomation: async (automationId, payload) => {
    set({ isMutating: true, error: undefined })
    try {
      const automation = await updateAutomation(automationId, payload)
      set((state) => ({
        automations: sortAutomations(
          state.automations.map((item) =>
            item.id === automation.id ? automation : item
          )
        ),
        isMutating: false
      }))
      return automation
    } catch (error) {
      console.error('Failed to update automation', error)
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update automation',
        isMutating: false
      })
      return undefined
    }
  },
  removeAutomation: async (automationId) => {
    set({ isMutating: true, error: undefined })
    try {
      await deleteAutomation(automationId)
      set((state) => ({
        automations: state.automations.filter((item) => item.id !== automationId),
        isMutating: false
      }))
      return true
    } catch (error) {
      console.error('Failed to delete automation', error)
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to delete automation',
        isMutating: false
      })
      return false
    }
  },
  clearError: () => set({ error: undefined })
}))
