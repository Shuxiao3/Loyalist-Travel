// Display-name rules, shared by the form (client) and the action (server).
export const DISPLAY_NAME_MIN = 3
export const DISPLAY_NAME_MAX = 24
const RESERVED = /loyalist|admin|moderator|staff|official|hyatt|marriott|hilton|ihg/i

export function checkDisplayName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < DISPLAY_NAME_MIN || name.length > DISPLAY_NAME_MAX) return { ok: false, error: `Use ${DISPLAY_NAME_MIN} to ${DISPLAY_NAME_MAX} characters.` }
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(name)) return { ok: false, error: 'Letters, numbers, spaces, dots, dashes and underscores only.' }
  if (RESERVED.test(name)) return { ok: false, error: 'That name could be mistaken for the site or a hotel group. Pick another.' }
  return { ok: true, name }
}

// A reader may change an existing name once every six months. The first pick is
// not a change: choosing a name and being locked out of fixing a typo in it for
// half a year would be a trap, so the clock starts on the first real change.
export const RENAME_MONTHS = 6

/** When the reader may next change their name, or null if they may now. */
export function renameAvailableAt(changedAt: string | null | undefined): Date | null {
  if (!changedAt) return null
  const at = new Date(changedAt)
  if (Number.isNaN(at.getTime())) return null
  const next = new Date(at)
  next.setMonth(next.getMonth() + RENAME_MONTHS)
  return next > new Date() ? next : null
}

export const formatRenameDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
