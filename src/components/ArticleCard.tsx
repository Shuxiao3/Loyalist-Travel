import Link from 'next/link'

import { ARTICLE_CATEGORY_LABEL } from '@/collections/Articles'
import { articleImage } from '@/lib/articles'
import { shortDate } from '@/lib/format'
import type { Article } from '@/payload-types'

// An article on the hub and the homepage. The whole card is the link.
export function ArticleCard({ article, tone = 'a' }: { article: Article; tone?: 'a' | 'b' | 'c' }) {
  const image = articleImage(article)
  return (
    <Link className="card card-link" href={`/articles/${article.slug}`}>
      <div className={`img ${tone}`} role="img" aria-label={article.title} style={image ? { backgroundImage: `url(${image}), var(--img-${tone})` } : undefined} />
      <div className="body">
        <div className="meta">
          <span>{ARTICLE_CATEGORY_LABEL[article.category] ?? article.category}</span>
        </div>
        <h3>{article.title}</h3>
        {article.dek && <p>{article.dek}</p>}
        <div className="foot">
          <span />
          <div className="when">{shortDate(article.publishedDate)}</div>
        </div>
      </div>
    </Link>
  )
}
