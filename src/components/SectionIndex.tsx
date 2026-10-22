import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ARTICLES_PER_PAGE, articleImage, getArticles } from '@/lib/articles'
import { shortDate } from '@/lib/format'
import { pageMeta } from '@/lib/seo'
import { ARTICLE_SECTIONS, ARTICLE_TOPICS, type ArticleSection, SITE, TOPIC_PARAM, topicHref } from '@/lib/site'
import type { Article } from '@/payload-types'

import { PageNumbers } from './PageNumbers'
import styles from './SectionIndex.module.css'

// The News and Guides lists (mockups: news.html, guides.html; css/articles.css). The navy band
// holds the title, one line and the topic tabs (All, Hotels, Airlines, Credit cards, as
// ?topic=). Below: on page 1 the lead (the newest featured article, else the newest), then the
// rest as story rows, newest first, with page numbers; beside them the other section's latest.
// No counts.

const DEK: Record<ArticleSection, string> = {
  news: 'Program changes, card launches and status matches across hotels and airlines.',
  guides: 'What each status gets you, which milestone to pick, and where to stay on points.',
}

const SIDE_STORIES = 5
// story rows per page; the first page also carries the lead
const ROWS_PER_PAGE = ARTICLES_PER_PAGE - 1

type SearchParams = Record<string, string | string[] | undefined>
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined
const topicOf = (sp: SearchParams) => ARTICLE_TOPICS.find((t) => t.value === first(sp[TOPIC_PARAM]))
const pageOf = (sp: SearchParams) => Math.max(1, Math.floor(Number(first(sp.page))) || 1)

// The list's address for a topic and page
function listHref(section: ArticleSection, topic: string | undefined, page = 1) {
  const base = topicHref(section, topic)
  return page > 1 ? `${base}${base.includes('?') ? '&' : '?'}page=${page}` : base
}

export function sectionMetadata(section: ArticleSection, sp: SearchParams): Metadata {
  const s = ARTICLE_SECTIONS[section]
  const topic = topicOf(sp)
  return pageMeta({ title: topic ? `${s.label}: ${topic.label}` : s.label, description: DEK[section], path: listHref(section, topic?.value, pageOf(sp)) })
}

export async function SectionIndex({ section, searchParams: sp }: { section: ArticleSection; searchParams: SearchParams }) {
  const s = ARTICLE_SECTIONS[section]
  const other: ArticleSection = section === 'news' ? 'guides' : 'news'
  const asked = first(sp[TOPIC_PARAM])
  const topic = topicOf(sp)
  // a topic the site does not have shows the whole section
  if (asked && !topic) redirect(s.href)
  const page = pageOf(sp)
  const categories = [section, ...(topic ? [topic.value] : [])]
  // The lead is the newest featured article, else the newest; the rows below it, on every page,
  // are the rest, newest first.
  const [leadRes, side] = await Promise.all([getArticles({ categories, limit: 1, featuredFirst: true }), getArticles({ category: other, limit: SIDE_STORIES })])
  const lead = leadRes.docs[0]
  const result = await getArticles({ categories, page, limit: ROWS_PER_PAGE, excludeId: lead?.id })
  // A page past the end (an old link, after articles moved or went) goes to the last one
  if (page > 1 && result.docs.length === 0) redirect(listHref(section, topic?.value, Math.max(1, result.totalPages)))
  const rows = result.docs
  const tabs = [{ value: undefined, label: 'All' }, ...ARTICLE_TOPICS]

  return (
    <>
      <section className="band page-band">
        <div className="wrap">
          <div className="pb-row">
            <div className="pb-title">
              <h1>{s.label}</h1>
              <p className="pb-dek">{DEK[section]}</p>
            </div>
          </div>
          <nav className="tabs" aria-label="Topics">
            {tabs.map((t) => {
              const on = topic?.value === t.value
              return (
                <Link key={t.value ?? 'all'} className={on ? 'on' : undefined} aria-current={on ? 'page' : undefined} href={topicHref(section, t.value)}>
                  {t.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </section>

      <main className="wrap main">
        <div className="grid-side">
          <div>
            {!lead ? (
              <p className="empty">
                {topic ? `Nothing about ${topic.label.toLowerCase()} in ${s.label} yet.` : `Nothing in ${s.label} yet.`}{' '}
                {topic && (
                  <Link className="link" href={s.href}>
                    {s.all}
                  </Link>
                )}
              </p>
            ) : (
              <>
                {page === 1 && <Lead article={lead} />}
                {rows.length > 0 && (
                  <ol className={`stories stories-lg ${styles.rows}`}>
                    {rows.map((a) => (
                      <Row key={a.id} article={a} />
                    ))}
                  </ol>
                )}
              </>
            )}
            <PageNumbers page={result.page ?? 1} totalPages={result.totalPages} href={(p) => listHref(section, topic?.value, p)} />
          </div>

          {side.docs.length > 0 && (
            <aside className={styles.side}>
              <section className="mod" aria-labelledby="side-h">
                <div className="mod-head">
                  <h2 id="side-h">{ARTICLE_SECTIONS[other].latest}</h2>
                  <Link href={ARTICLE_SECTIONS[other].href}>{ARTICLE_SECTIONS[other].all}</Link>
                </div>
                <ol className="stories stories-tight">
                  {side.docs.map((a) => (
                    <Row key={a.id} article={a} tight />
                  ))}
                </ol>
              </section>
            </aside>
          )}
        </div>
      </main>
    </>
  )
}

// The newest article: a large photo beside the headline, the dek and the byline
function Lead({ article: a }: { article: Article }) {
  const href = `/articles/${a.slug}`
  const img = articleImage(a)
  const date = shortDate(a.publishedDate)
  return (
    <article className={`${styles.lead}${img ? '' : ` ${styles.leadText}`}`}>
      {img && (
        <Link className="img-box" href={href} tabIndex={-1} aria-hidden="true">
          <img src={img} alt="" fetchPriority="high" />
        </Link>
      )}
      <div>
        <h2>
          <Link href={href}>{a.title}</Link>
        </h2>
        {a.dek && <p className="dek">{a.dek}</p>}
        <p className="byline">
          By <b>{SITE.author}</b>
          {date && <> &middot; {date}</>}
        </p>
      </div>
    </article>
  )
}

// A story row: thumbnail (when the article has a photo), headline, dek and date. Side lists
// (tight) leave out the dek.
function Row({ article: a, tight }: { article: Article; tight?: boolean }) {
  const href = `/articles/${a.slug}`
  const img = articleImage(a)
  return (
    <li className={img ? undefined : 'no-img'}>
      {img && (
        <Link className="img-box" href={href} tabIndex={-1} aria-hidden="true">
          <img src={img} alt="" loading="lazy" />
        </Link>
      )}
      <div>
        <h3>
          <Link href={href}>{a.title}</Link>
        </h3>
        {!tight && a.dek && <p className="dek">{a.dek}</p>}
        <p className="byline">{shortDate(a.publishedDate)}</p>
      </div>
    </li>
  )
}
