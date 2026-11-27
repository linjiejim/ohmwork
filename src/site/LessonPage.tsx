import * as React from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { MDXProvider } from "@mdx-js/react"
import { ArrowLeft, ArrowRight, Check, Clock, Cloud, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, IconButton } from "@/components/ui/button"
import { Page } from "@/components/ui/page"
import { StateView } from "@/components/ui/state"
import { dismissLoginPrompt, isLoginPromptDismissed, openAuthDialog, useAuth } from "@/auth/store"
import { LESSONS, chapterPath, findLesson, lessonPath, type Level } from "@/curriculum/curriculum"
import { setLessonDone, useProgress } from "@/curriculum/progress"
import { TocContext, mdxComponents } from "@/mdx/components"
import { Skeleton } from "@/components/ui/skeleton"
import { useDelayedFlag } from "@/hooks/use-delayed-flag"
import { cn } from "@/lib/utils"
import { lessonFilm } from "@/films"
import { lessonComponent, preloadWhenIdle } from "./lesson-modules"

/** What the lesson body looks like while its chunk loads: paragraphs, then a widget card. Appears after 300ms. */
function LessonSkeleton() {
  const shown = useDelayedFlag(true)
  if (!shown) return <div className="min-h-64" aria-busy="true" />
  return (
    <div aria-busy="true" aria-label="正在加载这节课" className="flex flex-col gap-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="mt-6 h-6 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="mt-6 h-72 w-full rounded-lg" />
    </div>
  )
}

export const LEVEL_TONE: Record<Level, "success" | "info" | "warning"> = { 入门: "success", 基础: "info", 进阶: "warning" }

class LessonBoundary extends React.Component<{ children: React.ReactNode; resetKey: string; title?: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }
  render() {
    if (this.state.failed) {
      return <StateView kind="error" title={this.props.title ?? "这节课没能加载出来"} description="检查网络后重试。" onRetry={() => window.location.reload()} />
    }
    return this.props.children
  }
}

type TocItem = { id: string; text: string }

export function LessonPage() {
  const { chapterId, lessonSlug } = useParams()
  const navigate = useNavigate()
  const progress = useProgress()
  const auth = useAuth()
  const ref = findLesson(chapterId, lessonSlug)
  const [toc, setToc] = React.useState<TocItem[]>([])
  const [showLoginPrompt, setShowLoginPrompt] = React.useState(false)
  const tocApi = React.useMemo(
    () => ({
      register: (id: string, text: string) => {
        setToc((items) => (items.some((i) => i.id === id) ? items : [...items, { id, text }]))
        return () => setToc((items) => items.filter((i) => i.id !== id))
      },
    }),
    [],
  )

  const lessonKey = ref?.key
  React.useEffect(() => {
    setShowLoginPrompt(false)
  }, [lessonKey])

  // the lessons either side are the likely next clicks: fetch them while the reader reads
  const at = ref?.index
  React.useEffect(() => {
    if (at == null) return
    return preloadWhenIdle([LESSONS[at + 1]?.key, LESSONS[at - 1]?.key].filter((k): k is string => !!k))
  }, [at])

  if (!ref) {
    return (
      <Page width="narrow">
        <StateView kind="empty" title="没有这节课" description="它可能改了名字。" action={<Button onClick={() => navigate("/")}>回到首页</Button>} />
      </Page>
    )
  }

  const { lesson, chapter, key, index } = ref
  const Content = lessonComponent(key)
  const Film = lessonFilm(key)
  const prev = LESSONS[index - 1]
  const next = LESSONS[index + 1]
  const done = progress.isDone(key)

  return (
    // the article and its contents column centre as one group, so the column stays beside the text
    <div className="flex justify-center">
      <Page width="narrow" className="mx-0 min-w-0">
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

        {Film && (
          <div className="mb-10">
            <LessonBoundary resetKey={key} title="动画讲解没能加载出来">
              <React.Suspense fallback={<div aria-busy="true" aria-label="正在加载动画讲解" className="aspect-video rounded-lg border bg-sunken" />}>
                <Film key={key} />
              </React.Suspense>
            </LessonBoundary>
          </div>
        )}

        {Content ? (
          <LessonBoundary resetKey={key}>
            <React.Suspense fallback={<LessonSkeleton />}>
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
            <Button
              variant="primary"
              onClick={() => {
                setLessonDone(key, true)
                if (auth.status === "guest" && !isLoginPromptDismissed()) {
                  setShowLoginPrompt(true)
                }
              }}
            >
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

        {showLoginPrompt && auth.status === "guest" && (
          <div
            role="region"
            aria-label="登录同步提示"
            className="mt-4 flex max-w-[680px] flex-wrap items-center gap-3 rounded-lg border bg-sunken px-4 py-3 text-small"
          >
            <Cloud className="size-4 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 text-muted-foreground">
              进度已保存在本地。登录账号后，换设备或清缓存也不会丢。
            </p>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => openAuthDialog("login")}>
                登录保存进度
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  dismissLoginPrompt()
                  setShowLoginPrompt(false)
                }}
              >
                不再提示
              </Button>
              <IconButton label="关闭提示" size="icon-sm" tooltip={false} onClick={() => setShowLoginPrompt(false)}>
                <X />
              </IconButton>
            </div>
          </div>
        )}
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
