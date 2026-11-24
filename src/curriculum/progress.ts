import * as React from "react"
import { LESSONS, type Chapter } from "./curriculum"

/*
 * Which lessons the learner has finished. Kept in localStorage on this device;
 * there is no account. One small store shared by every component.
 */
const KEY = "ohmwork:done"

type Done = Record<string, number>

let cache: Done | null = null
const listeners = new Set<() => void>()

function read(): Done {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Done
  } catch {
    cache = {}
  }
  return cache!
}

function write(next: Done) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage full or blocked: progress just lasts for this visit
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null
      cb()
    }
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener("storage", onStorage)
  }
}

export function setLessonDone(key: string, done: boolean) {
  const next = { ...read() }
  if (done) next[key] = Date.now()
  else delete next[key]
  write(next)
}

export function useProgress() {
  const done = React.useSyncExternalStore(subscribe, read, read)
  return React.useMemo(() => {
    const isDone = (key: string) => key in done
    const total = LESSONS.length
    const count = LESSONS.filter((l) => isDone(l.key)).length
    const chapterCount = (chapter: Chapter) => chapter.lessons.filter((l) => isDone(`${chapter.id}/${l.slug}`)).length
    /** The first unfinished lesson in course order; the first lesson when everything is done. */
    const next = LESSONS.find((l) => !isDone(l.key)) ?? LESSONS[0]
    return { isDone, count, total, chapterCount, next, started: count > 0 }
  }, [done])
}
