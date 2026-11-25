# 课程编写规范

一节课 = 一个 MDX 文件 + 它用到的交互组件。读者是中文读者：零基础的人要能跟上，有经验的人回来温习时要能快速扫到重点。

先读两节示范课，照着它们的结构和语气写：

- `src/content/basics/voltage-current-resistance.mdx` + `src/widgets/basics/WaterCircuitLab.tsx`
- `src/content/basics/ohms-law.mdx` + `src/widgets/basics/OhmsLawLab.tsx`

## 文件放哪

| 内容 | 位置 |
| --- | --- |
| 课程正文 | `src/content/<章 id>/<课 slug>.mdx` |
| 这一章的交互组件 | `src/widgets/<章 id>/<组件名>.tsx`，一个组件一个文件，具名导出 |
| 课程目录（标题、摘要、难度） | `src/curriculum/curriculum.ts`，标题和 slug 已定，不要改 |
| 交互工具包 | `src/lab/`，从 `@/lab` 统一导入 |

标题、难度、时长由页面从 `curriculum.ts` 读出来显示，**MDX 里不要再写一级标题和 frontmatter**。

工具包（`src/lab/`）、设计系统组件（`src/components/ui/`）、站点外壳（`src/site/`）、`curriculum.ts` 是公共文件。写课程时不要改它们；缺什么零件，先在自己章节的 `widgets` 目录里做一个。

## 一节课的结构

```mdx
import { SomethingLab } from "@/widgets/<章 id>/SomethingLab"

开头一段：这节课解决什么问题，为什么值得学。不寒暄。

## 第一个概念

正文。先给画面和直觉，再给公式。

<SomethingLab />

实验之后用两三句话点破「刚才看到了什么」。

<Quiz question="…" options={["…", "…", "…"]} answer={1} explain="…" />

## 实际电路里怎么用

真实的器件型号、典型数值、常见的坑。

## 小结

- 三到五条，每条一句话。
```

要求：

- 每节课至少 **1 个 `<Lab>` 交互组件**（核心概念必须能动手调），至少 **2 个 `<Quiz>`**，最后一节是 `## 小结`。
- 正文 700–1300 个汉字。时长对得上 `curriculum.ts` 里的 `minutes`。
- 先直觉后公式；每个公式后面跟一个带真实数字的算例。
- 有经验的读者要能只看小标题、表格、公式和小结就完成复习，所以关键结论放进表格和小结里，不要埋在长段落中间。
- 讲实际：给常见型号（如 AMS1117、S8050、MPU6050）、典型取值（上拉 4.7 kΩ、去耦 100 nF）、常见错误。
- 涉及安全的地方（市电、锂电池、大电流、电容储能）用 `<Warn>` 明说。
- 内容必须准确。拿不准的数值不要写；公式、单位、器件参数写之前自己核一遍。

### 语气和格式

- 直接、口语化、短句。不用「让我们」「首先……其次……」「值得注意的是」这类套话，不用感叹号。
- 术语第一次出现时加粗并给一句解释，之后保持同一个叫法。
- 中文和英文、数字之间加空格；物理量的数字和单位之间加空格：`4.7 kΩ`、`100 nF`、`3.3 V`；百分号和度不加：`50%`、`90°`。
- 用全角中文标点，引号用「」。
- 不用 emoji。

### MDX 里能直接用的组件

| 组件 | 用途 |
| --- | --- |
| `<Note title="…">` | 补充知识、类比、为什么是这样 |
| `<Tip title="…">` | 经验值、口算窍门、选型建议 |
| `<Warn title="…">` | 常见错误、安全问题 |
| `<Figure caption="…">` | 静态插图（里面放一个 `<Schematic>`） |
| `<Quiz question options answer explain />` | 单选题，`answer` 是正确选项的下标（从 0 起） |

公式用 KaTeX：行内 `$I = V / R$`，独立成行用 `$$ … $$`（`$$` 各占一行）。表格用 GFM 语法。

MDX 的坑：

- 正文里的 `{`、`}`、`<` 会被当成代码。要写这些字符时用行内代码或公式，或者写成 `{"<"}`。「小于 5 V」比「< 5 V」安全。
- 公式里的花括号没问题（`$V_{out}$` 可以）。
- 组件标签的开闭要各占一行，中间的 markdown 和标签之间不需要空行，但标签不要缩进。
- 表格单元格里不要用竖线。

## 交互组件怎么写

