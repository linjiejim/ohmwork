import * as React from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Page, PageHeader } from "@/components/ui/page"
import { StateView } from "@/components/ui/state"
import { LESSONS, lessonPath } from "@/curriculum/curriculum"
import { GLOSSARY } from "@/site/glossary-data"

const lessonTitle = new Map(LESSONS.map((l) => [l.key, l.lesson.title]))

/** Every term the course uses, each in a sentence or two, with the lesson that teaches it. */
export function GlossaryPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get("q") ?? ""
  const setQuery = (q: string) => setParams(q ? { q } : {}, { replace: true })
  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return GLOSSARY
    return GLOSSARY.filter((g) => g.term.toLowerCase().includes(q) || g.en?.toLowerCase().includes(q) || g.text.toLowerCase().includes(q))
  }, [query])
  return (
    <Page width="narrow">
      <PageHeader title="术语表" info="课程里出现的名词和缩写，每个一两句话。点课程名可以跳到讲它的那一课。" />
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例如：阻抗、PWM、pull-up" aria-label="搜索术语" className="pl-8" />
      </div>
      {shown.length === 0 ? (
        <StateView kind="no-match" title="没有符合的术语" onClearFilters={() => setQuery("")} />
      ) : (
        <dl className="overflow-hidden rounded-lg border">
          {shown.map((g) => (
            <div key={g.term} className="border-b px-4 py-3 last:border-b-0">
              <dt className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-body font-semibold">{g.term}</span>
                {g.en && <span className="text-small text-faint-foreground">{g.en}</span>}
              </dt>
              <dd className="mt-0.5 text-body text-muted-foreground">
                {g.text}
                {g.lesson && lessonTitle.has(g.lesson) && (
                  <>
                    {" "}
                    <Link to={lessonPath(g.lesson)} className="whitespace-nowrap text-foreground underline decoration-input underline-offset-4 hover:decoration-foreground">
                      {lessonTitle.get(g.lesson)}
                    </Link>
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Page>
  )
}
