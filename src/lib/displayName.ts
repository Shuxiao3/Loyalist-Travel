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
