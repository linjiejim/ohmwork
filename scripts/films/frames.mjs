/**
 * Screenshot a lesson film's frames as one contact sheet, and check them.
 * Needs the dev server (npm run dev, port 5273; or set FILM_DEV_URL).
 *
 *   node scripts/films/frames.mjs basics/ohms-law                 a frame every 2 s
 *   node scripts/films/frames.mjs basics/ohms-law --step 1
 *   node scripts/films/frames.mjs basics/ohms-law --t 12,13.5 --w 960 --cols 2   a closer look
 *   node scripts/films/frames.mjs basics/ohms-law --dark
 *
 * Writes .cache/films/frames/<chapter>-<lesson>[-dark].png and prints any text that leaves
 * the stage or sits on other text. Uses the installed Google Chrome, headless.
 */
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"

const args = process.argv.slice(2)
const key = args.find((a) => !a.startsWith("--") && !/^[\d.,]+$/.test(a))
if (!key || !key.includes("/")) {
  console.error("usage: node scripts/films/frames.mjs <chapter>/<lesson> [--step 2] [--t 1,2] [--w 480] [--cols 4] [--dark]")
  process.exit(1)
}
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const dark = args.includes("--dark")
const w = Number(opt("w", 480))
const cols = Number(opt("cols", 4))
const query = new URLSearchParams({ w: String(w), cols: String(cols) })
if (opt("t")) query.set("t", opt("t"))
else query.set("step", opt("step", "2"))

const base = process.env.FILM_DEV_URL ?? "http://localhost:5273"
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const outDir = join(root, ".cache", "films", "frames")
mkdirSync(outDir, { recursive: true })
const out = join(outDir, `${key.replace("/", "-")}${opt("t") ? "-closeup" : ""}${dark ? "-dark" : ""}.png`)

const browser = await chromium.launch({ channel: "chrome" })
try {
  const page = await browser.newPage({ viewport: { width: cols * (w + 12) + 24, height: 600 }, colorScheme: dark ? "dark" : "light", deviceScaleFactor: 1 })
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
  await page.goto(`${base}/dev/film/${key}?${query}`)
  await page.waitForSelector("body[data-ready]", { timeout: 20000 })
  await page.screenshot({ path: out, fullPage: true })
  const issues = await page.evaluate(() => window.__filmAudit())
  console.log(out)
  for (const e of errors) console.log(`error: ${e}`)
  const byIssue = new Map()
  for (const { t, issue } of issues) byIssue.set(issue, [...(byIssue.get(issue) ?? []), t])
  if (!byIssue.size && !errors.length) console.log("no issues")
  for (const [issue, ts] of byIssue) console.log(`${issue}  at ${ts.join(", ")} s`)
} finally {
  await browser.close()
}
