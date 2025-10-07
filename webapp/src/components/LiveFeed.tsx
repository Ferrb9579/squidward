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
    <div className="panel live-feed">
      <div className="panel__header">
        <h2>Live feed</h2>
        <p className="panel__subtext">Streaming updates from IoT simulator.</p>
      </div>
      <div className="panel__body live-feed__body">
        {items.length === 0 ? (
          <p className="panel__empty">Waiting for live sensor activity.</p>
        ) : (
          <ul className="live-feed__list">
            {items.map((event) => (
              <li key={`${event.sensor.id}-${event.reading.timestamp.getTime()}`}>
                <div className="live-feed__meta">
                  <span className="live-feed__sensor">{event.sensor.name}</span>
                  <span className="live-feed__time">
                    {timeFormatter.format(event.reading.timestamp)}
                  </span>
                </div>
                <p className="live-feed__description">{describeReading(event)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default LiveFeed
