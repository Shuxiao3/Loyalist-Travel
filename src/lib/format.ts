// Dates as the design writes them: "March 2026" for stays, "Apr 2, 2026" for
// publishing dates. Always UTC so server and client agree.

export function monthYear(value?: string | null): string | null {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function shortDate(value?: string | null): string | null {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// Scores are stored in 0.5 steps; show "81" or "81.5", never "81.0".
export function score(value?: number | null): string {
  if (value == null) return '–'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

// The URL of an uploaded image, when populated.
export function mediaUrl(value: unknown): string | null {
  return value && typeof value === 'object' && 'url' in value && typeof (value as { url?: unknown }).url === 'string' ? (value as { url: string }).url : null
}

export function count(n: number): string {
  return n.toLocaleString('en-US')
}

// Narrow a Payload relationship value, which is an id until populated.
export function rel<T extends object>(value: number | T | null | undefined): T | null {
  return value && typeof value === 'object' ? value : null
}
