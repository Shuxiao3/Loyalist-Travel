// The comment length limit, in a plain module so client components can import
// it without pulling the collection — and through it the Payload config and
// everything server-only behind it — into the browser bundle. Same reason the
// reader-stay answer lists live in stayOptions.
export const COMMENT_MAX = 1000
