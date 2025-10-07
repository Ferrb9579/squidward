import { useEffect } from 'react'
import { parseCycleEvent, parseReadingEvent } from '../api/dashboard'
import { parseLeakAlertEvent } from '../api/alerts'
import { STREAM_URL } from '../config'
import { useDashboardStore } from '../store/dashboardStore'

export const useEventStream = () => {
  const applyReading = useDashboardStore((state) => state.applyReading)
  const refreshAggregates = useDashboardStore((state) => state.refreshAggregates)
  const setStreamStatus = useDashboardStore((state) => state.setStreamStatus)
  const applyAlertEvent = useDashboardStore((state) => state.applyAlertEvent)

  useEffect(() => {
    setStreamStatus('connecting')
    const source = new EventSource(STREAM_URL)

    source.addEventListener('open', () => {
      setStreamStatus('open')
    })

    source.addEventListener('reading', (event) => {
      const payload = parseReadingEvent((event as MessageEvent).data)
      if (payload) {
        applyReading(payload)
      }
    })

    source.addEventListener('cycle', (event) => {
      const timestamp = parseCycleEvent((event as MessageEvent).data)
      void refreshAggregates(timestamp ?? undefined)
    })

    source.addEventListener('leak-alert', (event) => {
      const payload = parseLeakAlertEvent((event as MessageEvent).data)
      if (payload) {
        applyAlertEvent(payload)
      }
    })

    source.addEventListener('error', (event) => {
      console.error('EventSource encountered an error', event)
      setStreamStatus('error')
    })

    return () => {
      setStreamStatus('idle')
      source.close()
    }
  }, [applyAlertEvent, applyReading, refreshAggregates, setStreamStatus])
}
