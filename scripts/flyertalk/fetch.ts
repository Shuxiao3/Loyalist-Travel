// FlyerTalk collector that runs on the GitHub runner (this sandbox cannot
// reach flyertalk.com). Two jobs:
//
//   --probe <threadId>          print how a thread page is built: status,
//                               title, which post markers appear, how the
//                               page count is stated, and a sample of HTML
//                               around the first post. Writes nothing.
//   --threads 1801359,123 --last-pages 5
//                               grab the last N pages of each thread into
//                               loyalist-pipeline/raw/ft_<id>.txt in the
//                               format 2_extract.py reads.
//   --forum <forumId> --pages 3 list thread titles and ids from a forum's
//                               listing pages, to find each hotel's thread.
//
// Plain HTTPS with a browser user agent, one request every DELAY ms.

import fs from 'fs'
import path from 'path'

import { DomUtils, parseDocument } from 'htmlparser2'
import type { AnyNode as Node, Element } from 'domhandler'

const args = process.argv.slice(2)
const arg = (n: string) => {
  const i = args.indexOf(n)
  return i >= 0 ? args[i + 1] : undefined
}
const DELAY = Number(arg('--delay') ?? 3000)
const BASE = 'https://www.flyertalk.com/forum'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
const RAW = path.resolve(process.cwd(), 'loyalist-pipeline/raw')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function get(url: string): Promise<{ status: number; body: string; headers: Headers }> {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.9' }, redirect: 'follow' })
  return { status: res.status, body: await res.text(), headers: res.headers }
}

// ---- tiny DOM helpers over htmlparser2 ----------------------------------------
const isEl = (n: Node): n is Element => n.type === 'tag'
const attr = (el: Element, name: string) => el.attribs?.[name] ?? ''
const classes = (el: Element) => attr(el, 'class').split(/\s+/).filter(Boolean)
const all = (root: Node | Node[], pred: (el: Element) => boolean): Element[] => DomUtils.findAll((n) => isEl(n) && pred(n), Array.isArray(root) ? root : [root]) as Element[]
const first = (root: Node | Node[], pred: (el: Element) => boolean): Element | null => all(root, pred)[0] ?? null
const text = (n: Node | Node[]) => DomUtils.textContent(n)

