/**
 * Every lesson, chapter and tool has a page of its own for search and share cards; the
 * build's HTML rewrite keeps working on the real index.html; unknown URLs stay out of search.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { CHAPTERS, LESSONS, chapterPath, lessonPath } from "@/curriculum/curriculum"
import { NOT_FOUND_TITLE, SITE, SITE_PAGES, pageHtml, pageMeta, sitemapXml } from "@/site/seo"
import { TOOLS, toolPath } from "@/site/tools"

const indexHtml = fs.readFileSync(path.resolve(import.meta.dirname, "../../index.html"), "utf8")

describe("site pages", () => {
  it("lists every lesson, chapter and tool, plus the reference pages", () => {
    const paths = new Set(SITE_PAGES.map((p) => p.path))
    for (const l of LESSONS) expect(paths, l.key).toContain(lessonPath(l.key))
    for (const c of CHAPTERS) expect(paths, c.id).toContain(chapterPath(c.id))
    for (const t of TOOLS) expect(paths, t.id).toContain(toolPath(t.id))
    for (const p of ["/", "/tools", "/symbols", "/glossary"]) expect(paths).toContain(p)
    expect(paths.size).toBe(SITE_PAGES.length)
  })

  it("gives every page its own title and a description", () => {
    expect(new Set(SITE_PAGES.map((p) => p.title)).size).toBe(SITE_PAGES.length)
    for (const p of SITE_PAGES) {
      expect(p.title, p.path).toMatch(/Ohmwork/)
      expect(p.description.length, p.path).toBeGreaterThan(10)
    }
  })

  it("names a lesson after itself", () => {
    expect(pageMeta("/learn/basics/ohms-law")?.title).toBe("欧姆定律 · Ohmwork")
    expect(pageMeta("/learn/basics/ohms-law/")?.title).toBe("欧姆定律 · Ohmwork")
    expect(pageMeta("/learn/basics/nope")).toBeUndefined()
  })
})

describe("page HTML", () => {
  it("retitles the real index.html with canonical URL and share card", () => {
    const html = pageHtml(indexHtml, pageMeta("/learn/basics/ohms-law"))
    expect(html).toContain("<title>欧姆定律 · Ohmwork</title>")
    expect(html.match(/<title>/g)).toHaveLength(1)
    expect(html.match(/<meta name="description"/g)).toHaveLength(1)
    expect(html).toContain(`<link rel="canonical" href="${SITE.origin}/learn/basics/ohms-law" />`)
    expect(html).toContain(`<meta property="og:image" content="${SITE.origin}/og.png" />`)
    expect(html).toContain('<meta property="og:type" content="article" />')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(html).not.toContain("noindex")
  })

  it("keeps the 404 fallback out of search and points it nowhere", () => {
    const html = pageHtml(indexHtml, undefined)
    expect(html).toContain(`<title>${NOT_FOUND_TITLE}</title>`)
    expect(html).toContain('<meta name="robots" content="noindex" />')
    expect(html).not.toContain("canonical")
    expect(html).not.toContain("og:url")
  })

  it("escapes text that would break an attribute", () => {
    const html = pageHtml(indexHtml, { path: "/x", title: 'A "B" <C> & D', description: 'say "hi" & <go>' })
    expect(html).toContain("<title>A &quot;B&quot; &lt;C&gt; &amp; D</title>")
    expect(html).toContain('content="say &quot;hi&quot; &amp; &lt;go&gt;"')
  })

  it("fails the build loudly if index.html stops matching", () => {
    const lesson = pageMeta("/learn/basics/ohms-law")
    expect(() => pageHtml("<html><head></head></html>", lesson)).toThrow(/index\.html/)
    // a formatter turning " />" into ">" would otherwise ship the home description on every page
    expect(() => pageHtml(indexHtml.replace(/(<meta name="description" content="[^"]*") \/>/, "$1>"), lesson)).toThrow(/description/)
  })

  it("puts text in as written, with no replacement patterns", () => {
    const html = pageHtml(indexHtml, { path: "/x", title: "a $& b $' c", description: "d $$ e $` f" })
    expect(html).toContain("<title>a $&amp; b $' c</title>")
    expect(html).toContain('content="d $$ e $` f"')
  })

  it("keeps index.html's own title and description the same as the built home page's", () => {
    // vite dev serves index.html as written; the build rewrites it from SITE
    expect(indexHtml).toContain(`<title>${SITE.title}</title>`)
    expect(indexHtml).toContain(`<meta name="description" content="${SITE.description}" />`)
  })

  it("lists every page in the sitemap", () => {
    const xml = sitemapXml()
    expect(xml.match(/<url>/g)).toHaveLength(SITE_PAGES.length)
    expect(xml).toContain(`<loc>${SITE.origin}/learn/basics/ohms-law</loc>`)
  })
})
