import { ImageResponse } from 'next/og'

// The default social preview card for every page that sets no picture of its own (seo.ts points
// at it as DEFAULT_IMAGE, so it stays at /opengraph-image), in the kit's colours and headline face:
// navy, the wordmark, the tagline. Built at build time and again once a day; if the font cannot be
// fetched it falls back to the default face.
export const alt = 'Loyalist Travel'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 86400

// A Google font as TrueType, which the image renderer reads (it cannot read woff2).
async function googleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const signal = AbortSignal.timeout(8000)
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&display=swap`, { headers: { 'user-agent': 'Mozilla/5.0' }, signal })).text()
    const url = css.match(/src: url\(([^)]+)\) format\('(?:truetype|opentype)'\)/)?.[1] ?? css.match(/url\(([^)]+\.ttf)\)/)?.[1]
    if (!url) return null
    return await (await fetch(url, { signal })).arrayBuffer()
  } catch {
    return null
  }
}

export default async function Image() {
  const [serif, sans] = await Promise.all([googleFont('Newsreader', 600), googleFont('Source Sans 3', 400)])
  const fonts = [
    ...(serif ? [{ name: 'Newsreader', data: serif, weight: 600 as const, style: 'normal' as const }] : []),
    ...(sans ? [{ name: 'Source Sans 3', data: sans, weight: 400 as const, style: 'normal' as const }] : []),
  ]
  const small = sans ? 'Source Sans 3' : 'sans-serif'
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '72px 80px', background: '#12203a', color: '#ffffff', fontFamily: serif ? 'Newsreader' : 'serif' }}>
        <div style={{ display: 'flex', fontSize: 26, color: '#c8a45c', fontFamily: small }}>loyalisttravel.com</div>
        <div style={{ display: 'flex', fontSize: 76, lineHeight: 1.08, maxWidth: 980 }}>Hotel reviews, elite upgrade odds and club lounges.</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.14)', paddingTop: 28 }}>
          <div style={{ display: 'flex', fontSize: 40 }}>Loyalist Travel</div>
          <div style={{ display: 'flex', fontSize: 22, color: '#9ba7bb', fontFamily: small }}>World of Hyatt · Marriott Bonvoy · Hilton Honors · IHG</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