组件是普通的 React 函数组件（TypeScript），状态用 `useState`，全部零件从 `@/lab` 导入。

```tsx
import * as React from "react"
import { Battery, Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, Resistor, Schematic, SliderField, Wire, formatSI, trace } from "@/lab"

export function OhmsLawLab() {
  const [v, setV] = React.useState(6)
  const [r, setR] = React.useState(330)
  const i = v / r
  return (
    <Lab title="欧姆定律实验台" hint="拖动滑块，看电流怎么变。" onReset={() => { setV(6); setR(330) }}>
      <LabStage>{/* 图：Schematic、Plot，或两者并排 */}</LabStage>
      <LabControls>
        <SliderField label="电压 V" value={v} onChange={setV} min={0} max={12} step={0.1} unit="V" color={trace.voltage} />
        <SliderField label="电阻 R" value={r} onChange={setR} min={100} max={10000} log snap="E12" unit="Ω" />
      </LabControls>
      <LabReadouts>
        <Readout label="电流" value={formatSI(i, "A")} color={trace.current} />
      </LabReadouts>
      <LabNote>一句随状态变化的大白话。</LabNote>
    </Lab>
  )
}
```

好的交互组件：

- **一个组件讲一件事。** 两三个滑块，学习者一拖就能看到这节课的核心规律。
- **模型是真的。** 数值由公式或数值积分算出来，不是摆拍的动画。读数要和正文里的公式对得上。
- **初始值就有看头**，而且是现实里常见的取值。范围覆盖「太小、合适、太大」，让人能拖到出问题的地方。
- **用 `<LabNote>` 把当前状态说成人话**，超限时换 `tone="warn"` 或 `"bad"`（「电流 80 mA，超过 LED 的 20 mA 上限，会烧毁」）。
- 任何滑块拖到两端、任何开关拨到任何位置，都不能出现 `NaN`、`undefined`、除以零或图形飞出画面。自己把边界值代进去算一遍。

### 外框

| 零件 | 说明 |
| --- | --- |
| `<Lab title hint? onReset? actions?>` | 外框。`title` 是名词短语；`hint` 一句话告诉人拖什么、看什么；给了 `onReset` 就有「恢复初始值」按钮 |
| `<LabStage>` | 放图的区域（下沉底色）。`plain` 去掉底色 |
| `<LabControls columns={1\|2\|3}>` | 控件网格 |
| `<LabReadouts>` + `<Readout label value color? sub?>` | 一排实时读数。`value` 传格式化好的字符串 |
| `<LabNote tone="neutral\|good\|warn\|bad">` | 一句随状态变化的解释 |

`<Lab>` 的各部分之间自动有分隔线。不要在里面再套带边框的卡片。

### 控件

| 零件 | 说明 |
| --- | --- |
| `<SliderField label value onChange min max step? unit? log? snap? color? format?>` | 主力控件。`log` 用于跨数量级的量（电阻、频率、电容）；`snap="E12"` 吸附到标准阻值；`unit` 是 V、A、Ω、F、H、W、Hz、s 时自动加 SI 前缀；`format` 自定义显示 |
| `<SwitchField label checked onChange hint?>` | 开关 |
| `<ControlField label>` 里放 `<Segmented value onValueChange options={[{value, label}]} />` | 2–4 个互斥模式（半波 / 全波 / 桥式） |
| `<ControlField label>` 里放 `<Select options value onValueChange />` | 5–8 个选项 |
| `<ControlField label>` 里放 `<Button onClick>` | 触发一次动作（「按下按键」「发送一帧」）。按钮文字是动词加对象 |
| `<ControlField label>` 里放 `<Input value onChange aria-label>` | 输入一小段文字（要发送的字符、十六进制字节）。要校验输入，非法时给出默认值，不能让模型算出 `NaN` |
| `<PlayButton playback={playback} />` | 放进 `<Lab actions>`，配合 `usePlayback()` |

### 画图：`<Plot>`

```tsx
<Plot
  height={220}
  x={{ min: 10, max: 1e6, log: true, label: "频率 (Hz)" }}
  y={{ min: -60, max: 5, label: "增益 (dB)" }}
  series={[
    { fn: (f) => gainDb(f), label: "输出", color: trace.voltage },
    { points: samples, label: "输入", color: trace.ref, dashed: true },
  ]}
  markers={[{ x: fc, y: -3, label: "−3 dB", color: trace.voltage }]}
  lines={[{ x: fc, label: "截止频率" }, { y: 0 }]}
/>
```

