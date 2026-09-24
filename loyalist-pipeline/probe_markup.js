// Diagnostic: reports how this FlyerTalk page is built, so the grabber's
// selectors can be pointed at the real markup. Reads only, downloads nothing.
(() => {
  const out = []
  const say = (s) => out.push(s)

  const probes = [
    '#posts', '#posts > li', 'li.postbitlegacy', 'li.postcontainer', 'blockquote.postcontent',
    '[id^="post_"]', '[id^="post-"]', '[id^="post_message_"]',
    '.b-post', '.js-post', '.b-post__content', '.js-post__content-text', '[data-node-id]',
    'article', '.post', '.message', '.messageContent',
    '.pagenav', '#pagination_top', '.pagination', '.b-pagination', '.js-pagenav',
    'a.popupctrl', 'a[href*="page="]', 'a[href*="/page"]',
  ]
  say('--- selector counts (nonzero only) ---')
  probes.forEach((s) => {
    let n = 0
    try { n = document.querySelectorAll(s).length } catch (e) { return }
    if (n) say(`${String(n).padStart(4)}  ${s}`)
  })

  // Anything whose id or class mentions "post" — the container is in here.
  const postish = new Map()
  document.querySelectorAll('[id*="post" i], [class*="post" i]').forEach((el) => {
    const key = `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`
    postish.set(key, (postish.get(key) || 0) + 1)
  })
  say('\n--- elements mentioning "post", by tag+class, top 15 ---')
  ;[...postish.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([k, n]) => say(`${String(n).padStart(4)}  ${k}`))

  // The biggest repeated block of real text on the page is almost certainly a
  // post. Report its ancestry so the right container can be named.
  const candidates = [...document.querySelectorAll('div, li, article, section')]
    .map((el) => ({ el, len: (el.textContent || '').trim().length, kids: el.children.length }))
    .filter((c) => c.len > 200 && c.len < 4000)
    .sort((a, b) => a.len - b.len)
  if (candidates.length) {
    const el = candidates[Math.floor(candidates.length / 2)].el
    say('\n--- a mid-sized text block, and its ancestry ---')
    let node = el, chain = []
    for (let i = 0; node && i < 6; i++, node = node.parentElement) {
      chain.unshift(`${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}${node.classList.length ? '.' + [...node.classList].join('.') : ''}`)
    }
    say(chain.join('\n  > '))
    say('\n--- that block, first 700 chars of HTML ---')
    say(el.outerHTML.slice(0, 700))
  }

  // How the page says how many pages there are.
  const pageText = (document.body.innerText.match(/page\s+\d+\s+of\s+[\d,]+/i) || [])[0]
  say(`\n--- "page N of M" text: ${pageText || 'not found'}`)
  const nav = document.querySelector('.pagenav, #pagination_top, .pagination, .b-pagination, .js-pagenav, nav')
  say('--- pagination container, first 700 chars ---')
  say(nav ? nav.outerHTML.slice(0, 700) : 'none of the usual pagination containers matched')

  say(`\n--- url: ${location.href}`)
  console.log(out.join('\n'))
})()
