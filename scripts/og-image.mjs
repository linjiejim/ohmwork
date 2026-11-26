/**
 * Make the share card and the home-screen icon:
 *   public/og.png               1200 × 630, the home page's first screen with the brand on top
 *   public/apple-touch-icon.png 180 × 180, the brand mark full-bleed (iOS rounds the corners)
 *
 * Needs the dev server (npm run dev, port 5273; or set OG_DEV_URL). Uses the installed
 * Google Chrome, headless. Re-run after changing the home page or the brand mark.
 *
 *   node scripts/og-image.mjs
 */
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"

const base = process.env.OG_DEV_URL ?? "http://localhost:5273"
const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public")
// the brand mark's waveform (src/site/Shell.tsx BrandMark, public/favicon.svg)
const WAVE = "M3.5 12H7L8.5 7.5L11.5 16.5L14.5 7.5L16 12H20.5"

const browser = await chromium.launch({ channel: "chrome" })
try {
  // a first visit, light, no motion: the page a stranger opening the link would see
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, colorScheme: "light", reducedMotion: "reduce" })
  await page.goto(`${base}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector("h1")
  await page.evaluate(() => document.fonts.ready)
  // the card is the page, not the app: no sidebar, the name where the sidebar's brand was
  await page.addStyleTag({ content: "aside { display: none !important }" })
  await page.evaluate((wave) => {
    const h1 = document.querySelector("h1")
    const brand = document.createElement("div")
    brand.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:28px;font-size:22px;font-weight:600"
    brand.innerHTML = `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><rect width="24" height="24" rx="6" fill="currentColor"/><path d="${wave}" fill="none" stroke="var(--background)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>Ohmwork`
    h1.before(brand)
    // just the hero, centred top to bottom: nothing half-cut at the edge
    const hero = h1.closest(".grid")
    for (let el = hero.nextElementSibling; el; el = el.nextElementSibling) el.style.display = "none"
    const boxes = [...hero.children].map((c) => c.getBoundingClientRect())
    const top = Math.min(...boxes.map((b) => b.top))
    const bottom = Math.max(...boxes.map((b) => b.bottom))
    hero.style.marginTop = `${(window.innerHeight - (bottom - top)) / 2 - top}px`
  }, WAVE)
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(pub, "og.png") })

  const icon = await browser.newPage({ viewport: { width: 180, height: 180 } })
  await icon.setContent(
    `<body style="margin:0;background:#1a1a1a"><svg viewBox="-1.5 -1.5 27 27" width="180" height="180"><path d="${WAVE}" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></body>`,
  )
  await icon.screenshot({ path: join(pub, "apple-touch-icon.png") })
  console.log(join(pub, "og.png"))
  console.log(join(pub, "apple-touch-icon.png"))
} finally {
  await browser.close()
}
