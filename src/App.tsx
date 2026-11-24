import { Route, Routes, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Page } from "@/components/ui/page"
import { StateView } from "@/components/ui/state"
import { ChapterPage } from "@/site/ChapterPage"
import { GlossaryPage } from "@/site/GlossaryPage"
import { HomePage } from "@/site/HomePage"
import { LessonPage } from "@/site/LessonPage"
import { Shell } from "@/site/Shell"
import { SymbolsPage } from "@/site/SymbolsPage"
import { ToolsPage } from "@/site/ToolsPage"

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
        <Route path="tools" element={<ToolsPage />} />
        <Route path="symbols" element={<SymbolsPage />} />
        <Route path="glossary" element={<GlossaryPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
