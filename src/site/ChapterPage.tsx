import { Link, useNavigate, useParams } from "react-router-dom"
import { Check, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Page, PageHeader } from "@/components/ui/page"
import { StateView } from "@/components/ui/state"
import { findChapter, lessonPath } from "@/curriculum/curriculum"
import { preloadLesson } from "./lesson-modules"
import { useProgress } from "@/curriculum/progress"
import { LEVEL_TONE } from "@/site/LessonPage"

/** One chapter: its lessons in order, each with what it teaches. The page to skim when reviewing. */
export function ChapterPage() {
  const { chapterId } = useParams()
  const navigate = useNavigate()
  const progress = useProgress()
  const found = findChapter(chapterId)
  if (!found) {
    return (
      <Page width="narrow">
        <StateView kind="empty" title="没有这一章" action={<Button onClick={() => navigate("/")}>回到首页</Button>} />
      </Page>
    )
  }
  const { chapter, stage } = found
  const done = progress.chapterCount(chapter)
  return (
    <Page width="narrow">
      <div className="mb-1 text-small text-muted-foreground">{stage.title}</div>
      <PageHeader
        title={chapter.title}
        info={chapter.summary}
        actions={
          <span className="tabular text-small text-muted-foreground">
            已学 {done} / {chapter.lessons.length} 课
          </span>
        }
      />
      <ol className="overflow-hidden rounded-lg border">
        {chapter.lessons.map((lesson, i) => {
          const key = `${chapter.id}/${lesson.slug}`
          const isDone = progress.isDone(key)
          return (
            <li key={key} className="border-b last:border-b-0">
              <Link to={lessonPath(key)} onPointerEnter={() => preloadLesson(key)} onFocus={() => preloadLesson(key)} className="flex items-center gap-3 px-4 py-3 transition-colors duration-(--duration-fast) hover:bg-accent">
                <span
                  className={
                    isDone
                      ? "grid size-6 shrink-0 place-items-center rounded-full bg-success-subtle text-success [&_svg]:size-3.5"
                      : "tabular grid size-6 shrink-0 place-items-center rounded-full bg-muted text-caption font-medium text-muted-foreground"
                  }
                >
                  {isDone ? <Check aria-label="已学完" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-body font-medium">{lesson.title}</span>
                    <Badge tone={LEVEL_TONE[lesson.level]}>{lesson.level}</Badge>
                  </span>
                  <span className="mt-0.5 block text-small text-muted-foreground">{lesson.summary}</span>
                </span>
                <span className="tabular shrink-0 text-caption text-faint-foreground max-sm:hidden">{lesson.minutes} 分钟</span>
                <ChevronRight className="size-4 shrink-0 text-faint-foreground" />
              </Link>
            </li>
          )
        })}
      </ol>
    </Page>
  )
}
