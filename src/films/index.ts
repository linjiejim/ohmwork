import * as React from "react"

/*
 * Lesson films live at src/films/<chapter>/<lesson>/Film.tsx, next to their
 * film.json (script), timing.json and audio.mp3 (both written by
 * scripts/films/build.py). Each is its own chunk, fetched only on a lesson
 * that has one; its audio only when it is played.
 */
const modules = import.meta.glob<{ default: React.ComponentType }>("/src/films/*/*/Film.tsx")
const cache = new Map<string, React.LazyExoticComponent<React.ComponentType>>()

/** The film for a lesson key ("basics/ohms-law"), or null when the lesson has none. */
export function lessonFilm(key: string) {
  const load = modules[`/src/films/${key}/Film.tsx`]
  if (!load) return null
  let film = cache.get(key)
  if (!film) {
    film = React.lazy(load)
    cache.set(key, film)
  }
  return film
}
