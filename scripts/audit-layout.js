/**
 * Layout audit for every lesson, run in the browser against the dev server:
 *
 *   const { audit } = await import("/scripts/audit-layout.js")
 *   await audit()                 // all lessons
 *   await audit("rf/")            // one chapter
 *
 * For each widget it checks, in its first state and after picking every
 * segmented option and flipping every switch: SVG text overlapping other text,
 * text drawn outside its SVG, content overflowing the card, NaN in the text,
 * and the page scrolling sideways. Resize the window to test phone widths.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function check(lab, title, issues) {
  const lr = lab.getBoundingClientRect()
  if (/NaN|undefined/.test(lab.innerText)) issues.add(`[${title}] NaN/undefined in text`)
  for (const svg of lab.querySelectorAll("svg")) {
    const sr = svg.getBoundingClientRect()
    if (sr.width < 30) continue
    const texts = [...svg.querySelectorAll("text")]
      .filter((t) => t.textContent.trim() && getComputedStyle(t).opacity !== "0")
      .map((t) => ({ t: t.textContent.trim().slice(0, 18), r: t.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0)
    for (const x of texts) {
      if (x.r.left < sr.left - 3 || x.r.right > sr.right + 3 || x.r.top < sr.top - 3 || x.r.bottom > sr.bottom + 3) issues.add(`[${title}] text outside svg: "${x.t}"`)
    }
    for (let i = 0; i < texts.length; i++)
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i].r
        const b = texts[j].r
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (w > 2 && h > 3 && w * h > Math.min(a.width * a.height, b.width * b.height) * 0.15) issues.add(`[${title}] overlap: "${texts[i].t}" × "${texts[j].t}"`)
      }
  }
  for (const el of lab.querySelectorAll("*")) {
    const r = el.getBoundingClientRect()
    if (r.width && r.right > lr.right + 2 && !el.closest(".overflow-x-auto")) {
      issues.add(`[${title}] overflows card: <${el.tagName.toLowerCase()}>`)
      break
    }
  }
}

export async function audit(prefix = "") {
  const { LESSONS } = await import("/src/curriculum/curriculum.ts")
  const out = []
  for (const l of LESSONS) {
    if (!l.key.startsWith(prefix)) continue
    history.pushState({}, "", "/learn/" + l.key)
    dispatchEvent(new PopStateEvent("popstate"))
    for (let i = 0; i < 40 && !document.querySelector("article.lesson [data-lab]"); i++) await sleep(100)
    await sleep(300)
    const issues = new Set()
    const labs = [...document.querySelectorAll("article.lesson [data-lab]")]
    if (!labs.length) issues.add("no widget rendered")
    for (const lab of labs) {
      const title = lab.querySelector("figcaption")?.textContent
      check(lab, title, issues)
      for (const opt of lab.querySelectorAll("[role=radio], [role=switch]")) {
        opt.click()
        await sleep(60)
        check(lab, `${title} · ${opt.textContent.trim() || opt.getAttribute("aria-label") || "switch"}`, issues)
      }
    }
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) issues.add("page scrolls sideways")
    out.push({ key: l.key, widgets: labs.length, issues: [...issues] })
  }
  return out
}
