'use client'

import { useActionState, useId, useState } from 'react'

import { type CommentState, submitComment } from '@/app/actions/submitComment'
import { COMMENT_MAX } from '@/lib/commentOptions'
import type { CommentTarget } from '@/lib/comments'
import { useReader } from '@/lib/useReader'

import styles from './PlainComments.module.css'

// The sign-in line, or for a signed-in reader with a display name the comment form, in the
// kit's form classes. Posts through the submitComment server action.
export function PlainCommentForm({ kind, id }: { kind: CommentTarget; id: number }) {
  const reader = useReader()
  const fieldId = useId()
  // held here so a refused comment ("Write a little more") keeps its text: the form resets after
  // every action, and only a controlled field survives that
  const [body, setBody] = useState('')
  const [state, action, pending] = useActionState<CommentState, FormData>(submitComment, null)
  if (!reader.loaded) {
    return (
      <p className="c-signin" aria-hidden="true">
        &nbsp;
      </p>
    )
  }
  if (!reader.signedIn) {
    const next = typeof window !== 'undefined' ? window.location.pathname : '/'
    return (
      <p className="c-signin">
        <a className="link" href={`/login?next=${encodeURIComponent(next)}`}>
          Sign in
        </a>{' '}
        to leave a comment under your name.
      </p>
    )
  }
  if (!reader.name) {
    return (
      <p className="c-signin">
        <a className="link" href="/account">
          Pick a display name
        </a>{' '}
        to comment.
      </p>
    )
  }
  if (state?.ok) return <p className={`form-ok ${styles.thanks}`}>Thank you. Your comment is in the queue and appears once it has been read.</p>
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <div className={styles.hp} aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className={`field${state && !state.ok ? ' is-error' : ''}`}>
        <label className="label" htmlFor={fieldId}>
          Comment as {reader.name}
        </label>
        <textarea className="textarea" id={fieldId} name="body" rows={4} maxLength={COMMENT_MAX} required placeholder="Keep it about the stay. Read before it posts." value={body} onChange={(e) => setBody(e.target.value)} />
        {state && !state.ok && (
          <p className="err" role="alert">
            {state.error}
          </p>
        )}
      </div>
      <div className={`form-actions ${styles.actions}`}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'Sending' : 'Post comment'}
        </button>
        <p className="help">Plain text, no links. Every comment is read before it appears.</p>
      </div>
    </form>
  )
}