- 一条曲线用 `fn`（自动采样）或 `points`（`[x, y][]`，x 递增）给出；`step: true` 画成阶梯（数字信号）；`area: true` 填充到 0。
- 每条曲线都要有 `label`（图例），颜色不能是唯一的区分方式。
- 坐标轴标题写成「量 (单位)」。范围自己定死，不要随数据自动缩放——轴不动，曲线变化才看得出来。
- 宽度自动撑满容器，鼠标悬停会显示各曲线的值。
- 时域波形：把时间窗口内的数据算成 `points` 传进去；要动起来就用 `useTime()` 让窗口随时间移动。

### 画时序图：`<Timing>`

数字信号（串口帧、I²C、SPI、时钟和触发器）用它，不要用 `<Plot>` 硬拼。时间轴切成等宽的「格」，每路信号给出每一格的电平。

```tsx
<Timing
  signals={[
    { label: "SCL", values: [1, 1, 0, 1, 0, 1, 0, 1] },
    { label: "SDA", values: [1, 0, 0, 1, 1, 0, 0, "z"], color: trace.second },
  ]}
  spans={[{ from: 0, to: 2, label: "起始" }, { from: 2, to: 4, label: "A6", highlight: true }]}
  marks={[{ at: 3.5, label: "采样" }]}
  cursor={t * 4}
/>
```

- 电平：`0`、`1`、`"z"`（释放 / 高阻，画虚线）、`"x"`（不确定）。所有信号的 `values` 长度相同。
- `spans` 在上方给一段格子起名字（起始位、D0、ACK），`highlight` 给这一段上底色。名字要短。
- `marks` 是竖虚线（采样点、时钟沿），位置可以是小数（`2.5` 是第 2 格正中）。
- `cursor` 是「现在」的位置：之前的部分实线，之后的变淡。配合 `useTime()` 就是一帧数据逐位发出去的动画。
- 需要更细的时间分辨率（时钟半周期）就把一位拆成两格。格子太多会自动横向滚动。

### 画电路：`<Schematic>`

坐标系：1 单位 = 1 px，原点在左上，按 20 的网格摆放。宽度尽量不超过 340（手机一屏放得下），最大 520。

两端元件长 60。`rot={0}` 时端子 A 在 `(x−30, y)`、B 在 `(x+30, y)`；`rot={90}` 顺时针转，A 在 `(x, y−30)`、B 在 `(x, y+30)`。有极性的元件，正极 / 阳极在 A。

```tsx
<Schematic width={250} height={180} label="电池接电阻的回路">
  <Wire points={[[40, 60], [40, 30], [210, 30], [210, 60]]} current={i} scale={0.05} />
  <Wire points={[[210, 120], [210, 150], [40, 150], [40, 120]]} current={i} scale={0.05} />
  <Battery x={40} y={90} rot={90} label="电池" value="6 V" />
  <Resistor x={210} y={90} rot={90} label="R1" value="330 Ω" labelSide="left" />
</Schematic>
```

| 零件 | 说明 |
| --- | --- |
| `Resistor`（`variant="iec"`、`variable`）、`Potentiometer`、`Capacitor`（`polarized`）、`Inductor`（`core`）、`Crystal`、`Fuse` | 无源元件 |
| `Battery`、`Source kind="dc\|ac\|current"` | 电源 |
| `Diode variant="diode\|zener\|schottky\|photo"`、`Led color brightness={0–1}`、`Lamp brightness` | 二极管和会亮的东西 |
| `Bjt type="npn\|pnp"`、`Mosfet type="n\|p"` | 基极 / 栅极在 `(x−30, y)`，集电极 / 漏极在 `(x+14, y−30)`，发射极 / 源极在 `(x+14, y+30)`；`flip` 上下对调 |
| `OpAmp` | 上输入 `(x−40, y−14)`、下输入 `(x−40, y+14)`、输出 `(x+44, y)`；默认反相端（−）在上，`plusOnTop` 对调 |
| `Gate type="and\|or\|not\|nand\|nor\|xor\|xnor\|buf" a b out` | 输入 `(x−30, y∓8)`（单输入在 `(x−30, y)`），输出 `(x+30, y)`；`a / b / out` 为真时该引线高亮 |
| `Switch closed onClick?`、`Meter letter="V"` | 开关、表头、电机（`letter="M"`） |
| `Chip` + `chipPins(spec)` | 芯片方框；`chipPins` 返回每个引脚末端的坐标，用来接线 |
| `Ground x y`、`Rail x y label`、`Junction x y`、`Port x y label side`、`Antenna x y` | 地（从 `(x, y)` 向下挂）、电源轨（在 `(x, y)` 上方）、连接点、端口、天线 |
| `Wire points current? scale? color? dashed?` | 导线。给了 `current`（安培，沿点的顺序为正）就有蓝点流动；`scale` 取这个组件里会出现的较大电流 |
| `Label x y anchor? color? muted?`、`Arrow from to label?` | 文字标注和箭头 |

