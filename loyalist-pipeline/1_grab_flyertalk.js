// Grabs FlyerTalk thread pages from inside the browser and downloads one
// ft_<threadId>.txt per thread for 2_extract.py to read.
//
// It runs in the console rather than on a server so the requests carry your
// own session and look like the browsing they are. Same-origin fetch, one
// page at a time, DELAY_MS apart.
//
//   1. Open any flyertalk.com page in Chrome.
//   2. Edit CONFIG below.
//   3. Cmd+Option+J, type `allow pasting` if prompted, paste this, Enter.
//   4. Allow multiple downloads when Chrome asks.
//   5. Move the ft_<id>.txt files into raw/.
//
// Pull recent pages only and leave DELAY_MS at 3000 or more. This is still
// automated collection: go slow.

const CONFIG = {
  // Thread ids to grab. The default is the Park Hyatt Kyoto pilot; the ids
  // live in the thread_id column of park_hyatt_flyertalk_threads.csv.
  THREAD_IDS: [1801359],

  // How many pages to take, counting back from the newest. The last pages
  // hold the recent stays; the first pages are a decade old.
  LAST_N_PAGES: 5,

  // Milliseconds between page requests. Keep at 3000 or more.
  DELAY_MS: 3000,
}

;(async () => {
  const BASE = 'https://www.flyertalk.com/forum/showthread.php'

  if (!location.hostname.endsWith('flyertalk.com')) {
    console.error('Run this from a flyertalk.com tab: the fetches are same-origin and use your session.')
    return
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const pageUrl = (threadId, page) => `${BASE}?t=${threadId}&page=${page}`

  // Fetches one page and parses it into a document. Throws on anything that
  // is not a 200, so a rate limit or a login wall stops the run instead of
  // being written to the file as an error page.
  async function getDoc(url) {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
    const html = await res.text()
    return new DOMParser().parseFromString(html, 'text/html')
  }

  // vBulletin states the page count in a few places depending on the theme.
  // Try each, then fall back to the highest page= link on the page, then to
  // a single page.
  function totalPages(doc) {
    const counter = doc.querySelector('#pagination_top a.popupctrl, .pagenav a.popupctrl, .threadpagenav .popupctrl')
    const stated = counter && counter.textContent.match(/of\s+([\d,]+)/i)
    if (stated) return Number(stated[1].replace(/,/g, ''))

    const lastLink = doc.querySelector('.pagenav span.first_last a[href*="page="], a[title^="Last Page"]')
    const fromLast = lastLink && lastLink.getAttribute('href').match(/page=(\d+)/)
    if (fromLast) return Number(fromLast[1])

    const pages = [...doc.querySelectorAll('a[href*="page="]')]
      .map((a) => Number((a.getAttribute('href').match(/page=(\d+)/) || [])[1]))
      .filter((n) => Number.isFinite(n))
    return pages.length ? Math.max(...pages) : 1
  }

  function threadTitle(doc) {
    const el = doc.querySelector('h1 .threadtitle, h1, title')
    return el ? el.textContent.replace(/\s+/g, ' ').trim().replace(/\s*-\s*FlyerTalk Forums$/, '') : ''
  }

  // The post's own words, without the parts that are not its own words.
  // Quoted blocks go first: leaving them in makes one member's stay look
  // like the poster's, which is the one mistake this file must not make.
  //
  // vBulletin wraps a post's own words in blockquote.postcontent and puts a
  // quoted post in a .bbcode_container inside it, holding another one. So
  // take that outer blockquote as the root, then drop every blockquote left
  // inside it — those are the quotes.
  function postText(body) {
    const main = body.matches('blockquote.postcontent')
      ? body
      : body.querySelector('blockquote.postcontent') || body
    const clone = main.cloneNode(true)
    clone
      .querySelectorAll('.bbcode_container, .quote_container, blockquote.postcontent, .signature, .after_content, .attachments, script, style')
      .forEach((el) => el.remove())
    clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
    clone.querySelectorAll('p, div, li, tr').forEach((el) => el.append('\n'))
    return clone.textContent
      .replace(/ /g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  // One page of posts. Themes differ, so the selectors are tried in order
  // and the first that finds posts wins.
  function parsePosts(doc, threadId) {
    const containers =
      [...doc.querySelectorAll('#posts > li[id^="post_"], li.postbitlegacy, li.postcontainer, div[id^="post_"]')]
        .filter((el) => /^post_?\d+$/.test(el.id) || el.querySelector('[id^="post_message_"]'))

    const posts = []
    for (const el of containers) {
      const bodyEl = el.querySelector('[id^="post_message_"], .postbody .content, .content')
      if (!bodyEl) continue

      const idMatch = (el.id || '').match(/(\d+)/) || (bodyEl.id || '').match(/(\d+)/)
      const postId = idMatch ? idMatch[1] : ''
      const text = postText(bodyEl)
      if (!text) continue

      const dateEl = el.querySelector('.postdate .date, .date')
      const counterEl = el.querySelector('a.postcounter, .postcounter, .nodecontrols a')

      posts.push({
        postId,
        number: counterEl ? counterEl.textContent.replace(/[^\d]/g, '') : '',
        date: dateEl ? dateEl.textContent.replace(/\s+/g, ' ').trim() : '',
        url: postId ? `https://www.flyertalk.com/forum/showthread.php?t=${threadId}&p=${postId}#post${postId}` : '',
        text,
      })
    }
    return posts
  }

  // The file 2_extract.py reads. Fixed markers, one block per post, so the
  // Python side splits it without needing to parse HTML again.
  function render(thread, pages) {
    const lines = [
      `### THREAD ${thread.id}`,
      `### THREAD_TITLE ${thread.title}`,
      `### THREAD_URL ${BASE}?t=${thread.id}`,
      `### GRABBED_AT ${new Date().toISOString()}`,
      `### PAGES ${pages.map((p) => p.page).join(',')} of ${thread.total}`,
      '',
    ]
    for (const page of pages) {
      lines.push(`### PAGE ${page.page}`, '')
      for (const post of page.posts) {
        lines.push(
          `--- POST ${post.postId}`,
          `NUMBER: ${post.number}`,
          `DATE: ${post.date}`,
          `URL: ${post.url}`,
          'BODY:',
          post.text,
          '--- END POST',
          '',
        )
      }
    }
    return lines.join('\n')
  }

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  for (const threadId of CONFIG.THREAD_IDS) {
    try {
      // Page 1 tells us how many pages there are. Keep it if the window
      // reaches back that far rather than fetching it twice.
      const firstDoc = await getDoc(pageUrl(threadId, 1))
      const total = totalPages(firstDoc)
      const title = threadTitle(firstDoc)
      const from = Math.max(1, total - CONFIG.LAST_N_PAGES + 1)
      console.log(`${threadId}: "${title}" — ${total} pages, taking ${from}–${total}`)

      const pages = []
      for (let page = from; page <= total; page++) {
        if (page > from) await sleep(CONFIG.DELAY_MS)
        const doc = page === 1 ? firstDoc : await getDoc(pageUrl(threadId, page))
        const posts = parsePosts(doc, threadId)
        if (!posts.length) console.warn(`  page ${page}: no posts parsed — the theme may have changed`)
        else console.log(`  page ${page}: ${posts.length} posts`)
        pages.push({ page, posts })
      }

      const count = pages.reduce((n, p) => n + p.posts.length, 0)
      if (!count) {
        console.error(`${threadId}: nothing parsed, no file written`)
        continue
      }
      download(`ft_${threadId}.txt`, render({ id: threadId, title, total }, pages))
      console.log(`${threadId}: downloaded ft_${threadId}.txt (${count} posts)`)
    } catch (err) {
      console.error(`${threadId}: ${err.message}`)
    }
    await sleep(CONFIG.DELAY_MS)
  }

  console.log('Done. Move the ft_*.txt files into loyalist-pipeline/raw/.')
})()
