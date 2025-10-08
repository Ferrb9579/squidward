import nodemailer from 'nodemailer'
import { env } from '../config/env'

export interface EmailPayload {
  subject: string
  text: string
  html?: string
}

let transporter: nodemailer.Transporter | null = null

const getRecipients = () => {
  if (env.email.recipients.length > 0) {
    return env.email.recipients
  }
  if (env.email.user) {
    return [env.email.user]
  }
  return []
}

const ensureTransporter = () => {
  if (!env.email.enabled) {
    throw new Error('Email service is not configured. Set EMAIL_* environment variables.')
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.secure,
      auth: {
        user: env.email.user,
        pass: env.email.password
      }
    })
  }

  return transporter
}

export const sendEmail = async ({ subject, text, html }: EmailPayload) => {
  if (!env.email.enabled) {
    return
  }

  const recipients = getRecipients()
  if (!recipients.length) {
    console.warn('Email not sent: no recipients configured')
    return
  }

  const transport = ensureTransporter()

  try {
    await transport.sendMail({
      from: env.email.from || env.email.user,
      to: recipients,
      subject,
      text,
      html: html ?? text
    })
  } catch (error) {
    console.error('Failed to send email alert', error)
  }
}

export const closeEmailTransport = async () => {
  if (transporter && typeof transporter.close === 'function') {
    await transporter.close()
    transporter = null
  }
}