所有元件都有 `label`（位号 / 名称）、`value`（数值）、`labelSide`、`color`、`dim`（未导通的支路变淡）。

摆放时自己核对坐标：导线的端点必须正好落在元件的端子上，文字不要压住导线或别的文字。画之前先在纸上（或注释里）列出每个元件的中心和端子坐标。

工具包里没有的图形，直接在 `<Schematic>` 里写 SVG（`<path>`、`<circle>`、`<rect>`），默认就是前景色描边、无填充。

### 动画

- `const t = useTime(running)`：秒表，只在组件出现在屏幕上时走。配合 `const playback = usePlayback()` 和 `<PlayButton>` 让人能暂停（系统开了「减少动态效果」时默认暂停）。
- `useFrame((dt) => …, active)`：需要逐帧推进状态的仿真用它。
- 先用 `React.useMemo` 把整段波形算出来再画，比逐帧积分更稳。
- 动画只用来表现物理过程（电流、波形、充放电），不做装饰。

### 数值工具

`formatSI(0.0047, "A")` → `4.7 mA`；`sig(x, 3)`、`fixed(x, 2)`、`percent(0.25)`；`clamp`、`lerp`、`linspace`、`logspace`、`parallel(r1, r2)`、`dbV(ratio)`、`dbP(ratio)`、`nearestE(value, "E12")`、`rk4(f, t, y, h)`、`diodeCurrent(v)`、`solveDiodeLoop(vs, r)`、`TAU`。

### 公式：`<Tex>`

组件里的公式和正文一样用 KaTeX 排，不写成「I = V ÷ R」这样的纯文本：

```tsx
<LabNote>
  <Tex>{`I = \\frac{V}{R} = \\frac{${tex.si(v, "V")}}{${tex.si(r, "Ω")}} = ${tex.si(i, "A")}`}</Tex>
</LabNote>
<Readout label={<>电流 <Tex>{"I = V/R"}</Tex></>} value={formatSI(i, "A")} />
```

- `tex.si(value, unit)` 把实时数值变成公式里的「4.17 mA」，μ、Ω、° 都处理好了。
- `LabNote` 里用 `\frac`；`Readout` 的标签和小字地方小，用斜杠 `V/R`。
- 中文留在公式外面。只有文字没有符号的（「续航 = 容量 ÷ 电流」）照写纯文本。
- SVG 里（`Plot`、`Schematic` 的标签）不能用，KaTeX 是 HTML。
- 课程冒烟测试会检查每节课没有 `.katex-error`。

### 颜色

颜色有固定含义，全站一致：

| 含义 | 取值 |
| --- | --- |
| 电压、高电平 | `trace.voltage`（橙） |
| 电流 | `trace.current`（蓝） |
| 功率、发热、损耗 | `trace.power`（红） |
| 第二、三、四路信号 | `trace.second`、`trace.third`、`trace.fourth` |
| 在允许范围内、目标值 | `trace.good`（绿） |
| 参考线、理想曲线 | `trace.ref`（灰） |
| LED 发光色 | `<Led color="red\|green\|blue\|amber\|orange\|white">` |

需要别的数据颜色时用 `catVar("teal")`（`@/lib/categorical`，九种：gray red orange amber green teal blue purple pink）。

## 课前动画讲解

课文开头可以放一段一分钟左右的配音动画，把这节课的要点先讲一遍。它是网页动画，不是视频文件：画面实时绘制，跟着声音走；声音只在点播放时才下载（一分钟约 470 KB）。示例是 `src/films/basics/ohms-law/`。

一段动画是一个目录 `src/films/<章 id>/<课 slug>/`，放进去课程页就会自动显示：

| 文件 | 谁写 | 内容 |
| --- | --- | --- |
| `film.json` | 人 | 配音的嗓音和语速、每句旁白、句子里要对齐画面的词（beats）、音效 |
| `audio.mp3`、`timing.json` | 脚本生成 | 配音加音效；每句、每个 beat、每条字幕的时间 |
| `Film.tsx` | 人 | 画面：`Stage` 组件，按时间 `t` 画出这一刻 |

