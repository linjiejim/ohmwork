import * as React from "react"

// Every lesson is its own chunk, fetched when opened (or earlier, by preloadLesson).
const modules = import.meta.glob<{ default: React.ComponentType }>("/src/content/*/*.mdx")
const lazyLessons = new Map<string, React.LazyExoticComponent<React.ComponentType>>()
const started = new Set<string>()

export function lessonComponent(key: string) {
  const load = modules[`/src/content/${key}.mdx`]
  if (!load) return null
  if (!lazyLessons.has(key)) lazyLessons.set(key, React.lazy(load))
  return lazyLessons.get(key)!
}

/**
 * Start fetching a lesson's chunk so opening it is instant. The browser caches
 * the module, so React.lazy's own import later resolves at once. Failures are
 * ignored here: the lesson page shows the error when it is actually opened.
 */
export function preloadLesson(key: string) {
  if (started.has(key)) return
  const load = modules[`/src/content/${key}.mdx`]
  if (!load) return
  started.add(key)
  load().catch(() => started.delete(key))
}

/** Preload a few lessons when the browser is idle. */
export function preloadWhenIdle(keys: string[]) {
  const run = () => keys.forEach(preloadLesson)
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(run, { timeout: 2000 })
    return () => window.cancelIdleCallback(id)
  }
  const t = setTimeout(run, 500)
  return () => clearTimeout(t)
}
