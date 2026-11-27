import * as React from "react"
import { LESSONS, type Chapter } from "./curriculum"

/*
 * Which lessons the learner has finished. Kept in localStorage on this device;
 * when signed in, src/auth/store.ts mirrors changes to Cloudflare D1 and merges
 * across devices without delaying local interaction.
 */
const KEY = "ohmwork:done"
const OWNER_KEY = "ohmwork:progress-owner"
const PENDING_KEY = "ohmwork:progress-pending"

export type DoneMap = Record<string, number>
export type PendingChanges = Record<string, number | null>

let cache: DoneMap | null = null
let cacheRaw: string | null = null
const listeners = new Set<() => void>()
const changeListeners = new Set<(key: string, value: number | null) => void>()

function read(): DoneMap {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return cache ?? {}
  }
  if (cache && raw === cacheRaw) return cache
  cacheRaw = raw
  try {
    const parsed = JSON.parse(raw ?? "{}")
    cache = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as DoneMap) : {}
  } catch {
    cache = {}
  }
  return cache
}

function write(next: DoneMap) {
  const serialized = JSON.stringify(next)
  cache = next
  cacheRaw = serialized
  try {
    localStorage.setItem(KEY, serialized)
  } catch {
    // storage full or blocked: progress just lasts for this visit
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) {
      cache = null
      cacheRaw = null
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
  const value = done ? Date.now() : null
  if (value !== null) next[key] = value
  else delete next[key]
  write(next)
  changeListeners.forEach((l) => l(key, value))
}

export function readDoneSnapshot(): DoneMap {
  return { ...read() }
}

export function readProgressOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}

export function setProgressOwner(owner: string | null) {
  try {
    if (owner) localStorage.setItem(OWNER_KEY, owner)
    else localStorage.removeItem(OWNER_KEY)
  } catch {
    // ignore storage errors
  }
}

/** Replace local progress from the server without re-emitting local change events. */
export function replaceProgress(done: DoneMap, owner: string) {
  setProgressOwner(owner)
  write({ ...done })
}

export function readPendingChanges(): PendingChanges {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "{}")
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as PendingChanges) : {}
  } catch {
    return {}
  }
}

export function writePendingChanges(changes: PendingChanges) {
  try {
    if (Object.keys(changes).length === 0) localStorage.removeItem(PENDING_KEY)
    else localStorage.setItem(PENDING_KEY, JSON.stringify(changes))
  } catch {
    // ignore storage errors
  }
}

export function onLocalProgressChange(cb: (key: string, value: number | null) => void) {
  changeListeners.add(cb)
  return () => {
    changeListeners.delete(cb)
  }
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