改了 `film.json` 就重新生成（已生成过的句子有缓存，不重复计费）：

```bash
set -a; source ~/.config/letpot-film/minimax.env; set +a
python3 scripts/films/build.py src/films/basics/ohms-law
```

- 旁白用口语写。数字写成要念的汉字（「五伏」「一八二七年」），屏幕上要显示成 5 V、1827 年的句子另写 `caption`。
- `beats` 用句子里的词给画面定时：`"lawR": "电阻"` 就是念到「电阻」的那一刻（同一个词出现两次，按顺序往后找）。画面里写 `b.lawR`，音效也挂在 `"at": "lawR"` 上，改了旁白两边一起跟着动。
- 画面只能是 `t` 的函数，不用 state、不用定时器，这样拖进度条、暂停、重播都对。工具在 `src/films/kit.tsx`：`enter` / `span` / `glide` 管时间，`T` 放文字，`Svg` + `Draw` 画线，`V` / `M` / `Frac` 拼公式（和课文的 KaTeX 用同一套字体）。坐标是舞台宽度的百分比（100 × 56.25）。
- 颜色和课文一致：电压橙、电流蓝。一屏只讲一件事，旧的退场再上新的。
- 音效从 `scripts/films/sfx.py` 里选（`glass` 落定、`knock` 出现、`air` 转场、`thump` 开场），比 beats 少，轻放在人声下面。
- 电路符号用课程里的 `src/lab/schematic.tsx`（`Resistor`、`Battery`、`Led`……），套在 `<Sym x y scale>` 里放到舞台上，线宽自动和舞台一致；符号不带 `label` / `value`，文字用 `<T>` 另放。
- `src/tests/films.test.tsx` 会检查 `timing.json` 是否已按最新的 `film.json` 生成、每一帧有没有 `NaN`、画面有没有用到没定义的 beat。

### 看画面

开着 `npm run dev`，把一段动画的画面拍成一张联系表（每 2 秒一帧），并检查文字有没有出舞台、有没有压在别的文字上：

```bash
node scripts/films/frames.mjs basics/ohms-law                 # .cache/films/frames/basics-ohms-law.png
node scripts/films/frames.mjs basics/ohms-law --t 21,22.5 --w 960 --cols 2   # 放大看几帧
node scripts/films/frames.mjs basics/ohms-law --dark
```

逐帧看一遍，过关的标准：

- 旁白在讲的时候，画面不能空着超过 1.5 秒：讲到什么，画面上就要有它。
- 每一帧和下面那行字幕说的是同一件事；画面跟着词出现，不提前也不落后。
- 文字不压文字、不压线，不出舞台；底部留 3 个单位的边。
- 一屏一个重点，元素不超过 6～8 个；舞台左右都用上，不挤在中间一小块。
- 浅色和深色都看一遍（`--dark`）。

## 设计守则（有自动检查）

本站用 jim-uiux 设计系统，见 `docs/DESIGN.md`。写组件时：

- 不写色值：不用 hex、`rgb()`、`bg-white`、`text-gray-500` 这类。只用语义类名（`text-foreground`、`text-muted-foreground`、`text-faint-foreground`、`bg-background`、`bg-sunken`、`bg-muted`、`border`）和上面的颜色变量。
- 字号只用 `text-caption`（12）、`text-small`（13）、`text-body`（14）、`text-heading`（16）。不写 `text-[11px]`、`text-xs`。SVG 里的文字用 `<Label>`（最小 12）。
- 字重只用 400、500、600（`font-medium`、`font-semibold`）。
- 不用阴影，不在 `<Lab>` 里套卡片，不用 emoji（图标用 `lucide-react`）。
- 组件内部要并排布局时，用容器查询而不是窗口断点：`@xl:grid-cols-2`、`@md:flex-row`（`<Lab>` 本身是容器）。手机上（约 310 px 宽）必须自动堆叠成一列。
- 数字加 `tabular` 类。

## 提交前检查

```bash
npx tsc --noEmit
npx vitest run src/tests/lessons.test.tsx -t "<章 id>/"
npx vitest run src/tests/design
```

第二条会渲染这一章的每节课，把每个滑块拖到两端、每个开关和按钮点一遍，检查有没有报错和 `NaN`。三条都要通过。
