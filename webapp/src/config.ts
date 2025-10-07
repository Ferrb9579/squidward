const normalizeBaseUrl = (value: string | undefined, fallback: string) => {
  if (!value) return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
  'http://localhost:4000/api'
)

export const STREAM_URL = `${API_BASE_URL}/stream`

export const MEASUREMENT_LIMIT = 120
