# Ohmwork

交互式电子电路学堂：每个概念配一个能拖、能调、会动的小实验。从电压电流讲到传感器、射频和 PCB 设计，零基础可以按顺序学，有经验的人可以按章节回来温习。

![Ohmwork 首页：拖动电压滑块，电路里的电流数值、欧姆定律算式和伏安特性曲线同时变化](docs/images/home-desktop.png)

**在线体验：<https://ohmwork.linjiejim.com>** · [课程内容](#内容) · [自己加一节课](#加一节课)

## 为什么做这个

学电路的时候，通常只有两种材料：

- **教材**：图是静态的。「电压像水压，电流像水流」——读起来都对，但脑子里没有画面，也说不清改一个量另外两个会怎么动。
- **仿真软件**：能算得很准，但先要会搭网表、选模型、看波形，门槛落在「学电路」之前。

中间那块地方是空的：**想拨一下、马上看到反应，但不想先成为工程师。**

Ohmwork 就是填这块的。每个概念配一个能动手的模型：拖电压滑块，电流数值、欧姆定律算式和伏安曲线一起变；讲 RC 滤波给一条能改频率的曲线；讲时序给能对拍的波形图。电路图都是自己画的 SVG，公式用 KaTeX 排，不嵌图片，缩放都清楚。

## 每节课长什么样

- **能拖的仿真**：滑块、开关、波形，改一个参数全页联动，不是截图也不是嵌视频。
- **一分多钟的配音动画讲解**：每节课开头一段，配文字稿，也可以只看文字。
- **算出来的，不是编的**：数值由组件里的公式实时计算，图上标的就是算出来的值。
- **一节十分钟**：难度（入门 / 进阶）和预估时长标在目录里，按章节顺序学或跳着查都行。

手机端同样能拖：

<img src="docs/images/home-mobile.png" alt="手机上的 Ohmwork" width="320">

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

## 部署

线上地址 https://ohmwork.linjiejim.com ，托管在 GitHub Pages。推送到 `main` 后，`.github/workflows/deploy.yml` 会先跑测试、打包，再发布；拉取请求只跑检查，不发布。

- **域名**：在仓库的 Pages 设置里绑定。DNS 在腾讯云 DNSPod，记录为 `CNAME ohmwork → linjiejim.github.io.`
- **页面路由**：用的是路径式路由。打包时把 `index.html` 复制一份成 `404.html`，这样直接打开深层链接也能进站。

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

## 许可

[MIT](LICENSE)。课程文字与插图同样按 MIT 授权，欢迎转载和改写，注明来源即可。
