import fs from "node:fs"
import path from "node:path"
import type { Plugin } from "vite"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import mdx from "@mdx-js/rollup"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { SITE_PAGES, pageHtml, sitemapXml } from "./src/site/seo"

/**
 * One HTML file per page, so a deep link answers 200 with its own title and share card
 * instead of falling through to 404.html. /learn/basics/ohms-law → learn/basics/ohms-law.html
 * (GitHub Pages serves it without the extension). A page with pages under it (/learn/basics,
 * /tools) also gets <path>/index.html, in case the host takes the directory first.
 */
function sitePages(): Plugin {
  return {
    name: "ohmwork:site-pages",
    apply: "build",
    writeBundle({ dir }) {
      if (!dir) return
      const shell = fs.readFileSync(path.join(dir, "index.html"), "utf8")
      const write = (file: string, html: string) => {
        fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
        fs.writeFileSync(path.join(dir, file), html)
      }
      for (const page of SITE_PAGES) {
        const html = pageHtml(shell, page)
        if (page.path === "/") {
          write("index.html", html)
          continue
        }
        write(`${page.path.slice(1)}.html`, html)
        if (SITE_PAGES.some((p) => p.path.startsWith(`${page.path}/`))) write(`${page.path.slice(1)}/index.html`, html)
      }
      write("404.html", pageHtml(shell, undefined))
      write("sitemap.xml", sitemapXml())
    },
  }
}

export default defineConfig({
  plugins: [
    // Lessons are MDX: prose + formulas ($…$ via KaTeX) + live React widgets.
    {
      enforce: "pre",
      ...mdx({
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [rehypeKatex],
        providerImportSource: "@mdx-js/react",
      }),
    },
    react(),
    tailwindcss(),
    sitePages(),
  ],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: { port: 5273 },
  test: {
    environment: "jsdom",
    setupFiles: ["src/tests/setup.ts"],
    css: false,
  },
})
