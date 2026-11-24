# Ohmwork

交互式电子电路学堂：每个概念配一个能拖、能调、会动的小实验。从电压电流讲到传感器、射频和 PCB 设计，零基础可以按顺序学，有经验的人可以按章节回来温习。

## 运行

```bash
npm install
npm run dev        # http://localhost:5273
```

```bash
npm run build      # 类型检查 + 打包到 dist/
npm test           # 课程冒烟测试 + 设计守卫
```

版面检查（文字重叠、出界、横向溢出）在浏览器里跑：开着开发服务器，在控制台执行
`(await import("/scripts/audit-layout.js")).audit()`，桌面和手机宽度各跑一次。

## 内容

四个阶段、12 章、54 节课，目录在 `src/curriculum/curriculum.ts`：

1. **电路基础**：电的基础、基本元件、交流与信号
2. **半导体与模拟电路**：半导体器件、模拟电路、电源
3. **数字、单片机与传感器**：数字电路、单片机与通信接口、传感器
4. **无线与设计实战**：射频与无线、读懂原理图、电路与 PCB 设计

另有三个随手查的页面：工具箱（常用计算器）、符号速查、术语表。⌘K 搜索全站。学习进度存在浏览器本地。

## 结构

```
src/
  curriculum/    课程目录和学习进度
  content/       课程正文，<章>/<课>.mdx
  widgets/       各章的交互组件，<章>/<组件>.tsx
  lab/           交互工具包：Lab 外框、Plot 曲线图、Timing 时序图、Schematic 电路图与元件符号
  mdx/           课程里能直接用的组件（Note、Tip、Warn、Figure、Quiz）
  site/          站点外壳和页面（首页、章节页、课程页、工具箱、符号速查、术语表）
  components/ui/ jim-uiux 设计系统组件
  tests/         课程冒烟测试、设计守卫
docs/
  AUTHORING.md   怎么写一节课、怎么写交互组件
  DESIGN.md      设计系统的用法和例外
```

## 加一节课

1. 在 `src/curriculum/curriculum.ts` 里登记标题、摘要、难度和时长。
2. 写 `src/content/<章>/<课>.mdx`，交互组件放 `src/widgets/<章>/`。
3. 照 `docs/AUTHORING.md` 的规范写，跑 `npm test`。

技术栈：Vite、React 19、TypeScript、Tailwind CSS v4、MDX、KaTeX、jim-uiux。
