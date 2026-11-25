import * as React from "react"
import { Route, Routes, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Page } from "@/components/ui/page"
import { StateView } from "@/components/ui/state"
import { ChapterPage } from "@/site/ChapterPage"
import { HomePage } from "@/site/HomePage"
import { LessonPage } from "@/site/LessonPage"
import { Shell } from "@/site/Shell"

// Reference pages load on demand: the tools page pulls in the widget toolkit and KaTeX.
const ToolsPage = React.lazy(() => import("@/site/ToolsPage").then((m) => ({ default: m.ToolsPage })))
const SymbolsPage = React.lazy(() => import("@/site/SymbolsPage").then((m) => ({ default: m.SymbolsPage })))
const GlossaryPage = React.lazy(() => import("@/site/GlossaryPage").then((m) => ({ default: m.GlossaryPage })))
const later = (el: React.ReactNode) => <React.Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>{el}</React.Suspense>

function NotFound() {
  const navigate = useNavigate()
  return (
    <Page width="narrow">
      <StateView kind="empty" title="没有这个页面" action={<Button onClick={() => navigate("/")}>回到首页</Button>} />
    </Page>
  )
}

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<HomePage />} />
        <Route path="learn/:chapterId" element={<ChapterPage />} />
        <Route path="learn/:chapterId/:lessonSlug" element={<LessonPage />} />
        <Route path="tools/:toolId?" element={later(<ToolsPage />)} />
        <Route path="symbols" element={later(<SymbolsPage />)} />
        <Route path="glossary" element={later(<GlossaryPage />)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
