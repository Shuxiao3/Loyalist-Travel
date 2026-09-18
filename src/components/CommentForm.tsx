'use client'

import { useActionState } from 'react'

import { type CommentState, submitComment } from '@/app/actions/submitComment'
import { COMMENT_MAX } from '@/collections/Comments'
import type { CommentTarget } from '@/lib/comments'
import { useReader } from '@/lib/useReader'

import styles from './Comments.module.css'

export function CommentForm({ kind, id }: { kind: CommentTarget; id: number }) {
  const reader = useReader()
  const [state, action, pending] = useActionState<CommentState, FormData>(submitComment, null)
  if (!reader.loaded) return <div className={styles.formSpace} aria-hidden="true" />
  if (!reader.signedIn) {
    const next = typeof window !== 'undefined' ? window.location.pathname : '/'
    return (
      <p className={styles.signIn}>
        <a href={`/login?next=${encodeURIComponent(next)}`}>Sign in</a> to leave a comment under your name.
      </p>
    )
  }
  if (!reader.name) {
    return (
      <p className={styles.signIn}>
        <a href="/account">Pick a display name</a> to comment.
      </p>
    )
  }
  if (state?.ok) return <p className={styles.thanks}>Thank you. Your comment is in the queue and appears once it has been read.</p>
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <div className={styles.hp} aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className={styles.field}>
        <span className="label">Comment as {reader.name}</span>
        <textarea name="body" rows={4} maxLength={COMMENT_MAX} required placeholder="Keep it about the stay. Read before it posts." />
      </label>
      {state && !state.ok && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      <div className={styles.actions}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'Sending' : 'Post comment'}
        </button>
        <span className={styles.fine}>Plain text, no links. Every comment is read before it appears.</span>
      </div>
    </form>
  )
}
