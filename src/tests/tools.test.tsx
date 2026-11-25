/**
 * The toolbox: one tool per URL, the colour-code reader first, an unknown id says so,
 * and a tool keeps what was typed into it while you look at another.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TOOLS } from "@/site/tools"
import { ToolsPage } from "@/site/ToolsPage"

let path = ""
function Where() {
  path = useLocation().pathname
  return null
}

function renderAt(url: string) {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="tools/:toolId?" element={<ToolsPage />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </TooltipProvider>,
  )
}

const title = () => screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("tools page", () => {
  it("lists the colour-code reader first", () => {
    expect(TOOLS[0].id).toBe("color-code")
  })

  it("renders the colour-code reader at /tools/color-code", () => {
    const { container } = renderAt("/tools/color-code")
    expect(title()).toContain("电阻色环")
    expect(container.querySelector("[data-lab]")).not.toBeNull()
    expect(screen.getByText("色环读数器")).toBeTruthy()
    expect(screen.getByRole("link", { name: "电阻色环" }).getAttribute("aria-current")).toBe("page")
  })

  it("renders the Ohm's law calculator at /tools/ohm", () => {
    renderAt("/tools/ohm")
    expect(title()).toContain("欧姆定律与功率")
    expect(screen.getByLabelText("电压")).toHaveProperty("value", "5")
    expect(screen.getByText("5 mA")).toBeTruthy()
    expect(screen.getByRole("link", { name: "欧姆定律" }).getAttribute("href")).toBe("/learn/basics/ohms-law")
  })

  it("shows the empty state for an unknown tool", () => {
    renderAt("/tools/no-such-tool")
    expect(screen.getByText("找不到这个工具")).toBeTruthy()
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "回到工具箱" }))
    })
    expect(path).toBe("/tools")
  })

  it("renders every tool in the list", () => {
    for (const tool of TOOLS) {
      const { container } = renderAt(`/tools/${tool.id}`)
      expect(title(), tool.id).toContain(tool.title)
      expect(container.textContent, tool.id).not.toMatch(/NaN|undefined|\[object Object\]|找不到这个工具/)
      cleanup()
    }
  })

  it("shows the list at /tools on a narrow screen and opens the first tool on a wide one", () => {
    renderAt("/tools")
    expect(title()).toEqual(["工具箱"])
    expect(path).toBe("/tools")
    cleanup()

    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList,
    )
    renderAt("/tools")
    expect(path).toBe("/tools/color-code")
    expect(title()).toContain("电阻色环")
  })

  it("keeps typed values when switching tools", () => {
    renderAt("/tools/ohm")
    act(() => {
      fireEvent.change(screen.getByLabelText("电阻"), { target: { value: "2k" } })
    })
    expect(screen.getByText("2.5 mA")).toBeTruthy()
    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "分压器" }))
    })
    expect(title()).toContain("分压器")
    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "欧姆定律与功率" }))
    })
    expect(screen.getByLabelText("电阻")).toHaveProperty("value", "2k")
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "恢复初始值" }))
    })
    expect(screen.getByLabelText("电阻")).toHaveProperty("value", "1k")
  })

  it("steps through the tools with ↓ / ↑ and J / K, but not while typing", () => {
    renderAt("/tools/color-code")
    act(() => {
      fireEvent.keyDown(document.body, { key: "ArrowDown" })
    })
    expect(path).toBe(`/tools/${TOOLS[1].id}`)
    act(() => {
      fireEvent.keyDown(document.body, { key: "j" })
    })
    expect(path).toBe(`/tools/${TOOLS[2].id}`)
    act(() => {
      fireEvent.keyDown(document.body, { key: "k" })
    })
    expect(path).toBe(`/tools/${TOOLS[1].id}`)
    act(() => {
      fireEvent.keyDown(screen.getAllByRole("textbox")[0], { key: "ArrowDown" })
    })
    expect(path).toBe(`/tools/${TOOLS[1].id}`)
  })
})