function postText(bodyEl: Element): string {
  // drop quotes, signatures, attachments, scripts, then turn breaks into newlines
  const clone = bodyEl.cloneNode(true) as Element
  for (const el of all(clone, (e) => {
    const c = classes(e)
    return c.some((x) => ['bbcode_container', 'quote_container', 'signature', 'after_content', 'attachments', 'bbcode_quote', 'quote'].includes(x)) || e.name === 'script' || e.name === 'style' || (e.name === 'blockquote' && e !== clone)
  })) DomUtils.removeElement(el)
  const parts: string[] = []
  const walk = (n: Node) => {
    if (n.type === 'text') parts.push((n as { data: string }).data)
    else if (isEl(n)) {
      if (n.name === 'br') parts.push('\n')
      for (const c of n.children) walk(c)
      if (['p', 'div', 'li', 'tr'].includes(n.name)) parts.push('\n')
    }
  }
  walk(clone)
  return parts
    .join('')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function totalPages(doc: Node[]): number {
  const t = text(doc)
  const m = t.match(/Page\s+\d+\s+of\s+([\d,]+)/i)
  if (m) return Number(m[1].replace(/,/g, ''))
  const pages = all(doc, (e) => e.name === 'a' && /page=(\d+)/.test(attr(e, 'href'))).map((a) => Number(attr(a, 'href').match(/page=(\d+)/)![1]))
  return pages.length ? Math.max(...pages) : 1
}

function threadTitle(doc: Node[]): string {
  const h1 = first(doc, (e) => e.name === 'h1')
  const t = h1 ? text(h1) : text(first(doc, (e) => e.name === 'title') ?? [])
  return t.replace(/\s+/g, ' ').replace(/\s*-\s*FlyerTalk Forums$/, '').trim()
}

type Post = { postId: string; number: string; date: string; url: string; text: string }

function parsePosts(doc: Node[], threadId: string): Post[] {
  const bodies = all(doc, (e) => /^post_message_\d+$/.test(attr(e, 'id')))
  const posts: Post[] = []
  for (const bodyEl of bodies) {
    const postId = attr(bodyEl, 'id').replace('post_message_', '')
    // the post container is the nearest ancestor with id post_<id> or a postbit class
    let container: Element | null = bodyEl
    while (container && !(attr(container, 'id') === `post_${postId}` || attr(container, 'id') === `post${postId}` || classes(container).some((c) => /postbit|postcontainer/.test(c)))) container = container.parent && isEl(container.parent as Node) ? (container.parent as Element) : null
    const scope = container ?? bodyEl
    const dateEl = first(scope, (e) => classes(e).includes('date') || classes(e).includes('postdate') || (e.name === 'span' && classes(e).includes('time')))
    const counterEl = first(scope, (e) => classes(e).includes('postcounter') || /^postcount\d+$/.test(attr(e, 'id')))
    const body = postText(bodyEl)
    if (!body) continue
    posts.push({
      postId,
      number: counterEl ? text(counterEl).replace(/[^\d]/g, '') : '',
      date: dateEl ? text(dateEl).replace(/\s+/g, ' ').trim() : '',
      url: `${BASE}/showthread.php?t=${threadId}&p=${postId}#post${postId}`,
      text: body,
    })
  }
  return posts
}

function render(thread: { id: string; title: string; total: number }, pages: { page: number; posts: Post[] }[]): string {
  const lines = [`### THREAD ${thread.id}`, `### THREAD_TITLE ${thread.title}`, `### THREAD_URL ${BASE}/showthread.php?t=${thread.id}`, `### SOURCE FlyerTalk`, `### GRABBED_AT ${new Date().toISOString()}`, `### PAGES ${pages.map((p) => p.page).join(',')} of ${thread.total}`, '']
  for (const page of pages) {
    lines.push(`### PAGE ${page.page}`, '')
    for (const post of page.posts) lines.push(`--- POST ${post.postId}`, `NUMBER: ${post.number}`, `DATE: ${post.date}`, `URL: ${post.url}`, 'BODY:', post.text, '--- END POST', '')
  }
  return lines.join('\n')
}


// ---- Internet Archive ------------------------------------------------------------
// flyertalk.com sits behind a Cloudflare challenge, so the runner reads the
// Wayback Machine's copies instead. A thread lives at two kinds of address:
// showthread.php?t=<id>[&page=N] and the pretty /forum/<forum>/<id>-<slug>[-N].html.
type Snap = { ts: string; original: string; page: number }

async function cdx(pattern: string, extra = ''): Promise<{ ts: string; original: string }[]> {
  const url = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(pattern)}${extra}&filter=statuscode:200&filter=mimetype:text/html&fl=timestamp,original&output=json&limit=5000`
  const r = await get(url)
  if (r.status !== 200) {
    console.log(`cdx ${r.status} for ${pattern}`)
    return []
  }
  try {
    const rows = JSON.parse(r.body) as string[][]
    return rows.slice(1).map(([ts, original]) => ({ ts, original }))
  } catch {
    return []
  }
}

function pageOf(original: string): number {
  const m = original.match(/[?&]page=(\d+)/) ?? original.match(/-(\d+)\.html/)
  return m ? Number(m[1]) : 1
}

async function archivedPages(threadId: string): Promise<Snap[]> {
  const found = new Map<string, Snap>()
  const add = (rows: { ts: string; original: string }[]) => {
    for (const r of rows) {
      if (!r.original.includes(threadId)) continue
      const page = pageOf(r.original)
      const key = String(page)
      const prev = found.get(key)
      if (!prev || r.ts > prev.ts) found.set(key, { ts: r.ts, original: r.original, page })
    }
  }
  add(await cdx(`flyertalk.com/forum/showthread.php?t=${threadId}`, '&matchType=prefix'))
  await sleep(1000)
  add(await cdx(`flyertalk.com/forum/*/${threadId}-*`, ''))
  return [...found.values()].sort((a, b) => a.page - b.page)
}

async function getArchived(snap: Snap): Promise<string> {
  const r = await get(`https://web.archive.org/web/${snap.ts}id_/${snap.original}`)
  return r.status === 200 ? r.body : ''
}

async function archiveProbe(threadId: string) {
  const snaps = await archivedPages(threadId)
  console.log(`${snaps.length} archived page(s) for thread ${threadId}`)
  for (const s of snaps.slice(0, 60)) console.log(`  page ${String(s.page).padStart(3)}  ${s.ts}  ${s.original}`)
  const pick = snaps[snaps.length - 1]
  if (!pick) return
  console.log(`\nfetching the newest, page ${pick.page} as of ${pick.ts}`)
  const body = await getArchived(pick)
  const doc = parseDocument(body).children
  console.log(`title: ${threadTitle(doc)}; ${body.length} bytes; page count text: ${(body.match(/Page\s+\d+\s+of\s+[\d,]+/i) ?? ['not found'])[0]}; totalPages() => ${totalPages(doc)}`)
  const posts = parsePosts(doc, threadId)
  console.log(`parsePosts => ${posts.length} posts`)
  for (const p of posts.slice(0, 3)) console.log(`  #${p.number} ${p.postId} ${p.date} | ${p.text.slice(0, 160).replace(/\n/g, ' ')}`)
  if (!posts.length) {
    const j = body.search(/post_message_|postbit|<article|js-post/)
    console.log('\n--- sample ---')
    console.log(j >= 0 ? body.slice(Math.max(0, j - 1500), j + 1500) : body.slice(0, 3000))
  }
}

async function grabArchived(ids: string[], lastPages: number) {
  fs.mkdirSync(RAW, { recursive: true })
  for (const id of ids) {
    const snaps = await archivedPages(id)
    if (!snaps.length) {
      console.log(`${id}: nothing archived`)
      continue
    }
    const total = Math.max(...snaps.map((s) => s.page))
    const wanted = snaps.filter((s) => s.page > total - lastPages)
    const pages: { page: number; posts: Post[] }[] = []
    let title = ''
    for (const s of wanted) {
      await sleep(DELAY)
      const body = await getArchived(s)
      if (!body) {
        console.log(`  page ${s.page}: archive fetch failed`)
        continue
      }
      const doc = parseDocument(body).children
      title = title || threadTitle(doc)
      const posts = parsePosts(doc, id)
      console.log(`  page ${s.page} (${s.ts.slice(0, 8)}): ${posts.length} posts`)
      pages.push({ page: s.page, posts })
    }
    const n = pages.reduce((a, p) => a + p.posts.length, 0)
    if (!n) {
      console.log(`${id}: nothing parsed, no file written`)
      continue
    }
    fs.writeFileSync(path.join(RAW, `ft_${id}.txt`), render({ id, title, total }, pages))
    console.log(`${id}: "${title}" wrote ft_${id}.txt (${n} posts from ${pages.length} archived pages of ${total})`)
  }
}

// ---- modes ---------------------------------------------------------------------
async function probe(threadId: string) {
  const url = `${BASE}/showthread.php?t=${threadId}`
  const r = await get(url)
  console.log(`status ${r.status}, ${r.body.length} bytes, server=${r.headers.get('server') ?? '?'}, cf=${r.headers.get('cf-ray') ? 'yes' : 'no'}`)
  const doc = parseDocument(r.body).children
  console.log(`title: ${threadTitle(doc)}`)
  if (/challenge-platform|cf-chl|Just a moment|Attention Required/i.test(r.body)) console.log('looks like a Cloudflare challenge page')
  const counts: Record<string, number> = {
    'id=post_message_N': (r.body.match(/id="post_message_\d+"/g) ?? []).length,
    'id=post_N': (r.body.match(/id="post_\d+"/g) ?? []).length,
    'id=postN': (r.body.match(/id="post\d+"/g) ?? []).length,
    'class postbit*': (r.body.match(/class="[^"]*postbit[^"]*"/g) ?? []).length,
    'class postcontent': (r.body.match(/postcontent/g) ?? []).length,
    'class postcounter': (r.body.match(/postcounter/g) ?? []).length,
    'bbcode_container': (r.body.match(/bbcode_container/g) ?? []).length,
    'class="date"': (r.body.match(/class="date"/g) ?? []).length,
    'js-post / b-post': (r.body.match(/js-post|b-post/g) ?? []).length,
    'article': (r.body.match(/<article/g) ?? []).length,
    'data-node-id': (r.body.match(/data-node-id/g) ?? []).length,
  }
  for (const [k, v] of Object.entries(counts)) if (v) console.log(`  ${String(v).padStart(4)}  ${k}`)
  const pm = r.body.match(/Page\s+\d+\s+of\s+[\d,]+/i)
  console.log(`page count text: ${pm ? pm[0] : 'not found'}; totalPages() => ${totalPages(doc)}`)
  const posts = parsePosts(doc, threadId)
  console.log(`parsePosts => ${posts.length} posts`)
  for (const p of posts.slice(0, 2)) console.log(`  #${p.number} ${p.postId} ${p.date} | ${p.text.slice(0, 160).replace(/\n/g, ' ')}`)
  const i = r.body.search(/id="post_message_\d+"/)
  const j = i >= 0 ? i : r.body.search(/postbit|<article|js-post/)
  console.log('\n--- sample around the first post marker ---')
  console.log(j >= 0 ? r.body.slice(Math.max(0, j - 1800), j + 1200) : r.body.slice(0, 3000))
}

async function grab(ids: string[], lastPages: number) {
  fs.mkdirSync(RAW, { recursive: true })
  for (const id of ids) {
    const firstPage = await get(`${BASE}/showthread.php?t=${id}`)
    if (firstPage.status !== 200) {
      console.log(`${id}: status ${firstPage.status}, skipped`)
      continue
    }
    const firstDoc = parseDocument(firstPage.body).children
    const total = totalPages(firstDoc)
    const title = threadTitle(firstDoc)
    const from = Math.max(1, total - lastPages + 1)
    console.log(`${id}: "${title}" — ${total} pages, taking ${from}–${total}`)
    const pages: { page: number; posts: Post[] }[] = []
    for (let page = from; page <= total; page++) {
      await sleep(DELAY)
      const doc = page === 1 ? firstDoc : parseDocument((await get(`${BASE}/showthread.php?t=${id}&page=${page}`)).body).children
      const posts = parsePosts(doc, id)
      console.log(`  page ${page}: ${posts.length} posts`)
      pages.push({ page, posts })
    }
    const n = pages.reduce((a, p) => a + p.posts.length, 0)
    if (!n) {
      console.log(`${id}: nothing parsed, no file written`)
      continue
    }
    fs.writeFileSync(path.join(RAW, `ft_${id}.txt`), render({ id, title, total }, pages))
    console.log(`${id}: wrote ft_${id}.txt (${n} posts)`)
  }
}

async function forum(forumId: string, pages: number) {
  const out: { id: string; title: string; replies: string }[] = []
  for (let page = 1; page <= pages; page++) {
    if (page > 1) await sleep(DELAY)
    const r = await get(`${BASE}/forumdisplay.php?f=${forumId}&page=${page}`)
    if (r.status !== 200) {
      console.log(`page ${page}: status ${r.status}`)
      break
    }
    const doc = parseDocument(r.body).children
    const links = all(doc, (e) => e.name === 'a' && /^thread_title_\d+$/.test(attr(e, 'id')))
    for (const a of links) out.push({ id: attr(a, 'id').replace('thread_title_', ''), title: text(a).trim(), replies: '' })
    console.log(`page ${page}: ${links.length} threads`)
    if (!links.length) {
      console.log('--- sample ---')
      console.log(r.body.slice(0, 2500))
      break
    }
  }
  const file = path.resolve(process.cwd(), `loyalist-pipeline/data/flyertalk_forum_${forumId}.csv`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, 'thread_id,title\n' + out.map((t) => `${t.id},"${t.title.replace(/"/g, '""')}"`).join('\n') + '\n')
  console.log(`wrote ${out.length} threads to ${path.relative(process.cwd(), file)}`)
}

async function main() {
  if (arg('--probe')) return probe(arg('--probe')!)
  if (arg('--archive-probe')) return archiveProbe(arg('--archive-probe')!)
  if (arg('--threads') && args.includes('--archive')) return grabArchived(arg('--threads')!.split(',').map((s) => s.trim()).filter(Boolean), Number(arg('--last-pages') ?? 5))
  if (arg('--forum')) return forum(arg('--forum')!, Number(arg('--pages') ?? 3))
  if (arg('--threads')) return grab(arg('--threads')!.split(',').map((s) => s.trim()).filter(Boolean), Number(arg('--last-pages') ?? 5))
  console.log('Give --probe <threadId>, --archive-probe <threadId>, --forum <forumId> [--pages N], or --threads a,b [--last-pages N] [--archive]')
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
