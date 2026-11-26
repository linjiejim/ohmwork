import * as React from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { BookA, Calculator, Circle, CircleCheck, Home, Moon, Search, Shapes, Sun } from "lucide-react"
import { AppShell, NavGroup, NavItem } from "@/components/ui/app-shell"
import { CommandGroup, CommandItem, CommandPalette, useCommandPalette } from "@/components/ui/command-palette"
import { Kbd } from "@/components/ui/kbd"
import { Segmented } from "@/components/ui/segmented"
import { resolveAppearance, useAppearance } from "@/lib/appearance"
import { LESSONS, STAGES, chapterPath, lessonPath } from "@/curriculum/curriculum"
import { useProgress } from "@/curriculum/progress"
import { GLOSSARY } from "@/site/glossary-data"
import { preloadWhenIdle } from "@/site/lesson-modules"
import { TOOLS, toolPath } from "@/site/tools"

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
  { path: "/tools", label: "工具箱", icon: Calculator, keywords: ["tools", "calculator", "计算器"] },
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
          <NavItem key={p.path} icon={<p.icon />} label={p.label} active={pathname === p.path || (p.path !== "/" && pathname.startsWith(`${p.path}/`))} onClick={() => navigate(p.path)} />
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

export const REPO_URL = "https://github.com/linjiejim/ohmwork"
export const AUTHOR = { name: "Jim Lin", url: "https://jimlin.me" }

/** lucide dropped brand icons, so the GitHub mark is drawn here. */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className}>
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  )
}

/**
 * Two choices, light and dark; with nothing picked the site follows the OS.
 * Picking whatever the OS is showing right now hands the choice back to the OS,
 * so "follow the system" stays reachable without a third button.
 */
function AppearanceToggle() {
  const { resolved, setAppearance } = useAppearance()
  const pick = (v: "light" | "dark") => setAppearance(v === resolveAppearance("system") ? "system" : v)
  return (
    <Segmented<"light" | "dark">
      size="sm"
      aria-label="外观"
      value={resolved}
      onValueChange={pick}
      options={[
        { value: "light", icon: <Sun />, label: <span className="sr-only">浅色</span> },
        { value: "dark", icon: <Moon />, label: <span className="sr-only">深色</span> },
      ]}
    />
  )
}

/** Bottom of the sidebar: where the code lives, who made it, light or dark. */
function SidebarFooter() {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-2">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="flex h-(--nav-item-h) min-w-0 items-center gap-2 rounded-md px-2 text-body text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-accent hover:text-foreground"
        >
          <GitHubMark className="size-4 shrink-0" />
          <span className="truncate">GitHub</span>
        </a>
        <AppearanceToggle />
      </div>
      <p className="px-2 pb-0.5 text-caption text-faint-foreground">
        作者{" "}
        <a href={AUTHOR.url} target="_blank" rel="noreferrer" className="text-muted-foreground underline decoration-input underline-offset-4 hover:text-foreground hover:decoration-foreground">
          {AUTHOR.name}
        </a>
      </p>
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
      <CommandGroup heading="工具">
        {TOOLS.map((t) => (
          <CommandItem key={t.id} value={`tool ${t.title}`} icon={<t.icon />} keywords={t.keywords} onSelect={() => navigate(toolPath(t.id))}>
            {t.title}
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
      <AppShell brand={<Brand />} sidebar={<SideNav onSearch={() => setOpen(true)} />} footer={<SidebarFooter />}>
        {/* full height, so a page that fills the window (Page fill) can size itself to it */}
        <div ref={content} className="h-full">
          <Outlet />
        </div>
      </AppShell>
      <SearchPalette open={open} onOpenChange={setOpen} />
    </>
  )
}
