import { leakDetectionEvents, normalizeAlertPayload } from './leakDetectionService'
import type { AlertEventPayload } from './leakDetectionService'
import type { LeakAlertSummary } from '../types/alert'
import { sendEmail } from './emailService'
import { env } from '../config/env'

const metricTitles: Record<LeakAlertSummary['metric'], string> = {
  flowRateLpm: 'Flow anomaly',
  pressureBar: 'Pressure spike',
  levelPercent: 'Reservoir level drop',
  composite: 'Composite leak signal',
  offline: 'Sensor offline'
}

const formatSubject = (alert: LeakAlertSummary) => {
  const scope = metricTitles[alert.metric] ?? 'Leak alert'
  const severity = alert.metric === 'offline' ? 'Critical' : alert.severity === 'critical' ? 'Critical' : 'Warning'
  return `[Squidward] ${severity} ${scope}: ${alert.sensorName}`
}

const formatTextBody = (alert: LeakAlertSummary) => {
  const triggeredAt = new Date(alert.triggeredAt)
  const resolvedAt = alert.resolvedAt ? new Date(alert.resolvedAt) : undefined
  const lines = [
    `Alert type: ${metricTitles[alert.metric] ?? alert.metric}`,
    `Severity: ${alert.metric === 'offline' ? 'critical' : alert.severity}`,
    `Sensor: ${alert.sensorName} (ID: ${alert.sensorId})`,
    `Zone: ${alert.zone.name} (${alert.zone.id})`,
    `Triggered at: ${triggeredAt.toLocaleString()}`,
    `Message: ${alert.message}`
  ]

  if (alert.currentValue !== undefined) {
    lines.push(`Current value: ${alert.currentValue}`)
  }
  if (alert.baselineValue !== undefined) {
    lines.push(`Baseline value: ${alert.baselineValue}`)
  }
  if (alert.delta !== undefined) {
    lines.push(`Delta: ${alert.delta}`)
  }
  if (resolvedAt) {
    lines.push(`Resolved at: ${resolvedAt.toLocaleString()}`)
  }

  return lines.join('\n')
}

const formatHtmlBody = (alert: LeakAlertSummary) => {
  const triggeredAt = new Date(alert.triggeredAt)
  const resolvedAt = alert.resolvedAt ? new Date(alert.resolvedAt) : undefined
  return `
    <h2 style="font-family:system-ui,Segoe UI,sans-serif;margin:0 0 12px;font-size:16px;">
      ${metricTitles[alert.metric] ?? 'Leak alert'}
    </h2>
    <p style="font-family:system-ui,Segoe UI,sans-serif;margin:0 0 12px;font-size:14px;">
      <strong>Severity:</strong> ${alert.metric === 'offline' ? 'critical' : alert.severity}<br />
      <strong>Sensor:</strong> ${alert.sensorName} (ID: ${alert.sensorId})<br />
      <strong>Zone:</strong> ${alert.zone.name} (${alert.zone.id})<br />
      <strong>Triggered at:</strong> ${triggeredAt.toLocaleString()}<br />
      <strong>Message:</strong> ${alert.message}
    </p>
    <ul style="font-family:system-ui,Segoe UI,sans-serif;margin:0 0 12px;padding-left:18px;font-size:13px;">
      ${
        alert.currentValue !== undefined
          ? `<li><strong>Current value:</strong> ${alert.currentValue}</li>`
          : ''
      }
      ${
        alert.baselineValue !== undefined
          ? `<li><strong>Baseline value:</strong> ${alert.baselineValue}</li>`
          : ''
      }
      ${
        alert.delta !== undefined
          ? `<li><strong>Delta:</strong> ${alert.delta}</li>`
          : ''
      }
      ${
        resolvedAt
          ? `<li><strong>Resolved at:</strong> ${resolvedAt.toLocaleString()}</li>`
          : ''
      }
    </ul>
    <p style="font-family:system-ui,Segoe UI,sans-serif;margin:0;font-size:12px;color:#475569;">
      You are receiving this email because alert notifications are enabled on your Squidward deployment.
    </p>
  `
}

const handleAlertEvent = async (payload: AlertEventPayload) => {
  if (!env.email.enabled) {
    return
  }

  if (payload.type !== 'created') {
    return
  }

  const alert = normalizeAlertPayload(payload.alert)
  await sendEmail({
    subject: formatSubject(alert),
    text: formatTextBody(alert),
    html: formatHtmlBody(alert)
  })
}

let isRegistered = false

export const startAlertNotifications = () => {
  if (isRegistered) return
  leakDetectionEvents.on('alert', (payload) => {
    void handleAlertEvent(payload).catch((error) => {
      console.error('Failed to dispatch alert email', error)
    })
  })
  isRegistered = true
}