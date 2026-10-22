import { permanentRedirect, redirect } from 'next/navigation'

import { LEGACY_ARTICLE_CATEGORY } from '@/lib/articleOptions'
import { getArticles } from '@/lib/articles'
import { ARTICLE_SECTIONS, ARTICLE_TOPICS, topicHref } from '@/lib/site'

// The old articles index. Articles now list under News (/news) and Guides (/guides), each with
// the topics Hotels, Airlines and Credit cards as tabs; article pages stay at /articles/<slug>.
// An old link lands on the list that took its place: /articles and ?category=news on News,
// ?category=guides on Guides (and the categories from before the rename on what they became),
// a topic on the section that carries more articles about it (News when even).

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

export default async function ArticlesIndex({ searchParams }: Props) {
  const asked = first((await searchParams).category)
  const category = (asked && LEGACY_ARTICLE_CATEGORY[asked]) || asked
  if (category === 'news' || category === 'guides') permanentRedirect(ARTICLE_SECTIONS[category].href)
  const topic = ARTICLE_TOPICS.find((t) => t.value === category)
  if (topic) {
    // which section holds the topic changes as articles are published, so this one is temporary
    const [news, guides] = await Promise.all([getArticles({ categories: ['news', topic.value], limit: 1 }), getArticles({ categories: ['guides', topic.value], limit: 1 })])
    redirect(topicHref(guides.totalDocs > news.totalDocs ? 'guides' : 'news', topic.value))
  }
  permanentRedirect(ARTICLE_SECTIONS.news.href)
}
