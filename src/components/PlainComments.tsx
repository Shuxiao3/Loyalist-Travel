import { type CommentTarget, getComments } from '@/lib/comments'
import { rel, shortDate } from '@/lib/format'
import type { Reader } from '@/payload-types'

import { PlainCommentForm } from './PlainCommentForm'
import styles from './PlainComments.module.css'

// Comments in the kit's plain style (the mockups' review, article and lounge pages): a section
// head, the sign-in line or the form, then the approved comments as plain lines, newest first.
// The page places it and gives it its spacing class; #comments is its jump target.
export async function PlainComments({ kind, id, className }: { kind: CommentTarget; id: number; className?: string }) {
  const comments = await getComments(kind, id)
  return (
    <section className={className} id="comments" aria-labelledby="comments-h">
      <div className="mod-head">
        <h2 id="comments-h">Comments</h2>
      </div>
      <PlainCommentForm kind={kind} id={id} />
      {comments.length > 0 ? (
        <ol className={styles.list}>
          {comments.map((c) => {
            const who = rel<Reader>(c.reader)
            return (
              <li key={c.id}>
                <p className={styles.who}>
                  <b>{who?.displayName ?? 'Reader'}</b> &middot; {shortDate(c.createdAt)}
                </p>
                <p className={styles.body}>{c.body}</p>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="note">No comments yet. Be the first.</p>
      )}
    </section>
  )
}
