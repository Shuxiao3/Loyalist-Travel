import { RichText as LexicalRichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

// Renders a Lexical document from Payload. Styling comes from the `.prose`
// pattern on the wrapper.
export function RichText({ data, className }: { data?: SerializedEditorState | null; className?: string }) {
  if (!data) return null
  return (
    <div className={className ? `prose ${className}` : 'prose'}>
      <LexicalRichText data={data} />
    </div>
  )
}
