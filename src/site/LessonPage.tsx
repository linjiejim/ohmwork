import * as React from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { MDXProvider } from "@mdx-js/react"
import { ArrowLeft, ArrowRight, Check, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Page } from "@/components/ui/page"
import { StateView } from "@/components/ui/state"
import { LESSONS, chapterPath, findLesson, lessonPath, type Level } from "@/curriculum/curriculum"
import { setLessonDone, useProgress } from "@/curriculum/progress"
import { TocContext, mdxComponents } from "@/mdx/components"
import { cn } from "@/lib/utils"

// Every lesson is its own chunk, fetched when opened.
const modules = import.meta.glob<{ default: React.ComponentType }>("/src/content/*/*.mdx")
const lazyLessons = new Map<string, React.LazyExoticComponent<React.ComponentType>>()

function lessonComponent(key: string) {
  const load = modules[`/src/content/${key}.mdx`]
  if (!load) return null
  if (!lazyLessons.has(key)) lazyLessons.set(key, React.lazy(load))
  return lazyLessons.get(key)!
}

export const LEVEL_TONE: Record<Level, "success" | "info" | "warning"> = { 入门: "success", 基础: "info", 进阶: "warning" }

class LessonBoundary extends React.Component<{ children: React.ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }
  render() {
    if (this.state.failed) {
      return <StateView kind="error" title="这节课没能加载出来" description="检查网络后重试。" onRetry={() => window.location.reload()} />
    }
    return this.props.children
  }
}

type TocItem = { id: string; text: string }

export function LessonPage() {
  const { chapterId, lessonSlug } = useParams()
  const navigate = useNavigate()
  const progress = useProgress()
  const ref = findLesson(chapterId, lessonSlug)
  const [toc, setToc] = React.useState<TocItem[]>([])
  const tocApi = React.useMemo(
    () => ({
      register: (id: string, text: string) => {
        setToc((items) => (items.some((i) => i.id === id) ? items : [...items, { id, text }]))
        return () => setToc((items) => items.filter((i) => i.id !== id))
      },
    }),
    [],
  )

  if (!ref) {
    return (
      <Page width="narrow">
        <StateView kind="empty" title="没有这节课" description="它可能改了名字。" action={<Button onClick={() => navigate("/")}>回到首页</Button>} />
      </Page>
    )
  }

  const { lesson, chapter, key, index } = ref
  const Content = lessonComponent(key)
  const prev = LESSONS[index - 1]
  const next = LESSONS[index + 1]
  const done = progress.isDone(key)

  return (
    <div className="flex">
      <Page width="narrow" className="min-w-0">
        <nav aria-label="位置" className="mb-3 text-small text-muted-foreground">
          <Link to={chapterPath(chapter.id)} className="hover:text-foreground">
            {chapter.title}
          </Link>
          <span className="mx-1.5 text-faint-foreground">/</span>
          <span className="tabular">
            第 {chapter.lessons.indexOf(lesson) + 1} 课，共 {chapter.lessons.length} 课
          </span>
        </nav>
        <h1 className="text-display font-semibold">{lesson.title}</h1>
        <div className="mb-8 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-small text-muted-foreground">
          <Badge tone={LEVEL_TONE[lesson.level]}>{lesson.level}</Badge>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />约 {lesson.minutes} 分钟
          </span>
          {done && (
            <span className="inline-flex items-center gap-1 text-success">
              <Check className="size-3.5" />
              已学完
            </span>
          )}
        </div>

        {Content ? (
          <LessonBoundary resetKey={key}>
            <React.Suspense fallback={<div className="h-64" aria-busy="true" />}>
              <TocContext.Provider value={tocApi}>
                <MDXProvider components={mdxComponents}>
                  <article key={key} className="lesson">
                    <Content />
                  </article>
                </MDXProvider>
              </TocContext.Provider>
            </React.Suspense>
          </LessonBoundary>
        ) : (
          <StateView kind="empty" title="这节课还在编写中" description={lesson.summary} />
        )}

        <footer className="mt-12 flex max-w-[680px] flex-wrap items-center gap-2 border-t pt-6">
          {done ? (
            <Button variant="ghost" onClick={() => setLessonDone(key, false)}>
              标记为未学
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setLessonDone(key, true)}>
              <Check />
              完成本课
            </Button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {prev && (
              <Button asChild variant="ghost">
                <Link to={lessonPath(prev.key)}>
                  <ArrowLeft />
                  上一课
                </Link>
              </Button>
            )}
            {next && (
              <Button asChild variant={done ? "primary" : "secondary"}>
                <Link to={lessonPath(next.key)}>
                  下一课：{next.lesson.title}
                  <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        </footer>
      </Page>

      {toc.length > 1 && (
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 overflow-y-auto px-4 pt-24 xl:block">
          <div className="mb-2 text-caption font-medium text-faint-foreground">本页内容</div>
          <ul className="flex flex-col gap-0.5 border-l">
            {toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }}
                  className={cn("-ml-px block border-l border-transparent py-1 pl-3 text-small text-muted-foreground", "transition-colors duration-(--duration-fast) hover:border-input hover:text-foreground")}
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  )
}
