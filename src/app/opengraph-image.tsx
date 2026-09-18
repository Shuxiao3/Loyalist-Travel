import { ImageResponse } from 'next/og'

// The default social preview card: navy, the wordmark, the tagline.
export const runtime = 'edge'
export const alt = 'Loyalist Travel'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

async function playfair(): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500&display=swap', { headers: { 'user-agent': 'Mozilla/5.0' } })).text()
    const url = css.match(/src: url\(([^)]+)\) format\('(?:truetype|opentype)'\)/)?.[1] ?? css.match(/url\(([^)]+\.ttf)\)/)?.[1]
    if (!url) return null
    return await (await fetch(url)).arrayBuffer()
  } catch {
    return null
  }
}

export default async function Image() {
  const font = await playfair()
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '72px 80px', background: '#0d1b2a', color: '#faf8f4', fontFamily: font ? 'Playfair' : 'serif' }}>
        <div style={{ display: 'flex', fontSize: 22, letterSpacing: 4, textTransform: 'uppercase', color: '#d0a060', fontFamily: 'sans-serif' }}>Loyalty travel, reported</div>
        <div style={{ display: 'flex', fontSize: 78, lineHeight: 1.08, maxWidth: 980, letterSpacing: -1 }}>Find what elite status gets you at hotels and lounges.</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.14)', paddingTop: 28 }}>
          <div style={{ display: 'flex', fontSize: 40 }}>Loyalist Travel</div>
          <div style={{ display: 'flex', fontSize: 20, color: '#858482', fontFamily: 'sans-serif' }}>Reviews · Upgrade odds · Lounges rated</div>
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: 'Playfair', data: font, weight: 500, style: 'normal' }] : [] },
  )
}
