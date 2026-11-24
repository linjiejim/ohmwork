import * as React from "react"
import { Link } from "react-router-dom"
import { Lightbulb } from "lucide-react"
import type { MDXComponents } from "mdx/types"
import { Callout } from "@/components/ui/callout"
import { Quiz } from "@/lab/Quiz"

/*
 * What lesson MDX can use without importing: <Note>, <Tip>, <Warn>, <Figure>,
 * <Quiz>. Plain markdown elements are styled by `.lesson` in index.css.
 */

function Aside({ tone, icon, title, children }: { tone: "info" | "neutral" | "warning"; icon?: React.ReactNode; title?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Callout tone={tone} icon={icon} className="lesson-aside my-5 px-4 py-3 text-body">
      {title && <p className="font-medium">{title}</p>}
      {children}
    </Callout>
  )
}

/** An aside worth knowing: an analogy, background, "why it is so". */
export function Note(props: { title?: React.ReactNode; children: React.ReactNode }) {
  return <Aside tone="info" {...props} />
}

/** Practical advice from the bench: rules of thumb, typical values. */
export function Tip(props: { title?: React.ReactNode; children: React.ReactNode }) {
  return <Aside tone="neutral" icon={<Lightbulb />} {...props} />
}

/** A common mistake or a safety matter. */
export function Warn(props: { title?: React.ReactNode; children: React.ReactNode }) {
  return <Aside tone="warning" {...props} />
}

/** A static picture (usually a <Schematic>) with a caption. */
export function Figure({ caption, children }: { caption?: React.ReactNode; children: React.ReactNode }) {
  return (
    <figure className="not-prose my-6">
      <div className="overflow-x-auto rounded-lg border bg-sunken px-4 py-4">{children}</div>
      {caption && <figcaption className="mt-2 text-center text-caption text-muted-foreground">{caption}</figcaption>}
    </figure>
  )
}

/** Sections register here so the lesson page can list them ("本页内容"). */
export const TocContext = React.createContext<{ register: (id: string, text: string) => () => void } | null>(null)

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children)
  return ""
}

function H2({ children, ...props }: React.ComponentProps<"h2">) {
  const text = textOf(children)
  const id = text.replace(/\s+/g, "-")
  const toc = React.useContext(TocContext)
  React.useEffect(() => toc?.register(id, text), [toc, id, text])
  return (
    <h2 id={id} {...props}>
      {children}
    </h2>
  )
}

function Anchor({ href = "", children, ...props }: React.ComponentProps<"a">) {
  if (href.startsWith("/")) return <Link to={href}>{children}</Link>
  const external = /^https?:/.test(href)
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} {...props}>
      {children}
    </a>
  )
}

export const mdxComponents: MDXComponents = {
  h2: H2,
  a: Anchor,
  table: (props) => (
    <div className="table-wrap">
      <table {...props} />
    </div>
  ),
  Note,
  Tip,
  Warn,
  Figure,
  Quiz,
}
