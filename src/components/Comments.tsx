import { type CommentTarget, getComments } from '@/lib/comments'
import { rel, shortDate } from '@/lib/format'
import type { Reader } from '@/payload-types'

import { CommentForm } from './CommentForm'
import styles from './Comments.module.css'

// Approved comments under a page, and the form to add one.
export async function Comments({ kind, id }: { kind: CommentTarget; id: number }) {
  const comments = await getComments(kind, id)
  return (
    <section className={`section ${styles.section}`} aria-labelledby="comments-h">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow on-light">Readers</span>
            <h2 id="comments-h">{comments.length === 0 ? 'Comments' : `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`}</h2>
          </div>
        </div>
        <div className={styles.grid}>
          <div className={`panel ${styles.formPanel}`}>
            <CommentForm kind={kind} id={id} />
          </div>
          {comments.length > 0 ? (
            <ol className={styles.list}>
              {comments.map((c) => {
                const who = rel<Reader>(c.reader)
                return (
                  <li className={styles.item} key={c.id}>
                    <div className={styles.meta}>
                      <span className={styles.who}>{who?.displayName ?? 'Reader'}</span>
                      <span className={styles.when}>{shortDate(c.createdAt)}</span>
                    </div>
                    <p className={styles.body}>{c.body}</p>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className={styles.empty}>No comments yet. Be the first.</p>
          )}
        </div>
      </div>
    </section>
  )
}
