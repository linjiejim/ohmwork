import * as React from "react"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Scene, Svg, T, V, enter, glide, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, FG, GOOD, MUTED, POWER, Pill, VOLT, riseAt } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * 读懂数据手册, ~69 s. Scenes, each keyed to its line:
 *   title → the fixed structure of a datasheet → absolute maximum vs recommended range (a voltage bar)
 *   → min / typ / max row → 3.3 V + 1.3 V = 4.6 V → test conditions → junction temperature → derating curve → "try the lab".
 */
function Stage({ t, b, still }: StageProps) {
  const title = span(t, 0.25, b.struct - 0.45)
  const struct = span(t, b.struct - 0.25, b.abs - 0.45)
  const limits = span(t, b.abs - 0.25, b.mtm - 0.45)
  const mtm = span(t, b.mtm - 0.25, b.calc - 0.45)
  // the typical-value aside comes right after "四点六伏": keep the scene up through the gap so it can be read
  const calc = span(t, b.calc - 0.25, b.cond - 0.2)
  const cond = span(t, b.cond - 0.25, b.tj - 0.45)
  const tj = span(t, b.tj - 0.25, b.derate - 0.45)
  const derate = span(t, b.derate - 0.25, b.outro - 0.45)
  const outro = enter(t, b.outro - 0.1, 0.5)
  const rise = (at: number, d = 1.6) => riseAt(t, at, still, d)

  return (
    <>
      <Scene o={title}>
        <T x={50} y={19} size={8} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          读懂数据手册
        </T>
        <T x={50} y={28.5} size={2.8} color={MUTED} o={enter(t, b.intro + 1.0)}>
          知道去哪一节找什么
        </T>
        <Pill x={26} y={38} o={enter(t, b.intro + 1.3)}>
          极限参数
        </Pill>
        <Pill x={50} y={38} o={enter(t, b.intro + 1.6)}>
          典型值
        </Pill>
        <Pill x={74} y={38} o={enter(t, b.intro + 1.9)}>
          曲线
        </Pill>
      </Scene>

      <Scene o={struct}>
        <Struct t={t} b={b} still={still} />
      </Scene>
      <Scene o={limits}>
        <Limits t={t} b={b} still={still} />
      </Scene>
      <Scene o={mtm}>
        <MinTypMax t={t} b={b} still={still} />
      </Scene>
      <Scene o={calc}>
        <Calc t={t} b={b} still={still} />
      </Scene>
      <Scene o={cond}>
        <Cond t={t} b={b} still={still} />
      </Scene>
      <Scene o={tj}>
        <Junction t={t} b={b} still={still} />
      </Scene>
      <Scene o={derate}>
        <Derate t={t} b={b} still={still} />
      </Scene>

      <Scene o={outro}>
        <T x={50} y={15} size={6} weight={600} dy={rise(b.outro)}>
          动手查一查
        </T>
        <T x={50} y={23} size={2.8} color={MUTED} o={enter(t, b.lab)} dy={rise(b.lab, 1)}>
          输入降到 4.5 V，再切到「典型值」
        </T>
        <Pill x={36} y={34} o={enter(t, b.outro + 0.4)} color={POWER}>
          最大值：不够用
        </Pill>
        <Pill x={64} y={34} o={enter(t, b.typ2 - 0.3)} color={GOOD}>
          典型值：显示够用
        </Pill>
        <Svg>
          <g opacity={enter(t, b.typ2)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
            <path d="M50 42 V49 M47.6 46.6 L50 49 L52.4 46.6" />
          </g>
        </Svg>
      </Scene>
    </>
  )
}

const Sub = ({ children }: { children: React.ReactNode }) => <span style={{ fontSize: "0.62em", verticalAlign: "-0.25em", fontStyle: "normal" }}>{children}</span>

// ── structure ────────────────────────────────────────────────────────────────

function Struct({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.0) => riseAt(t, at, still, d)
  const rows = [
    { at: b.home, name: "首页", note: "能不能用，最简单怎么接" },
    { at: b.pins, name: "引脚定义", note: "每个脚叫什么" },
    { at: b.absW, name: "极限参数", note: "绝对不能碰的线" },
    { at: b.elec, name: "电气特性", note: "最小、典型、最大" },
    { at: b.curve, name: "曲线", note: "随温度、电压怎么变" },
    { at: b.pkg, name: "封装尺寸", note: "画封装用" },
  ]
  const page = enter(t, b.struct, 0.6)
  const active = (i: number) => enter(t, rows[i].at, 0.3) * (i < rows.length - 1 ? 1 - enter(t, rows[i + 1].at, 0.3) : 1)
  return (
    <>
      <Svg>
        <g opacity={page}>
          <rect x={10} y={8} width={24} height={40} rx={1.2} stroke={MUTED} />
        </g>
        {rows.map((r, i) => {
          const y = 11 + i * 6.2
          const a = active(i)
          const seen = enter(t, r.at, 0.3)
          return (
            <g key={r.name}>
              <rect x={13} y={y} width={18} height={4.4} rx={0.6} fill={AMP} fillOpacity={0.12 * seen + 0.25 * a} stroke={a > 0.3 ? AMP : MUTED} strokeWidth={0.2} opacity={page} />
            </g>
          )
        })}
      </Svg>
      {rows.map((r, i) => {
        const y = 13.2 + i * 6.2
        const o = enter(t, r.at, 0.4)
        return (
          <React.Fragment key={r.name}>
            <T x={42} y={y + 3.2} size={3.6} weight={600} anchor="start" o={o} dy={rise(r.at)} color={i === 2 ? POWER : undefined}>
              {r.name}
            </T>
            <T x={66} y={y + 3.2} size={2.5} anchor="start" color={MUTED} o={o}>
              {r.note}
            </T>
          </React.Fragment>
        )
      })}
    </>
  )
}

// ── limits vs recommended ────────────────────────────────────────────────────

const vx = (v: number) => 10 + (v * 80) / 18

function Limits({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.0) => riseAt(t, at, still, d)
  const bar = enter(t, b.abs, 0.6)
  const red = enter(t, b.line - 0.1, 0.5)
  const note = enter(t, b.notwork - 0.2, 0.5)
  const green = enter(t, b.recW, 0.7)
  const twelve = enter(t, b.twelve - 0.1, 0.4)
  const gray = enter(t, b.twelve + 0.3, 0.5)
  const y = 30
  return (
    <>
      <T x={50} y={11} size={2.6} color={MUTED} o={bar}>
        一颗 LDO 的输入电压
      </T>
      <Svg>
        <rect x={vx(0)} y={y - 1.6} width={vx(18) - vx(0)} height={3.2} rx={0.5} stroke={MUTED} opacity={bar} />
        <rect x={vx(15)} y={y - 1.6} width={vx(18) - vx(15)} height={3.2} fill={POWER} fillOpacity={0.35} stroke="none" opacity={red} />
        <rect x={vx(0)} y={y - 1.6} width={(vx(12) - vx(0)) * green} height={3.2} fill={GOOD} fillOpacity={0.35} stroke="none" />
        <rect x={vx(12)} y={y - 1.6} width={vx(15) - vx(12)} height={3.2} fill={VOLT} fillOpacity={0.22} stroke="none" opacity={gray} />
        <path d={`M${vx(15)} ${y - 5} V${y + 3.5}`} stroke={POWER} strokeWidth={0.5} opacity={red} />
        <path d={`M${vx(12)} ${y - 5} V${y + 3.5}`} stroke={GOOD} strokeWidth={0.5} opacity={twelve} />
      </Svg>
      <T x={vx(15) + 0.5} y={y - 8} size={3} weight={600} color={POWER} anchor="start" o={red} dy={rise(b.line)} className="tabular">
        15 V
      </T>
      <T x={vx(15) + 0.5} y={y - 12.4} size={2.4} color={POWER} anchor="start" o={red}>
        极限参数
      </T>
      <T x={vx(12) - 0.5} y={y - 8} size={3} weight={600} color={GOOD} anchor="end" o={twelve} dy={rise(b.twelve)} className="tabular">
        12 V
      </T>
      <T x={vx(12) - 0.5} y={y - 12.4} size={2.4} color={GOOD} anchor="end" o={enter(t, b.recW, 0.4)}>
        推荐工作条件
      </T>
      <T x={vx(0) + 1} y={y + 8} size={2.6} anchor="start" color={GOOD} weight={600} o={green}>
        各项指标有保证
      </T>
      <T x={(vx(12) + vx(15)) / 2} y={y + 8} size={2.4} color={VOLT} o={gray}>
        不保证
      </T>
      <T x={(vx(15) + vx(18)) / 2 + 0.5} y={y + 8} size={2.4} color={POWER} o={red}>
        可能损坏
      </T>
      <T x={50} y={44} size={3.2} weight={600} color={POWER} o={note} dy={rise(b.notwork - 0.2)}>
        极限参数：不是能长期工作的线
      </T>
    </>
  )
}

// ── min / typ / max ──────────────────────────────────────────────────────────

function MinTypMax({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.0) => riseAt(t, at, still, d)
  const tbl = enter(t, b.mtm, 0.6)
  const cols = [
    { x: 52, at: b.min, head: "最小", val: "—" },
    { x: 68, at: b.typ, head: "典型", val: "1.1 V" },
    { x: 84, at: b.max, head: "最大", val: "1.3 V" },
  ]
  const hot = enter(t, b.worst - 0.2, 0.5)
  return (
    <>
      <T x={50} y={9} size={2.6} color={MUTED} o={tbl}>
        电气特性表的一行
      </T>
      <Svg>
        <g stroke="var(--border)" strokeWidth={0.15} opacity={tbl}>
          <path d="M10 21 H94 M10 31 H94" />
        </g>
        <rect x={76} y={15} width={16} height={22} rx={1.2} stroke={GOOD} strokeWidth={0.4} opacity={hot} />
      </Svg>
      <T x={12} y={18} size={2.4} color={MUTED} anchor="start" o={tbl}>
        参数
      </T>
      <T x={12} y={26} size={3.4} weight={600} anchor="start" o={tbl}>
        压差
      </T>
      {cols.map((c) => (
        <React.Fragment key={c.head}>
          <T x={c.x} y={18} size={2.6} color={MUTED} o={enter(t, c.at, 0.4)}>
            {c.head}
          </T>
          <T x={c.x} y={26} size={4} weight={600} o={enter(t, c.at + 0.1, 0.4)} dy={rise(c.at)} className="tabular" color={c.head === "最大" && hot > 0.3 ? GOOD : undefined}>
            {c.val}
          </T>
        </React.Fragment>
      ))}
      <T x={60} y={37} size={2.4} color={MUTED} o={enter(t, b.typ + 0.4)}>
        常温下多数芯片，不保证
      </T>
      <T x={84} y={41} size={2.4} color={GOOD} o={enter(t, b.max + 0.4)}>
        厂家保证的边界
      </T>
      <T x={50} y={49} size={3.4} weight={600} o={enter(t, b.worst)} dy={rise(b.worst)} color={GOOD}>
        设计按最坏情况：取对你不利的一头
      </T>
    </>
  )
}

// ── 3.3 V + 1.3 V ────────────────────────────────────────────────────────────

const sx = (v: number) => 10 + v * (80 / 6)

function Calc({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.0) => riseAt(t, at, still, d)
  const out = enter(t, b.out, 0.6)
  const drop = enter(t, b.drop, 0.6)
  const need = enter(t, b.need - 0.1, 0.4)
  const y = 28
  return (
    <>
      <T x={50} y={11} size={2.6} color={MUTED} o={enter(t, b.calc + 0.1)}>
        输入至少要多少伏
      </T>
      <Svg>
        <rect x={sx(0)} y={y - 3} width={(sx(3.3) - sx(0)) * out} height={6} rx={0.6} fill={VOLT} fillOpacity={0.28} stroke={VOLT} strokeWidth={0.3} />
        <rect x={sx(3.3)} y={y - 3} width={(sx(4.6) - sx(3.3)) * drop} height={6} rx={0.6} fill={POWER} fillOpacity={0.28} stroke={POWER} strokeWidth={0.3} />
        <path d={`M${sx(4.6)} ${y - 7} V${y + 5}`} stroke={GOOD} strokeWidth={0.5} opacity={need} />
        <path d={`M${sx(4.4)} ${y - 4} V${y + 7}`} stroke={MUTED} strokeWidth={0.3} strokeDasharray="0.9 0.8" opacity={enter(t, b.need + 0.3, 0.4)} />
      </Svg>
      <T x={(sx(0) + sx(3.3)) / 2} y={y} size={3} weight={600} color={VOLT} o={out} className="tabular">
        输出 3.3 V
      </T>
      <T x={(sx(3.3) + sx(4.6)) / 2} y={y - 6.8} size={2.6} weight={600} color={POWER} o={drop} className="tabular" dy={rise(b.drop, 0.6)}>
        压差 1.3 V
      </T>
      <T x={sx(4.6) + 1} y={y - 11} size={4.2} weight={600} color={GOOD} anchor="start" o={need} dy={rise(b.need)} className="tabular">
        4.6 V
      </T>
      <T x={sx(4.6) + 1} y={y - 6.8} size={2.4} color={GOOD} anchor="start" o={need}>
        输入至少
      </T>
      <T x={sx(4.4) - 1} y={y + 10} size={2.4} color={MUTED} anchor="end" o={enter(t, b.need + 0.3, 0.4)} className="tabular">
        典型值算出 4.4 V
      </T>
      <T x={50} y={46} size={2.6} color={MUTED} o={enter(t, b.need + 0.6)} dy={rise(b.need + 0.6, 0.8)}>
        只保证一部分芯片能用
      </T>
    </>
  )
}

// ── test conditions ──────────────────────────────────────────────────────────

function Cond({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.0) => riseAt(t, at, still, d)
  // after the previous scene has gone (it stays up through the gap)
  const row = enter(t, b.cond + 0.2, 0.5)
  const vary = enter(t, b.vary - 0.2, 0.5)
  const barA = enter(t, b.vary, 0.7)
  const barB = enter(t, b.vary + 0.7, 0.9)
  return (
    <>
      <T x={50} y={9} size={2.6} color={MUTED} o={row}>
        MOSFET 手册里的一行
      </T>
      <T x={12} y={22} size={3.4} weight={600} anchor="start" o={row} dy={rise(b.cond + 0.2, 0.8)}>
        导通电阻 <V>R</V>
        <span style={{ fontSize: "0.6em", verticalAlign: "-0.25em" }}>DS(on)</span>
      </T>
      <T x={56} y={15.5} size={2.4} color={MUTED} anchor="start" o={row}>
        测试条件
      </T>
      <Pill x={66} y={21} o={enter(t, b.condW, 0.4)}>
        结温 25 °C
      </Pill>
      <Pill x={66} y={28} o={enter(t, b.condW + 0.4, 0.4)}>
        VGS = 10 V
      </Pill>
      <Pill x={66} y={35} o={enter(t, b.condW + 0.8, 0.4)}>
        标准测试板
      </Pill>
      <Svg>
        <rect x={36} y={41.2} width={6 * barA} height={3} rx={0.4} fill={GOOD} fillOpacity={0.4} stroke={GOOD} strokeWidth={0.25} />
        <rect x={36} y={46.8} width={40 * barB} height={3} rx={0.4} fill={POWER} fillOpacity={0.35} stroke={POWER} strokeWidth={0.25} />
      </Svg>
      <T x={12} y={42.7} size={2.6} anchor="start" o={vary} className="tabular">
        10 V 驱动
      </T>
      <T x={12} y={48.3} size={2.6} anchor="start" o={vary} className="tabular">
        3.3 V 驱动
      </T>
      <T x={44} y={42.7} size={2.4} color={GOOD} weight={600} anchor="start" o={barA}>
        小
      </T>
      <T x={78} y={48.3} size={2.4} color={POWER} weight={600} anchor="start" o={barB}>
        大不少
      </T>
    </>
  )
}

// ── junction temperature ─────────────────────────────────────────────────────

const tx = (c: number) => 10 + ((c - 20) * 80) / 110

function Junction({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.0) => riseAt(t, at, still, d)
  const frame = enter(t, b.formula + 1.0, 0.6)
  const num = enter(t, b.formula + 2.2, 0.5)
  const res = enter(t, b.res - 0.2, 0.6)
  const left = enter(t, b.left - 0.2, 0.5)
  const y = 40
  return (
    <>
      <T x={50} y={11} size={3.8} weight={600} o={enter(t, b.tj + 0.1)} dy={rise(b.tj + 0.1)}>
        <span style={{ color: POWER }}>结温</span> = 环境温度 + 发热 × 热阻
      </T>
      <T x={50} y={21} size={3.2} color={MUTED} o={num} dy={rise(b.formula + 2.2, 0.8)} className="tabular">
        <V>T</V>
        <Sub>J</Sub> = 40 + 0.9 × 90
      </T>
      <Svg>
        <rect x={tx(20)} y={y - 2.2} width={tx(130) - tx(20)} height={4.4} rx={0.6} stroke={MUTED} opacity={frame} />
        <rect x={tx(20)} y={y - 2.2} width={(tx(121) - tx(20)) * res} height={4.4} rx={0.6} fill={POWER} fillOpacity={0.3} stroke="none" />
        <path d={`M${tx(125)} ${y - 5.5} V${y + 5}`} stroke={FG} strokeWidth={0.45} opacity={frame} />
        <path d={`M${tx(121)} ${y + 2.6} V${y + 5.5}`} stroke={POWER} strokeWidth={0.45} opacity={res} />
        <path d={`M${tx(121)} ${y + 8} H${tx(125)} M${tx(121)} ${y + 7} V${y + 9} M${tx(125)} ${y + 7} V${y + 9}`} stroke={POWER} strokeWidth={0.35} opacity={left} />
      </Svg>
      <T x={tx(20)} y={y + 5.5} size={2.2} color={MUTED} anchor="start" o={frame} className="tabular">
        20 °C
      </T>
      <T x={tx(125)} y={y - 9} size={2.6} weight={600} o={frame} anchor="middle" className="tabular">
        上限 125 °C
      </T>
      <T x={66} y={y + 12.5} size={4} weight={600} color={POWER} anchor="middle" o={res} dy={rise(b.res)} className="tabular">
        121 °C
      </T>
      <T x={77} y={y + 12.5} size={3} weight={600} color={POWER} anchor="start" o={left} className="tabular">
        只剩 4 °C
      </T>
    </>
  )
}

// ── derating ─────────────────────────────────────────────────────────────────

const dx = (c: number) => 14 + (c - 25) * 0.72
const dy = (p: number) => 46 - p * 28

function Derate({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.0) => riseAt(t, at, still, d)
  const axes = enter(t, b.derate, 0.6)
  const line = enter(t, b.hot, 1.4)
  const pt = enter(t, b.margin - 3.2, 0.4)
  const safe = enter(t, b.margin - 1.0, 0.5)
  void glide
  return (
    <>
      <Svg>
        <g opacity={axes} stroke={MUTED} strokeWidth={0.25}>
          <path d={`M14 ${dy(1.25)} V46 H90`} />
        </g>
        <Draw d={`M${dx(25)} ${dy(1.11)} L${dx(125)} ${dy(0)}`} p={line} stroke={POWER} strokeWidth={0.5} />
        <circle cx={dx(40)} cy={dy(0.9)} r={1} fill={VOLT} stroke="none" opacity={pt} />
        <circle cx={dx(40)} cy={dy(0.6)} r={1} fill={GOOD} stroke="none" opacity={safe} />
        <path d={`M${dx(40)} ${dy(0.9) + 1.8} V${dy(0.6) - 1.8} M${dx(40) - 0.8} ${dy(0.6) - 2.8} L${dx(40)} ${dy(0.6) - 1.8} L${dx(40) + 0.8} ${dy(0.6) - 2.8}`} stroke={GOOD} strokeWidth={0.3} opacity={safe} />
      </Svg>
      <T x={16} y={9} size={2.4} color={MUTED} anchor="start" o={axes}>
        允许的发热
      </T>
      <T x={13} y={dy(1.11)} size={2.2} color={MUTED} anchor="end" o={axes} className="tabular">
        1.1 W
      </T>
      <T x={52} y={50.5} size={2.4} color={MUTED} o={axes}>
        环境温度
      </T>
      <T x={dx(25)} y={49.5} size={2.2} color={MUTED} o={axes} className="tabular">
        25 °C
      </T>
      <T x={dx(125)} y={49.5} size={2.2} color={MUTED} o={axes} className="tabular">
        125 °C
      </T>
      <T x={dx(40) + 3} y={dy(0.9) - 3.2} size={2.4} color={VOLT} weight={600} anchor="start" o={pt} dy={rise(b.margin - 3.2, 0.6)}>
        额定用到顶
      </T>
      <T x={dx(40) + 3} y={dy(0.6) + 4.5} size={2.8} color={GOOD} weight={600} anchor="start" o={safe} dy={rise(b.margin - 1.0, 0.6)}>
        降额：留出余量
      </T>
      <T x={72} y={22} size={3} weight={600} color={POWER} o={line} dy={rise(b.hot, 0.8)}>
        越热，能散的越少
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "读懂数据手册",
  audio,
  timing,
  poster: 3.6,
  Stage,
}

export default function DatasheetsFilm() {
  return <FilmPlayer film={film} />
}
