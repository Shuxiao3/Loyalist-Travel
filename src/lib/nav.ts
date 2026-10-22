// The stories in the header's Programs, News and Guides menus. The header sits on every page,
// so they are read once and kept for five minutes, the pages' own revalidation time.

import { unstable_cache } from 'next/cache'

import type { Article } from '@/payload-types'

import { mainArticleCategory } from './articleOptions'
import { articleImage, getArticles } from './articles'
import { shortDate } from './format'
import { categoryName } from './site'

export type MenuStory = { href: string; title: string; image: string | null; category: string | null; date: string | null }

// programs: the latest guides about the programs (guides with a related program);
// news and guides: the latest of each.
export type HeaderMenus = { programs: MenuStory[]; news: MenuStory[]; guides: MenuStory[] }

const MENU_STORIES = 3

const story = (a: Article): MenuStory => ({
  href: `/articles/${a.slug}`,
  title: a.title,
  image: articleImage(a),
  category: categoryName(mainArticleCategory(a)),
  date: shortDate(a.publishedDate),
})

const readMenus = unstable_cache(
  async (): Promise<HeaderMenus> => {
    const [news, guides] = await Promise.all([getArticles({ category: 'news', limit: MENU_STORIES }), getArticles({ category: 'guides', limit: 24 })])
    return {
      programs: guides.docs.filter((a) => (a.related?.programs ?? []).length > 0).slice(0, MENU_STORIES).map(story),
      news: news.docs.map(story),
      guides: guides.docs.slice(0, MENU_STORIES).map(story),
    }
  },
  ['header-menus'],
  { revalidate: 300 },
)

// A failed read is not kept: the menus open with their links alone and the next page asks again.
export async function getHeaderMenus(): Promise<HeaderMenus> {
  try {
    return await readMenus()
  } catch (err) {
    console.error('header menus:', err)
    return { programs: [], news: [], guides: [] }
  }
}
