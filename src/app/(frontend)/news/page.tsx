import type { Metadata } from 'next'

import { SectionIndex, sectionMetadata } from '@/components/SectionIndex'

export const revalidate = 300

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return sectionMetadata('news', await searchParams)
}

// News (mockup: news.html): the articles carrying the category "news", newest first, with the
// topics as tabs (?topic=hotels, airlines, credit-cards). Built by src/components/SectionIndex.tsx.
export default async function NewsPage({ searchParams }: Props) {
  return <SectionIndex section="news" searchParams={await searchParams} />
}
