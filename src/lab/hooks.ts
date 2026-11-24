import * as React from "react"

/*
 * One requestAnimationFrame loop for the whole page. Widgets subscribe while
 * they are on screen and playing, so an idle page costs nothing.
 */
type FrameCallback = (dt: number, now: number) => void
const subscribers = new Set<FrameCallback>()
let rafId = 0
let lastNow = 0

function loop(now: number) {
  // a background tab resumes with a huge gap: cap it so simulations don't jump
  const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000))
  lastNow = now
  subscribers.forEach((cb) => cb(dt, now / 1000))
  rafId = subscribers.size ? requestAnimationFrame(loop) : 0
}

/** Subscribe to animation frames. `dt` is seconds since the last frame (≤ 0.05). Returns the unsubscribe. */
export function onFrame(cb: FrameCallback) {
  subscribers.add(cb)
  if (!rafId && typeof requestAnimationFrame !== "undefined") {
    lastNow = performance.now()
    rafId = requestAnimationFrame(loop)
  }
  return () => {
    subscribers.delete(cb)
  }
}

/** Set by <Lab>: whether the widget is on screen. Animations pause when it is not. */
export const LabContext = React.createContext<{ inView: boolean }>({ inView: true })

/** Run `cb` every frame while `active` and the surrounding <Lab> is on screen. For imperative drawing. */
export function useFrame(cb: FrameCallback, active = true) {
  const { inView } = React.useContext(LabContext)
  const ref = React.useRef(cb)
  ref.current = cb
  const run = active && inView
  React.useEffect(() => {
    if (!run) return
    return onFrame((dt, now) => ref.current(dt, now))
  }, [run])
}

/**
 * Simulation clock in seconds. Advances while `running` (and on screen), holds
 * its value while paused. `speed` scales it: 0.5 is slow motion.
 */
export function useTime(running = true, speed = 1): number {
  const [t, setT] = React.useState(0)
  const speedRef = React.useRef(speed)
  speedRef.current = speed
  useFrame((dt) => setT((v) => v + dt * speedRef.current), running)
  return t
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Play / pause state for a looping animation. Starts paused for people who
 * asked their system for less motion; pair it with <PlayButton>.
 */
export function usePlayback(initial = true) {
  const [playing, setPlaying] = React.useState(() => initial && !prefersReducedMotion())
  const toggle = React.useCallback(() => setPlaying((p) => !p), [])
  return { playing, setPlaying, toggle }
}
export type Playback = ReturnType<typeof usePlayback>

/** Width of an element in CSS px, tracked with ResizeObserver. `fallback` until measured (and in tests). */
export function useWidth<T extends Element>(fallback = 640): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T>(null)
  const [width, setWidth] = React.useState(fallback)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === "undefined") return
    const measure = () => {
      const w = el.getBoundingClientRect().width
      if (w > 0) setWidth(Math.round(w))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/** Whether an element is (nearly) on screen. True where IntersectionObserver is missing. */
export function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = React.useRef<T>(null)
  const [inView, setInView] = React.useState(true)
  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "120px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, inView]
}
