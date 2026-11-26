/*
 * What each URL is called, for the browser tab, search results and share cards.
 * The app sets document.title from it on every navigation; the build
 * (vite.config.ts) writes one HTML file per page with the same title,
 * description and Open Graph tags, plus sitemap.xml.
 *
 * vite.config.ts loads this file in plain Node, so it and what it imports
 * use relative paths, not the "@/" alias.
 */
import { CHAPTERS, LESSONS, chapterPath, lessonPath } from "../curriculum/curriculum.ts"
import { TOOLS, toolPath } from "./tools.ts"

export const SITE = {
  name: "Ohmwork",
  origin: "https://ohmwork.linjiejim.com",
  title: "Ohmwork · 交互式电子电路学堂",
  description: "Ohmwork：用可以动手拨弄的仿真和动画学电子电路。从电压电流到传感器、射频与 PCB 设计，循序渐进。",
  /** 1200 × 630, made by scripts/og-image.mjs */
  image: "/og.png",
}

export interface PageMeta {
  /** "/learn/basics/ohms-law": no trailing slash. */
  path: string
  title: string
  description: string
}

const lessonTitle = (key: string) => LESSONS.find((l) => l.key === key)?.lesson.title

/** Every page worth a URL of its own, in the order the course reads. */
export const SITE_PAGES: PageMeta[] = [
  { path: "/", title: SITE.title, description: SITE.description },
  ...CHAPTERS.flatMap((chapter) => [
    {
      path: chapterPath(chapter.id),
      title: `${chapter.title} · ${SITE.name}`,
      description: `${chapter.summary}共 ${chapter.lessons.length} 节课，每节配一个能动手调的交互仿真。`,
    },
    ...LESSONS.filter((l) => l.chapter === chapter).map(({ key, lesson }) => ({
      path: lessonPath(key),
      title: `${lesson.title} · ${SITE.name}`,
      description: `${lesson.summary}「${chapter.title}」一章，${lesson.level}，约 ${lesson.minutes} 分钟，边拖边看的交互仿真。`,
    })),
  ]),
  {
    path: "/tools",
    title: `工具箱 · ${SITE.name}`,
    description: `电子电路常用计算器：${TOOLS.map((t) => t.title).join("、")}。`,
  },
  ...TOOLS.map((t) => {
    const lesson = t.lesson && lessonTitle(t.lesson)
    return {
      path: toolPath(t.id),
      title: `${t.title} · 工具箱 · ${SITE.name}`,
      description: `${t.title}：Ohmwork 工具箱里的在线计算器，改参数马上出结果。${lesson ? `原理见「${lesson}」一课。` : ""}`,
    }
  }),
  { path: "/symbols", title: `符号速查 · ${SITE.name}`, description: "原理图上的常见符号：长什么样、位号用什么字母、怎么读。" },
  { path: "/glossary", title: `术语表 · ${SITE.name}`, description: "电子电路课程里出现的名词和缩写，每个一两句话，附讲它的那一课。" },
]

export const NOT_FOUND_TITLE = `没有这个页面 · ${SITE.name}`

const byPath = new Map(SITE_PAGES.map((p) => [p.path, p]))

export function pageMeta(pathname: string): PageMeta | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  return byPath.get(path)
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/**
 * The built index.html, retitled for one page: title and description replaced,
 * canonical URL and share-card tags added. No page → the 404 fallback: kept out of search.
 */
export function pageHtml(html: string, page: PageMeta | undefined): string {
  const title = page?.title ?? NOT_FOUND_TITLE
  const description = page?.description ?? SITE.description
  const url = page && SITE.origin + page.path
  const tags = page
    ? [
        `<link rel="canonical" href="${esc(url!)}" />`,
        `<meta property="og:type" content="${page.path.startsWith("/learn/") ? "article" : "website"}" />`,
        `<meta property="og:site_name" content="${SITE.name}" />`,
        `<meta property="og:locale" content="zh_CN" />`,
        `<meta property="og:url" content="${esc(url!)}" />`,
        `<meta property="og:title" content="${esc(title)}" />`,
        `<meta property="og:description" content="${esc(description)}" />`,
        `<meta property="og:image" content="${SITE.origin}${SITE.image}" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
      ]
    : [`<meta name="robots" content="noindex" />`]
  const swaps: [RegExp, string][] = [
    [/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`],
    [/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />`],
    [/\s*<\/head>/, `\n    ${tags.join("\n    ")}\n  </head>`],
  ]
  // each tag must be there exactly once, or every page would quietly ship the home page's
  return swaps.reduce((out, [re, tag]) => {
    if (out.match(new RegExp(re, "g"))?.length !== 1) {
      throw new Error(`pageHtml: index.html needs exactly one ${re}; update the patterns in src/site/seo.ts`)
    }
    return out.replace(re, () => tag)
  }, html)
}

export function sitemapXml(pages: PageMeta[] = SITE_PAGES): string {
  const urls = pages.map((p) => `  <url><loc>${esc(SITE.origin + p.path)}</loc></url>`).join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}
