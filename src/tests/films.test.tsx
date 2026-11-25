/**
 * Every lesson film: its timing.json is up to date with its script, every frame
 * renders without NaN (a beat the stage asks for but the script doesn't name
 * shows up as NaN in a position), and the player starts idle with a play button.
 */
import { beforeAll, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { FilmDef } from "@/films/kit"

// loaded one by one, so a film that doesn't compile yet fails only its own tests
const films = import.meta.glob<{ film: FilmDef; default: React.ComponentType }>("/src/films/*/*/Film.tsx")
const scripts = import.meta.glob<{ lines: { id: string; text: string }[] }>("/src/films/*/*/film.json", { import: "default" })

describe.each(Object.keys(films))("%s", (path) => {
  const dir = path.replace(/Film\.tsx$/, "")
  let mod: Awaited<ReturnType<(typeof films)[string]>>
  let film: FilmDef
  let script: { lines: { id: string; text: string }[] } | undefined
  beforeAll(async () => {
    mod = await films[path]()
    film = mod.film
    script = await scripts[`${dir}film.json`]?.()
  })

  it("timing.json matches film.json (rerun scripts/films/build.py after editing the script)", () => {
    expect(script, "film.json next to Film.tsx").toBeTruthy()
    expect(film.timing.lines.map((l) => [l.id, l.text])).toEqual(script!.lines.map((l) => [l.id, l.text]))
  })

  it("draws every moment without NaN, asking only for beats the script names", () => {
    const { Stage, timing } = film
    const b = new Proxy(timing.beats, {
      get(beats, name) {
        if (typeof name === "string" && !(name in beats)) throw new Error(`the stage asks for beat "${name}", which film.json doesn't name`)
        return beats[name as string]
      },
    })
    for (let t = 0; t <= timing.duration + 0.5; t += 0.5) {
      const { container } = render(<Stage t={t} b={b} still={false} />)
      expect(container.innerHTML, `t = ${t}`).not.toMatch(/NaN|undefined/)
      cleanup()
    }
    const { container } = render(<Stage t={30} b={timing.beats} still />)
    expect(container.innerHTML).not.toMatch(/NaN|undefined/)
    cleanup()
  })

  it("starts idle, and seeking shows the line being spoken", () => {
    const Film = mod.default
    render(
      <TooltipProvider>
        <Film />
      </TooltipProvider>,
    )
    expect(screen.getByRole("button", { name: /播放动画讲解/ })).toBeTruthy()
    const first = film.timing.captions[1]
    fireEvent.change(screen.getByRole("slider", { name: "播放进度" }), { target: { value: String(first.start + 0.5) } })
    expect(screen.queryByRole("button", { name: /播放动画讲解/ })).toBeNull()
    expect(screen.getAllByText(first.text).length).toBeGreaterThan(0)
    cleanup()
  })
})
