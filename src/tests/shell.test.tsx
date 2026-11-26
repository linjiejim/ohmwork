/**
 * Sidebar footer: links back to the repo and the author, and an appearance
 * toggle with only light and dark that follows the OS until someone picks.
 * The browser tab names the page you are on.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AUTHOR, REPO_URL, Shell } from "@/site/Shell"

let osDark = false
let osListeners: (() => void)[] = []
const original = window.matchMedia
/** Flip the OS appearance while the page is open, as the media query would report it. */
const setOs = (dark: boolean) =>
  act(() => {
    osDark = dark
    osListeners.forEach((l) => l())
  })

function renderShell(url = "/") {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<div>home</div>} />
            <Route path="*" element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  )
}

const toggle = () => screen.getByRole("radiogroup", { name: "外观" })
const option = (name: string) => within(toggle()).getByRole("radio", { name })
const isOn = (name: string) => option(name).getAttribute("aria-checked") === "true"

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove("dark")
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query.includes("dark") ? osDark : false
    },
    media: query,
    addEventListener(_: string, l: () => void) {
      if (query.includes("dark")) osListeners.push(l)
    },
    removeEventListener(_: string, l: () => void) {
      osListeners = osListeners.filter((x) => x !== l)
    },
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  cleanup()
  window.matchMedia = original
  osDark = false
  osListeners = []
})

describe("sidebar footer", () => {
  it("links to the GitHub repo and credits the author, both in a new tab", () => {
    renderShell()
    const repo = screen.getByRole("link", { name: "GitHub" })
    expect(repo.getAttribute("href")).toBe(REPO_URL)
    expect(repo.getAttribute("target")).toBe("_blank")
    expect(repo.getAttribute("rel")).toContain("noreferrer")
    const author = screen.getByRole("link", { name: AUTHOR.name })
    expect(author.getAttribute("href")).toBe(AUTHOR.url)
    expect(author.getAttribute("target")).toBe("_blank")
    expect(author.getAttribute("rel")).toContain("noreferrer")
    expect(author.closest("p")?.textContent).toContain("作者")
  })

  it("offers light and dark only, no follow-the-system option", () => {
    renderShell()
    const names = within(toggle()).getAllByRole("radio").map((r) => r.textContent)
    expect(names).toEqual(["浅色", "深色"])
  })

  it("follows the OS when nothing has been picked", () => {
    osDark = true
    renderShell()
    expect(isOn("深色")).toBe(true)
    expect(isOn("浅色")).toBe(false)
    expect(localStorage.getItem("appearance")).toBeNull()
  })

  it("keeps following the OS when it changes while the page is open", () => {
    renderShell()
    expect(isOn("浅色")).toBe(true)
    setOs(true)
    expect(isOn("深色")).toBe(true)
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(localStorage.getItem("appearance")).toBeNull()
  })

  it("keeps a stored pick when the OS changes later", () => {
    localStorage.setItem("appearance", "light")
    renderShell()
    setOs(true)
    expect(isOn("浅色")).toBe(true)
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("remembers a pick that differs from the OS, and hands back to the OS when the pick matches it", () => {
    osDark = false
    renderShell()
    expect(isOn("浅色")).toBe(true)

    act(() => fireEvent.click(option("深色")))
    expect(localStorage.getItem("appearance")).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(isOn("深色")).toBe(true)

    act(() => fireEvent.click(option("浅色")))
    expect(localStorage.getItem("appearance")).toBeNull()
    expect(document.documentElement.classList.contains("dark")).toBe(false)
    expect(isOn("浅色")).toBe(true)
  })
})

describe("page title", () => {
  it("names the page in the browser tab", () => {
    renderShell("/learn/basics/ohms-law")
    expect(document.title).toBe("欧姆定律 · Ohmwork")
  })

  it("says so when there is no such page", () => {
    renderShell("/learn/basics/nope")
    expect(document.title).toBe("没有这个页面 · Ohmwork")
  })
})
