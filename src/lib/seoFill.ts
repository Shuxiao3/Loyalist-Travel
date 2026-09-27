// Fills {Placeholder} tokens in a search title or description and tidies
// the punctuation left behind by an empty one. No server imports, so the
// admin preview can use it too.
export function fill(template: string, vars: Record<string, string | null | undefined>): string {
  return template
    .replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '')
    .replace(/\s*,\s*(?=,|:|\.|$)/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.:;])/g, '$1')
    .trim()
}
