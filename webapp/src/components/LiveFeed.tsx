import {
  emptyStateClass,
  panelBodyClass,
  panelClass,
  panelHeaderClass
} from '../styles/ui'
import type { LiveEvent } from '../types'

interface LiveFeedProps {
  events: LiveEvent[]
  limit?: number
}

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})

const describeReading = (event: LiveEvent) => {
  const { reading } = event
  if (reading.leakDetected) {
    return 'Leak signature detected'
  }
  if (reading.flowRateLpm !== undefined) {
    return `${Math.round(reading.flowRateLpm)} L/min`
  }
  if (reading.pressureBar !== undefined) {
    return `${reading.pressureBar.toFixed(2)} bar`
  }
  if (reading.levelPercent !== undefined) {
    return `${reading.levelPercent.toFixed(1)}% level`
  }
  return 'Sensor heartbeat'
}

export const LiveFeed = ({ events, limit = 12 }: LiveFeedProps) => {
  const items = events.slice(0, limit)

  return (
    <div className={`${panelClass} max-h-[22rem]`}>
      <div className={panelHeaderClass}>
        <h2 className="text-lg font-semibold text-slate-100">Live feed</h2>
        <p className="text-sm text-slate-400">Streaming updates from IoT simulator.</p>
      </div>
      <div className={`${panelBodyClass} overflow-y-auto`}>
        {items.length === 0 ? (
          <p className={emptyStateClass}>Waiting for live sensor activity.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((event) => (
              <li
                key={`${event.sensor.id}-${event.reading.timestamp.getTime()}`}
                className="rounded-lg border border-slate-700/40 bg-slate-900/50 p-3"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="text-sm font-semibold text-slate-200">
                    {event.sensor.name}
                  </span>
                  <span>{timeFormatter.format(event.reading.timestamp)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{describeReading(event)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default LiveFeed
