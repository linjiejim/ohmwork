import { Link } from "react-router-dom"
import { ArrowRight, BookA, Calculator, Shapes } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Page, Section } from "@/components/ui/page"
import { Progress } from "@/components/ui/progress"
import { LESSONS, STAGES, chapterPath, lessonPath } from "@/curriculum/curriculum"
import { useProgress } from "@/curriculum/progress"
import { OhmsLawLab } from "@/widgets/basics/OhmsLawLab"

const SHORTCUTS = [
  { to: "/tools", icon: Calculator, title: "工具箱", text: "色环、分压、限流电阻、滤波器……常用的计算器都在这里。" },
  { to: "/symbols", icon: Shapes, title: "符号速查", text: "原理图上的符号长什么样、叫什么、引脚怎么分。" },
  { to: "/glossary", icon: BookA, title: "术语表", text: "遇到没见过的词和缩写，来这里查一句话解释。" },
]

export function HomePage() {
  const progress = useProgress()
  const next = progress.next
  const minutes = LESSONS.reduce((sum, l) => sum + l.lesson.minutes, 0)
  return (
    <Page width="wide">
      <div className="grid items-start gap-x-12 gap-y-8 pb-4 pt-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:pt-10">
        <div>
          <h1 className="text-display font-semibold sm:text-hero">动手拨一拨，电路就看懂了</h1>
          <p className="mt-4 max-w-md text-reading text-muted-foreground">
            每个概念都配一个能拖、能调、会动的小实验。从电压电流讲到传感器、射频和 PCB 设计，{LESSONS.length} 节课，一步一步来。
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild variant="primary" size="lg">
              <Link to={lessonPath(next.key)}>
                {progress.started ? `继续学习：${next.lesson.title}` : "开始第一课"}
                <ArrowRight />
              </Link>
            </Button>
          </div>
          {progress.started ? (
            <div className="mt-8 max-w-sm">
              <div className="mb-1.5 flex justify-between text-small text-muted-foreground">
                <span id="home-progress">学习进度</span>
                <span className="tabular">
                  {progress.count} / {progress.total} 课
                </span>
              </div>
              <Progress value={progress.count} max={progress.total} aria-labelledby="home-progress" />
            </div>
          ) : (
            <dl className="mt-8 flex gap-8 text-small text-muted-foreground">
              {[
                [String(STAGES.length), "个阶段"],
                [String(LESSONS.length), "节课"],
                [`约 ${Math.round(minutes / 60)}`, "小时"],
              ].map(([n, label]) => (
                <div key={label}>
                  <dt className="tabular text-title-lg font-semibold text-foreground">{n}</dt>
                  <dd>{label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <OhmsLawLab compact />
      </div>

      {STAGES.map((stage) => (
        <Section key={stage.id} title={stage.title}>
          <p className="-mt-2 mb-3 max-w-2xl text-body text-muted-foreground">{stage.summary}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stage.chapters.map((chapter) => {
              const done = progress.chapterCount(chapter)
              return (
                <Link
                  key={chapter.id}
                  to={chapterPath(chapter.id)}
                  className="flex flex-col rounded-lg border p-4 transition-colors duration-(--duration-fast) hover:border-input hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <chapter.icon className="size-5 text-muted-foreground" />
                    <h3 className="flex-1 text-heading font-semibold">{chapter.title}</h3>
                    <span className="tabular text-caption text-faint-foreground">
                      {done}/{chapter.lessons.length}
                    </span>
                  </div>
                  <p className="mt-1.5 text-small text-muted-foreground">{chapter.summary}</p>
                  <ul className="mt-3 flex flex-col gap-0.5 text-small text-muted-foreground">
                    {chapter.lessons.map((lesson) => (
                      <li key={lesson.slug} className="flex items-center gap-2">
                        <span aria-hidden className={progress.isDone(`${chapter.id}/${lesson.slug}`) ? "size-1.5 rounded-full bg-success" : "size-1.5 rounded-full bg-input"} />
                        <span className="truncate">{lesson.title}</span>
                      </li>
                    ))}
                  </ul>
                </Link>
              )
            })}
          </div>
        </Section>
      ))}

      <Section title="随手查">
        <div className="grid gap-3 sm:grid-cols-3">
          {SHORTCUTS.map((s) => (
            <Link key={s.to} to={s.to} className="rounded-lg border p-4 transition-colors duration-(--duration-fast) hover:border-input hover:bg-accent">
              <div className="flex items-center gap-2">
                <s.icon className="size-5 text-muted-foreground" />
                <h3 className="text-heading font-semibold">{s.title}</h3>
              </div>
              <p className="mt-1.5 text-small text-muted-foreground">{s.text}</p>
            </Link>
          ))}
        </div>
      </Section>
    </Page>
  )
}
