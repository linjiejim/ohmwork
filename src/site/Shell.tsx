import * as React from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { BookA, Calculator, Circle, CircleCheck, Home, Monitor, Moon, Search, Shapes, Sun } from "lucide-react"
import { AppShell, NavGroup, NavItem } from "@/components/ui/app-shell"
import { CommandGroup, CommandItem, CommandPalette, useCommandPalette } from "@/components/ui/command-palette"
import { Kbd } from "@/components/ui/kbd"
import { Segmented } from "@/components/ui/segmented"
import { useAppearance, type Appearance } from "@/lib/appearance"
import { LESSONS, STAGES, chapterPath, lessonPath } from "@/curriculum/curriculum"
import { useProgress } from "@/curriculum/progress"
import { GLOSSARY } from "@/site/glossary-data"
import { preloadWhenIdle } from "@/site/lesson-modules"

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect width="24" height="24" rx="6" fill="currentColor" />
      <path d="M3.5 12H7L8.5 7.5L11.5 16.5L14.5 7.5L16 12H20.5" fill="none" stroke="var(--background)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Brand() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 rounded-md px-1 text-body font-semibold">
      <BrandMark className="size-5 shrink-0" />
      Ohmwork
    </button>
  )
}

const PAGES = [
  { path: "/", label: "首页", icon: Home, keywords: ["home", "学习路线", "路线图"] },
  { path: "/tools", label: "工具箱", icon: Calculator, keywords: ["calculator", "计算器", "色环", "分压", "限流电阻"] },
  { path: "/symbols", label: "符号速查", icon: Shapes, keywords: ["symbol", "原理图符号"] },
  { path: "/glossary", label: "术语表", icon: BookA, keywords: ["glossary", "名词", "缩写"] },
]

/** An open chapter's lessons are the next clicks in the sidebar: fetch them while idle so switching shows no blank. */
function PreloadChapter({ keys }: { keys: string[] }) {
  const id = keys.join()
  React.useEffect(() => preloadWhenIdle(id.split(",")), [id])
  return null
}

function SideNav({ onSearch }: { onSearch: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const progress = useProgress()
  const [, , activeChapter, activeLesson] = pathname.split("/")
  const inLearn = pathname.startsWith("/learn/")
  return (
    <>
      <NavGroup>
        <NavItem icon={<Search />} label="搜索" onClick={onSearch} trailing={<Kbd>⌘K</Kbd>} />
        {PAGES.map((p) => (
          <NavItem key={p.path} icon={<p.icon />} label={p.label} active={pathname === p.path} onClick={() => navigate(p.path)} />
        ))}
      </NavGroup>
      {STAGES.map((stage) => (
        <NavGroup key={stage.id} label={stage.title}>
          {stage.chapters.map((chapter) => {
            const open = inLearn && activeChapter === chapter.id
            return (
              <React.Fragment key={chapter.id}>
                <NavItem
                  icon={<chapter.icon />}
                  label={chapter.title}
                  active={open && !activeLesson}
                  onClick={() => navigate(chapterPath(chapter.id))}
                  trailing={
                    <span className="tabular text-caption text-faint-foreground">
                      {progress.chapterCount(chapter)}/{chapter.lessons.length}
                    </span>
                  }
                />
                {open && <PreloadChapter keys={chapter.lessons.map((l) => `${chapter.id}/${l.slug}`)} />}
                {open && (
                  <li>
                    <ul className="my-0.5 ml-4 flex flex-col gap-px border-l pl-1.5">
                      {chapter.lessons.map((lesson) => {
                        const key = `${chapter.id}/${lesson.slug}`
                        return (
                          <NavItem
                            key={key}
                            icon={progress.isDone(key) ? <CircleCheck className="text-success" /> : <Circle className="text-faint-foreground" />}
                            label={lesson.title}
                            active={activeLesson === lesson.slug}
                            onClick={() => navigate(lessonPath(key))}
                          />
                        )
                      })}
                    </ul>
                  </li>
                )}
              </React.Fragment>
            )
          })}
        </NavGroup>
      ))}
    </>
  )
}

function AppearanceControl() {
  const { preference, setAppearance } = useAppearance()
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <span className="text-small text-muted-foreground">外观</span>
      <Segmented<Appearance>
        size="sm"
        aria-label="外观"
        value={preference}
        onValueChange={setAppearance}
        options={[
          { value: "system", icon: <Monitor />, label: <span className="sr-only">跟随系统</span> },
          { value: "light", icon: <Sun />, label: <span className="sr-only">浅色</span> },
          { value: "dark", icon: <Moon />, label: <span className="sr-only">深色</span> },
        ]}
      />
    </div>
  )
}

function SearchPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  return (
    <CommandPalette open={open} onOpenChange={onOpenChange} placeholder="搜索课程、工具和术语" label="搜索">
      <CommandGroup heading="课程">
        {LESSONS.map(({ key, lesson, chapter }) => (
          <CommandItem key={key} value={`${lesson.title} ${key}`} icon={<chapter.icon />} hint={chapter.title} keywords={[...(lesson.keywords ?? []), chapter.title, lesson.summary]} onSelect={() => navigate(lessonPath(key))}>
            {lesson.title}
          </CommandItem>
        ))}
      </CommandGroup>
      <CommandGroup heading="页面">
        {PAGES.map((p) => (
          <CommandItem key={p.path} value={`page ${p.label}`} icon={<p.icon />} keywords={p.keywords} onSelect={() => navigate(p.path)}>
            {p.label}
          </CommandItem>
        ))}
      </CommandGroup>
      <CommandGroup heading="术语">
        {GLOSSARY.map((g) => (
          <CommandItem key={g.term} value={`term ${g.term} ${g.en ?? ""}`} icon={<BookA />} hint={g.en} keywords={g.en ? [g.en] : undefined} onSelect={() => navigate(`/glossary?q=${encodeURIComponent(g.term)}`)}>
            {g.term}
          </CommandItem>
        ))}
      </CommandGroup>
    </CommandPalette>
  )
}

/** The frame around every page: course navigation on the left, the page on the right, ⌘K search. */
export function Shell() {
  const { pathname } = useLocation()
  const [open, setOpen] = useCommandPalette()
  const content = React.useRef<HTMLDivElement>(null)
  // the main area scrolls on its own, so a new page has to be sent back to the top by hand
  React.useEffect(() => {
    content.current?.parentElement?.scrollTo(0, 0)
  }, [pathname])
  return (
    <>
      <AppShell brand={<Brand />} sidebar={<SideNav onSearch={() => setOpen(true)} />} footer={<AppearanceControl />}>
        <div ref={content}>
          <Outlet />
        </div>
      </AppShell>
      <SearchPalette open={open} onOpenChange={setOpen} />
    </>
  )
}
