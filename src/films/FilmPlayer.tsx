import * as React from "react"
import { Captions, CaptionsOff, Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react"
import { Button, IconButton } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useDelayedFlag } from "@/hooks/use-delayed-flag"
import { prefersReducedMotion } from "@/lab/hooks"
import { cn } from "@/lib/utils"
import type { FilmDef } from "./kit"

const CAPTIONS_KEY = "ohmwork.film.captions"

function clock(s: number) {
  const v = Math.max(0, Math.round(s))
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`
}

function spoken(s: number) {
  const v = Math.max(0, Math.round(s))
  return v >= 60 ? `${Math.floor(v / 60)} 分 ${v % 60} 秒` : `${v} 秒`
}

type State = "idle" | "playing" | "paused" | "ended" | "error"

/**
 * Plays a lesson film: the stage, a caption line under it, and the controls.
 * The audio element is the clock; the stage is redrawn from its currentTime
 * every frame while playing. Nothing is downloaded until the first play.
 */
export function FilmPlayer({ film }: { film: FilmDef }) {
  const { timing, Stage } = film
  const duration = timing.duration
  const audio = React.useRef<HTMLAudioElement>(null)
  const figure = React.useRef<HTMLElement>(null)
  const [state, setState] = React.useState<State>("idle")
  const [t, setT] = React.useState(film.poster)
  const [waiting, setWaiting] = React.useState(false)
  const [muted, setMuted] = React.useState(false)
  const [captions, setCaptions] = React.useState(() => (typeof localStorage === "undefined" ? true : localStorage.getItem(CAPTIONS_KEY) !== "off"))
  const [fullscreen, setFullscreen] = React.useState(false)
  const [still] = React.useState(prefersReducedMotion)
  const loading = useDelayedFlag(waiting && state === "playing")

  React.useEffect(() => {
    if (state !== "playing") return
    let id = 0
    const tick = () => {
      if (audio.current) setT(audio.current.currentTime)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [state])

  React.useEffect(() => {
    const sync = () => setFullscreen(!!figure.current && document.fullscreenElement === figure.current)
    document.addEventListener("fullscreenchange", sync)
    return () => document.removeEventListener("fullscreenchange", sync)
  }, [])

  const play = () => {
    const a = audio.current
    if (!a) return
    if (state === "idle" || state === "ended") a.currentTime = 0
    if (state === "idle") setT(0)
    a.play().catch(() => setState((s) => (s === "error" ? s : "paused")))
  }
  const pause = () => audio.current?.pause()
  const toggle = () => (state === "playing" ? pause() : play())
  const seek = (to: number) => {
    const v = Math.min(duration, Math.max(0, to))
    if (audio.current) audio.current.currentTime = v
    setT(v)
    if (state === "idle" || state === "ended") setState("paused")
  }
  const retry = () => {
    audio.current?.load()
    setState("paused")
    play()
  }
  const setCaptionsOn = (on: boolean) => {
    setCaptions(on)
    try {
      localStorage.setItem(CAPTIONS_KEY, on ? "on" : "off")
    } catch {
      /* private mode: the choice lasts for this page */
    }
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void figure.current?.requestFullscreen?.()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const onRange = (e.target as HTMLElement).tagName === "INPUT"
    const onButton = (e.target as HTMLElement).tagName === "BUTTON"
    if ((e.key === " " && !onButton) || e.key === "k") {
      e.preventDefault()
      toggle()
    } else if (!onRange && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault()
      seek(t + (e.key === "ArrowLeft" ? -5 : 5))
    } else if (e.key === "c") setCaptionsOn(!captions)
    else if (e.key === "m") setMuted((m) => !m)
  }

  // the line being spoken, held briefly after it ends so a short pause doesn't blink
  const caption = React.useMemo(() => {
    if (state === "idle") return null
    const list = timing.captions
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i]
      if (c.start <= t + 0.05) return t < c.end + 0.8 ? c.text : null
    }
    return null
  }, [t, state, timing.captions])

  const shownT = state === "idle" ? 0 : t
  const fill = (shownT / duration) * 100

  return (
    <figure
      ref={figure}
      aria-label={`动画讲解：${film.title}`}
      onKeyDown={onKeyDown}
      className={cn("overflow-hidden rounded-lg border bg-background", fullscreen && "flex flex-col justify-center rounded-none border-0")}
    >
      <div className={cn("relative", fullscreen && "mx-auto w-[min(100%,calc((100dvh-8rem)*16/9))]")}>
        <div className="@container relative aspect-video w-full cursor-pointer select-none overflow-hidden bg-sunken text-foreground" onClick={toggle} aria-hidden>
          <Stage t={state === "idle" ? film.poster : t} b={timing.beats} still={still} />
        </div>

        {state === "idle" && (
          <Overlay onClick={play} bottom>
            <Button variant="primary" size="lg" className="rounded-full px-5" onClick={play}>
              <Play />
              播放动画讲解
              <span className="tabular text-primary-foreground/70">{clock(duration)}</span>
            </Button>
          </Overlay>
        )}
        {state === "ended" && (
          <Overlay onClick={play}>
            <Button variant="secondary" size="lg" className="rounded-full px-5" onClick={play}>
              <RotateCcw />
              重新播放
            </Button>
          </Overlay>
        )}
        {state === "error" && (
          <Overlay>
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-background px-5 py-4 text-center">
              <p className="text-body">动画的声音没能加载出来，检查网络后重试。</p>
              <Button variant="secondary" onClick={retry}>
                重试
              </Button>
            </div>
          </Overlay>
        )}
        {loading && (
          <Overlay>
            <Spinner label="正在加载" className="size-6" />
          </Overlay>
        )}
      </div>

      {captions && state !== "idle" && (
        <div aria-hidden className={cn("flex min-h-14 items-center justify-center border-t px-4 py-2 text-center text-small text-foreground sm:text-body", fullscreen && "min-h-20 text-heading sm:text-heading")}>
          {caption}
        </div>
      )}

      <div className="flex items-center gap-1 border-t px-2 py-1">
        <IconButton size="icon-sm" label={state === "playing" ? "暂停" : "播放"} onClick={toggle}>
          {state === "playing" ? <Pause /> : <Play />}
        </IconButton>
        <span className="tabular w-[6.5em] shrink-0 text-caption text-muted-foreground">
          {clock(shownT)} / {clock(duration)}
        </span>
        <input
          type="range"
          className="lab-range min-w-0 flex-1"
          min={0}
          max={duration}
          step={0.05}
          value={shownT}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="播放进度"
          aria-valuetext={`${spoken(shownT)}，共 ${spoken(duration)}`}
          style={{ "--fill": `${fill}%` } as React.CSSProperties}
        />
        <IconButton size="icon-sm" label={captions ? "关闭字幕" : "打开字幕"} aria-pressed={captions} onClick={() => setCaptionsOn(!captions)}>
          {captions ? <Captions /> : <CaptionsOff />}
        </IconButton>
        <IconButton size="icon-sm" label={muted ? "打开声音" : "静音"} aria-pressed={muted} onClick={() => setMuted((m) => !m)}>
          {muted ? <VolumeX /> : <Volume2 />}
        </IconButton>
        {typeof document !== "undefined" && document.fullscreenEnabled && (
          <IconButton size="icon-sm" label={fullscreen ? "退出全屏" : "全屏"} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize /> : <Maximize />}
          </IconButton>
        )}
      </div>

      <details className="group border-t px-4 py-2 text-small">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">文字稿</summary>
        <ol className="mt-2 flex flex-col gap-1 pb-1">
          {timing.captions.map((c) => (
            <li key={c.start} className="flex gap-3">
              <button type="button" className="tabular shrink-0 text-caption text-faint-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => seek(c.start)} aria-label={`跳到 ${spoken(c.start)}`}>
                {clock(c.start)}
              </button>
              <span>{c.text}</span>
            </li>
          ))}
        </ol>
      </details>

      <audio
        ref={audio}
        src={film.audio}
        preload="none"
        muted={muted}
        onPlay={() => setState("playing")}
        onPause={() => setState((s) => (s === "playing" ? "paused" : s))}
        onEnded={() => {
          setState("ended")
          setT(duration)
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onError={() => setState((s) => (s === "idle" ? s : "error"))}
      />
    </figure>
  )
}

/** Sits over the stage, not the captions or controls. A click on its empty part does `onClick` too. */
function Overlay({ children, onClick, bottom }: { children: React.ReactNode; onClick?: () => void; /** Near the bottom edge, clear of the picture's centre. */ bottom?: boolean }) {
  return (
    <div
      className={cn("absolute inset-0 grid justify-items-center", bottom ? "items-end pb-[5%]" : "items-center", onClick && "cursor-pointer")}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClick?.()
      }}
    >
      {children}
    </div>
  )
}
