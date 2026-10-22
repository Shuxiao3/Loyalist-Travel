import type { Metadata } from 'next'

import { SectionIndex, sectionMetadata } from '@/components/SectionIndex'

export const revalidate = 300

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return sectionMetadata('guides', await searchParams)
}

// Guides (mockup: guides.html): the articles carrying the category "guides", newest first, with the
// topics as tabs (?topic=hotels, airlines, credit-cards). Built by src/components/SectionIndex.tsx.
export default async function GuidesPage({ searchParams }: Props) {
  return <SectionIndex section="guides" searchParams={await searchParams} />
}
