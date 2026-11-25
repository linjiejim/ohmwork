import * as React from "react"
import { Resistor, Led } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Scene, Svg, Sym, T, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, FG, LINE, MUTED, PAINT, POWER, VOLT } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * 电阻器, ~65 s. Scenes, each keyed to the words that introduce it:
 *   title → a resistor and four cards: 阻值 精度 功率 封装
 *   → colour bands: the digit chart, then 黄紫红 = 47 × 100 = 4.7 kΩ, then the gold band
 *   → SMD marking 472 → the E24 number line (5 kΩ is missing) → packages and ratings
 *   → the 0.25 W power bar → four uses → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  const title = span(t, 0.25, b.band - 0.15, 0.4, 0.3)
  const color = span(t, b.band - 0.3, b.smd - 0.15, 0.3, 0.3)
  const smd = span(t, b.smd - 0.3, b.std - 0.15, 0.3, 0.3)
  const std = span(t, b.std - 0.3, b.heat - 0.15, 0.3, 0.3)
  const pack = span(t, b.heat - 0.3, b.calc - 0.15, 0.3, 0.3)
  const calc = span(t, b.calc - 0.3, b.uses - 0.15, 0.3, 0.3)
  const uses = span(t, b.uses - 0.3, b.outro - 0.15, 0.3, 0.3)
  const outro = enter(t, b.outro - 0.3, 0.4)

  return (
    <>
      <Scene o={title} dy={lift(b.band - 0.45)}>
        <Title t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={color}>
        <Bands t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={smd}>
        <Smd t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={std}>
        <Series t={t} b={b} still={still} />
      </Scene>
      <Scene o={pack}>
        <Packages t={t} b={b} still={still} />
      </Scene>
      <Scene o={calc}>
        <Power t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={uses}>
        <Uses t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro - 0.3)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.pick)} dy={rise(b.pick, 1)}>
          在下面选色环，看阻值怎么变
        </T>
        <Svg>
          <g opacity={enter(t, b.pick + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
            <path d="M50 38 V45 M47.6 42.6 L50 45 L52.4 42.6" />
          </g>
        </Svg>
      </Scene>
    </>
  )
}

type Rise = (at: number, d?: number) => number

// ── the part ─────────────────────────────────────────────────────────────────

const HALF = 26
/** Band centres relative to the body centre: three value bands, then the tolerance band set apart. */
const BAND_DX = [-17, -9, -1, 17]
const BAND_PAINT = [PAINT.yellow, PAINT.violet, PAINT.red, PAINT.gold]

function ResBody({ cx, cy, o = 1, bands }: { cx: number; cy: number; o?: number; bands: number[] }) {
  return (
    <g opacity={o}>
      <path d={`M${cx - 38} ${cy} H${cx - HALF} M${cx + HALF} ${cy} H${cx + 38}`} />
      <rect x={cx - HALF} y={cy - 5.5} width={2 * HALF} height={11} rx={3} fill={PAINT.body} stroke={LINE} strokeWidth={0.25} />
      {BAND_DX.map((dx, i) => (
        <rect key={i} x={cx + dx - 1.4} y={cy - 5.5} width={2.8} height={11} fill={BAND_PAINT[i]} stroke="none" opacity={bands[i]} />
      ))}
    </g>
  )
}

// ── title ────────────────────────────────────────────────────────────────────

function Title({ t, b, rise }: { t: number; b: Record<string, number>; rise: Rise }) {
  const cards = [
    { x: 21, word: "阻值", value: "4.7 kΩ", at: b.kVal, c: FG },
    { x: 40.5, word: "精度", value: "±5%", at: b.kTol, c: FG },
    { x: 59.5, word: "功率", value: "1/4 W", at: b.kPow, c: POWER },
    { x: 79, word: "封装", value: "0603", at: b.kPkg, c: FG },
  ]
  return (
    <>
      <T x={50} y={11} size={7.6} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        电阻器
      </T>
      <Svg>
        <ResBody cx={50} cy={24} o={enter(t, 0.9, 0.7)} bands={[enter(t, b.kVal - 0.2), enter(t, b.kVal), enter(t, b.kVal + 0.2), enter(t, b.kTol)]} />
        {cards.map((c) => (
          <rect key={c.word} x={c.x - 8.5} y={33} width={17} height={10} rx={1.6} stroke={LINE} strokeWidth={0.25} opacity={enter(t, c.at - 0.1, 0.4)} />
        ))}
      </Svg>
      {cards.map((c) => (
        <React.Fragment key={c.word}>
          <T x={c.x} y={36.2} size={2.4} color={MUTED} o={enter(t, c.at - 0.1, 0.4)}>
            {c.word}
          </T>
          <T x={c.x} y={40.2} size={3.2} weight={600} color={c.c} o={enter(t, c.at + 0.1, 0.4)} className="tabular">
            {c.value}
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

// ── colour bands ─────────────────────────────────────────────────────────────

const CHART: [string, string][] = [
  [PAINT.black, "0"],
  [PAINT.brown, "1"],
  [PAINT.red, "2"],
  [PAINT.orange, "3"],
  [PAINT.yellow, "4"],
  [PAINT.green, "5"],
  [PAINT.blue, "6"],
  [PAINT.violet, "7"],
  [PAINT.grey, "8"],
  [PAINT.white, "9"],
]

function Bands({ t, b, rise }: { t: number; b: Record<string, number>; rise: Rise }) {
  const bands = [enter(t, b.band + 0.1), enter(t, b.dig - 0.1), enter(t, b.mult - 0.1), enter(t, b.gold - 0.3)]
  const chartO = Math.min(enter(t, b.dig, 0.3), 1 - easeInOut((t - (b.ex - 0.1)) / 0.35))
  const cx = 50
  const bandX = (i: number) => cx + BAND_DX[i]
  return (
    <>
      <Svg>
        <ResBody cx={cx} cy={14} bands={bands} />
        {CHART.map(([c], i) => {
          const o = chartO * enter(t, b.dig + i * 0.07, 0.3)
          return <circle key={i} cx={15 + i * 8.9} cy={39} r={2.6} fill={c} stroke={LINE} strokeWidth={0.25} opacity={o} />
        })}
      </Svg>
      {CHART.map(([, d], i) => (
        <T key={d} x={15 + i * 8.9} y={45.5} size={2.8} weight={600} color={MUTED} o={chartO * enter(t, b.dig + i * 0.07, 0.3)} className="tabular">
          {d}
        </T>
      ))}
      <T x={50} y={31} size={2.4} color={MUTED} o={chartO * enter(t, b.dig, 0.4)}>
        每种颜色，代表一个数字
      </T>

      <T x={bandX(0)} y={22.5} size={2.4} color={MUTED} o={enter(t, b.dig - 0.1)}>
        数字
      </T>
      <T x={bandX(1)} y={22.5} size={2.4} color={MUTED} o={enter(t, b.dig + 0.1)}>
        数字
      </T>
      <T x={bandX(2)} y={22.5} size={2.4} color={MUTED} o={enter(t, b.mult - 0.1)}>
        倍率
      </T>
      <T x={bandX(3)} y={22.5} size={2.4} color={MUTED} o={enter(t, b.tolw - 0.1)}>
        精度
      </T>

      {/* the reading, built one band at a time */}
      <T x={bandX(0)} y={28.5} size={4} weight={600} font="var" o={enter(t, b.yel)} dy={rise(b.yel, 1)} className="tabular">
        4
      </T>
      <T x={bandX(1)} y={28.5} size={4} weight={600} font="var" o={enter(t, b.vio)} dy={rise(b.vio, 1)} className="tabular">
        7
      </T>
      <T x={bandX(2)} y={28.5} size={4} weight={600} font="var" color={VOLT} o={enter(t, b.red)} dy={rise(b.red, 1)} className="tabular">
        ×100
      </T>
      <T x={bandX(3)} y={28.5} size={4} weight={600} font="var" color={MUTED} o={enter(t, b.pm - 0.1)} dy={rise(b.pm - 0.1, 1)} className="tabular">
        ±5%
      </T>
      <T x={50} y={43} size={6} o={enter(t, b.ex + 0.1) * (1 - 0.0)} className="tabular">
        <span className="inline-flex items-baseline gap-[0.35em]">
          <span style={{ opacity: enter(t, b.vio + 0.2) }}>47</span>
          <span style={{ opacity: enter(t, b.red + 0.2), color: VOLT }}>× 100</span>
          <span style={{ opacity: enter(t, b.res) }}>=</span>
          <span className="font-semibold" style={{ opacity: enter(t, b.res), color: AMP }}>
            4.7 kΩ
          </span>
          <span className="text-muted-foreground" style={{ opacity: enter(t, b.pm), fontSize: "0.55em" }}>
            ±5%
          </span>
        </span>
      </T>
    </>
  )
}

// ── SMD marking ──────────────────────────────────────────────────────────────

function Smd({ t, b, rise }: { t: number; b: Record<string, number>; rise: Rise }) {
  const chip = enter(t, b.smd - 0.2, 0.6)
  const digits: [number, string, number, string | undefined][] = [
    [43.2, "4", b.n472, undefined],
    [48.8, "7", b.n472, undefined],
    [54.4, "2", b.n472 + 0.35, VOLT],
  ]
  return (
    <>
      <T x={50} y={8} size={2.6} color={MUTED} o={enter(t, b.smd, 0.4)}>
        贴片电阻
      </T>
      <Svg>
        <g opacity={chip}>
          <rect x={33} y={12} width={34} height={15} rx={0.8} fill={FG} stroke="none" />
          <rect x={29.5} y={12} width={4.5} height={15} fill={MUTED} stroke="none" />
          <rect x={66} y={12} width={4.5} height={15} fill={MUTED} stroke="none" />
        </g>
        <Draw d="M41 29.5 V30.8 H51 V29.5" p={enter(t, b.n472 + 0.2, 0.4)} />
        <Draw d="M54.4 29.5 V30.8 M52.4 30.8 H56.4" p={enter(t, b.n472 + 0.5, 0.4)} stroke={VOLT} />
      </Svg>
      {digits.map(([x, d, at, c]) => (
        <T key={x} x={x} y={19.5} size={9} weight={600} color={c ?? "var(--background)"} o={enter(t, at, 0.4) * chip} className="tabular">
          {d}
        </T>
      ))}
      <T x={46} y={34} size={2.4} color={MUTED} o={enter(t, b.n472 + 0.3)}>
        有效数字
      </T>
      <T x={61} y={34} size={2.4} color={VOLT} o={enter(t, b.n472 + 0.6)}>
        后面几个零
      </T>
      <T x={50} y={43} size={6} className="tabular" dy={rise(b.n472 + 0.8)} o={enter(t, b.n472 + 0.8)}>
        <span className="inline-flex items-baseline gap-[0.12em]">
          <span>47</span>
          <span style={{ color: VOLT, opacity: enter(t, b.plus + 0.1) }}>00</span>
          <span className="px-[0.2em]" style={{ opacity: enter(t, b.plus + 0.8) }}>
            =
          </span>
          <span className="font-semibold" style={{ color: AMP, opacity: enter(t, b.plus + 0.8) }}>
            4.7 kΩ
          </span>
        </span>
      </T>
    </>
  )
}

// ── the E24 series on a log line ─────────────────────────────────────────────

const E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1, 10]
const AX = (v: number) => 10 + 80 * Math.log10(v)

function Series({ t, b, still }: StageProps) {
  const y = 29
  const draw = enter(t, b.std - 0.2, 0.5)
  const sweep = (t - (b.std + 0.1)) / 1.6
  const no5 = enter(t, b.no5 - 0.1, 0.4)
  const x5 = AX(5)
  const x47 = AX(4.7)
  const x51 = AX(5.1)
  return (
    <>
      <T x={50} y={9} size={3.4} weight={600} o={enter(t, b.std - 0.1, 0.5)}>
        E24 标准系列
      </T>
      <Svg>
        <Draw d={`M10 ${y} H90`} p={draw} />
        {E24.map((v, i) => {
          const o = Math.min(1, Math.max(0, sweep * E24.length - i + 1))
          const hl = v === 4.7 || v === 5.1
          const hlo = v === 4.7 ? enter(t, b.p47, 0.3) : v === 5.1 ? enter(t, b.p51, 0.3) : 0
          return <path key={v} d={`M${AX(v)} ${y} v${lerp(-2.4, -4.2, hl ? hlo : 0)}`} opacity={o} stroke={hl && hlo > 0.05 ? AMP : undefined} strokeWidth={hl ? lerp(0.32, 0.55, hlo) : 0.32} />
        })}
        {/* 5 kΩ: nothing there */}
        <g opacity={no5} stroke={POWER}>
          <path d={`M${x5} 25 V${y - 5}`} strokeDasharray="0.8 0.8" strokeWidth={0.25} />
          <path d={`M${x5 - 1.5} 20.5 l3 3 M${x5 + 1.5} 20.5 l-3 3`} strokeWidth={0.5} />
        </g>
        <Draw d={`M${x47 - 0.4} ${y + 1.5} L${x47 - 5.5} ${y + 6.5}`} p={enter(t, b.p47, 0.3)} stroke={AMP} strokeWidth={0.25} />
        <Draw d={`M${x51 + 0.4} ${y + 1.5} L${x51 + 5.5} ${y + 6.5}`} p={enter(t, b.p51, 0.3)} stroke={AMP} strokeWidth={0.25} />
      </Svg>
      <T x={10} y={y + 4} size={2.3} color={MUTED} o={draw} className="tabular">
        1 kΩ
      </T>
      <T x={90} y={y + 4} size={2.3} color={MUTED} o={draw} className="tabular">
        10 kΩ
      </T>
      <T x={x5} y={16.5} size={2.6} weight={600} color={POWER} o={no5} dy={still ? 0 : (1 - no5) * -1} className="tabular">
        5 kΩ
      </T>
      <T x={x47 - 6.5} y={y + 8.5} size={3.4} weight={600} anchor="end" color={AMP} o={enter(t, b.p47, 0.4)} className="tabular">
        4.7 kΩ
      </T>
      <T x={x51 + 6.5} y={y + 8.5} size={3.4} weight={600} anchor="start" color={AMP} o={enter(t, b.p51, 0.4)} className="tabular">
        5.1 kΩ
      </T>
      <T x={50} y={46} size={2.6} color={MUTED} o={enter(t, b.no5 + 0.3, 0.5)}>
        算出理想值，再选最近的标准值
      </T>
    </>
  )
}

// ── packages and ratings ─────────────────────────────────────────────────────

const PKGS = [
  { x: 17, name: "0402", w: 3, h: 1.5, p: 1 / 16, label: "1/16 W" },
  { x: 39, name: "0603", w: 4.8, h: 2.4, p: 1 / 10, label: "1/10 W" },
  { x: 61, name: "0805", w: 6, h: 3.75, p: 1 / 8, label: "1/8 W" },
  { x: 83, name: "直插", w: 18, h: 6.9, p: 1 / 4, label: "1/4 W" },
]

/** Bar height per watt: the 1/4 W bar stays clear of the 直插 label above it. */
const BAR = 58

function Packages({ t, b, still }: StageProps) {
  const at = [b.heatw - 0.2, b.heatw + 0.1, b.heatw + 0.4, b.big]
  const base = 47
  const pkgY = still ? 14 : glide(t, b.rate - 0.3, 23, 14, 0.7)
  return (
    <>
      <Svg>
        {PKGS.map((p, i) => {
          const o = enter(t, at[i], 0.5)
          const y = pkgY
          return (
            <g key={p.name} opacity={o}>
              {p.name === "直插" ? (
                <>
                  <path d={`M${p.x - p.w / 2 - 3} ${y} H${p.x - p.w / 2} M${p.x + p.w / 2} ${y} H${p.x + p.w / 2 + 3}`} />
                  <rect x={p.x - p.w / 2} y={y - p.h / 2} width={p.w} height={p.h} rx={1.6} fill={PAINT.body} stroke={LINE} strokeWidth={0.25} />
                  <rect x={p.x - 5.6} y={y - p.h / 2} width={1.1} height={p.h} fill={PAINT.yellow} stroke="none" />
                  <rect x={p.x - 3.6} y={y - p.h / 2} width={1.1} height={p.h} fill={PAINT.violet} stroke="none" />
                  <rect x={p.x - 1.6} y={y - p.h / 2} width={1.1} height={p.h} fill={PAINT.red} stroke="none" />
                  <rect x={p.x + 4.4} y={y - p.h / 2} width={1.1} height={p.h} fill={PAINT.gold} stroke="none" />
                </>
              ) : (
                <>
                  <rect x={p.x - p.w / 2} y={y - p.h / 2} width={p.w} height={p.h} fill={FG} stroke="none" />
                  <rect x={p.x - p.w / 2 - 0.5} y={y - p.h / 2} width={p.w * 0.2 + 0.5} height={p.h} fill={MUTED} stroke="none" />
                  <rect x={p.x + p.w / 2 - p.w * 0.2} y={y - p.h / 2} width={p.w * 0.2 + 0.5} height={p.h} fill={MUTED} stroke="none" />
                </>
              )}
              {/* heat */}
              {[-1, 0, 1].map((k) => {
                const sway = still ? 0 : Math.sin(t * 3 + k * 2 + i) * 0.4
                const lift = still ? 0 : ((t * 2.2 + k * 0.6 + i * 0.3) % 1.8) * 0.5
                const hx = p.x + k * Math.min(2.2, p.w / 2.5)
                return <path key={k} d={`M${hx + sway} ${y - p.h / 2 - 1.5 - lift} q1 -1.6 0 -3.2`} stroke={POWER} strokeWidth={0.28} opacity={o * (1 - lift / 1.0 > 0 ? Math.max(0, 1 - lift) : 0)} />
              })}
            </g>
          )
        })}
        {PKGS.map((p, i) => {
          const h = p.p * BAR * enter(t, b.rate + 0.2 + i * 0.25, 0.7)
          return h > 0.05 ? <rect key={p.name} x={p.x - 4} y={base - h} width={8} height={h} rx={0.6} fill={POWER} fillOpacity={0.85} stroke="none" /> : null
        })}
        <path d={`M8 ${base} H92`} stroke={LINE} strokeWidth={0.25} opacity={enter(t, b.rate, 0.4)} />
      </Svg>
      {PKGS.map((p, i) => (
        <React.Fragment key={p.name}>
          <T x={p.x} y={pkgY + 9} size={2.8} weight={600} color={FG} o={enter(t, at[i] + 0.1, 0.5)} className="tabular">
            {p.name}
          </T>
          <T x={p.x} y={base - p.p * BAR - 2.4} size={3} weight={600} color={POWER} o={enter(t, b.rate + 0.5 + i * 0.25, 0.5)} className="tabular">
            {p.label}
          </T>
        </React.Fragment>
      ))}
      <T x={12} y={34} size={2.4} anchor="start" color={MUTED} o={enter(t, b.rate, 0.5)}>
        额定功率
      </T>
    </>
  )
}

// ── the 0.25 W worked example ────────────────────────────────────────────────

function Power({ t, b, rise }: { t: number; b: Record<string, number>; rise: Rise }) {
  const track = enter(t, b.calc, 0.5)
  const fill = easeInOut((t - b.pw) / 0.9)
  const x0 = 14
  const x1 = 86
  return (
    <>
      <T x={50} y={11} size={5.4} dy={rise(b.calc)} o={enter(t, b.calc, 0.4)}>
        <span className="inline-flex items-center gap-[0.3em]">
          <span style={{ color: POWER }} className="italic" >P</span>
          <span>=</span>
          <span className="inline-flex flex-col items-center align-middle" style={{ gap: "0.12em" }}>
            <span>
              <span style={{ color: VOLT }} className="italic">V</span>
              <sup style={{ fontSize: "0.6em" }}>2</sup>
            </span>
            <span className="h-[0.06em] w-full rounded-full bg-current" />
            <span className="italic">R</span>
          </span>
        </span>
      </T>
      <T x={50} y={26} size={5.2} className="tabular">
        <span className="inline-flex items-baseline gap-[0.3em]">
          <span style={{ opacity: enter(t, b.p5), color: VOLT }}>5²</span>
          <span style={{ opacity: enter(t, b.p100) }}>÷ 100</span>
          <span className="font-semibold" style={{ opacity: enter(t, b.pw), color: POWER }}>
            = 0.25 W
          </span>
        </span>
      </T>
      <Svg>
        <rect x={x0} y={37} width={x1 - x0} height={3.4} rx={1.7} stroke={LINE} strokeWidth={0.28} opacity={track} />
        {fill > 0.01 && <rect x={x0} y={37} width={(x1 - x0) * fill} height={3.4} rx={1.7} fill={POWER} stroke="none" />}
        <g opacity={enter(t, b.half, 0.4)}>
          <path d={`M${(x0 + x1) / 2} 34.8 V43`} stroke={AMP} strokeWidth={0.45} strokeDasharray="0.9 0.7" />
        </g>
      </Svg>
      <T x={x1} y={46.5} size={2.5} anchor="end" color={MUTED} o={track}>
        直插额定 1/4 W
      </T>
      <T x={(x0 + x1) / 2} y={32} size={2.6} weight={600} color={AMP} o={enter(t, b.half, 0.4)}>
        留一半余量
      </T>
      <T x={x0} y={46.5} size={2.5} anchor="start" color={POWER} o={enter(t, b.pw + 0.5, 0.5)}>
        已经满了
      </T>
    </>
  )
}

// ── what they are for ────────────────────────────────────────────────────────

function Uses({ t, b, rise }: { t: number; b: Record<string, number>; rise: Rise }) {
  const cols = [
    { x: 16, name: "限流", note: "330 Ω ~ 1 kΩ", at: b.u1 },
    { x: 38.7, name: "分压", note: "10 kΩ + 10 kΩ", at: b.u2 },
    { x: 61.3, name: "上拉", note: "4.7 kΩ ~ 10 kΩ", at: b.u3 },
    { x: 84, name: "采样", note: "0.1 Ω", at: b.u4 },
  ]
  const R = (x: number, y: number, o: number, c?: string) => (
    <Sym x={x} y={y} scale={0.15} opacity={o} color={c}>
      <Resistor x={0} y={0} rot={90} />
    </Sym>
  )
  const [c0, c1, c2, c3] = cols.map((c) => enter(t, c.at - 0.1, 0.5))
  return (
    // nudged left so the 采样 labels on the right keep the same margin as 限流 on the left
    <div className="absolute inset-0" style={{ transform: "translateX(-2cqw)" }}>
      {cols.map((c, i) => (
        <React.Fragment key={c.name}>
          <T x={c.x} y={9} size={3.4} weight={600} o={[c0, c1, c2, c3][i]} dy={rise(c.at - 0.1, 1)}>
            {c.name}
          </T>
          <T x={c.x} y={47} size={2.4} color={MUTED} o={[c0, c1, c2, c3][i]} className="tabular">
            {c.note}
          </T>
        </React.Fragment>
      ))}
      <Svg>
        {/* 限流: 5 V → R → LED → ground */}
        <g opacity={c0}>
          <path d="M16 17 V19 M16 28 V30" />
          {R(16, 23.5, 1)}
          <Sym x={16} y={34.5} scale={0.15}>
            <Led x={0} y={0} rot={90} color="red" brightness={1} />
          </Sym>
          <path d="M16 39 V41" />
          <path d="M13.8 41 H18.2 M14.6 42 H17.4 M15.4 43 H16.6" />
        </g>
        {/* 分压: two in series, tap in the middle */}
        <g opacity={c1}>
          <path d="M38.7 17 V19 M38.7 28 V32.5 M38.7 41 V43" />
          {R(38.7, 23.5, 1)}
          <Sym x={38.7} y={37} scale={0.15}>
            <Resistor x={0} y={0} rot={90} />
          </Sym>
          <path d="M38.7 30 H46" stroke={VOLT} strokeWidth={0.28} />
          <circle cx={38.7} cy={30} r={0.55} fill="currentColor" stroke="none" />
          <path d="M36.5 43 H40.9 M37.3 44 H40.1" />
        </g>
        {/* 上拉: R from the rail to a pin */}
        <g opacity={c2}>
          <path d="M61.3 17 V19 M61.3 28 V34" />
          {R(61.3, 23.5, 1)}
          <circle cx={61.3} cy={34} r={0.55} fill="currentColor" stroke="none" />
          <path d="M61.3 34 H66" />
          <rect x={66} y={31.5} width={8.5} height={5} rx={0.8} stroke={LINE} strokeWidth={0.25} />
        </g>
        {/* 采样: a tiny resistor with the current through it */}
        <g opacity={c3}>
          <path d="M84 17 V19 M84 28 V41" />
          {R(84, 23.5, 1)}
          <path d="M82.6 31.4 L84 33 L85.4 31.4" stroke={AMP} strokeWidth={0.4} />
          <path d="M88 19.5 V27.5 M87.2 20.3 L88 19.5 L88.8 20.3 M87.2 26.7 L88 27.5 L88.8 26.7" stroke={VOLT} strokeWidth={0.28} />
        </g>
      </Svg>
      <T x={16} y={14.2} size={2.4} color={VOLT} o={c0} className="tabular">
        5 V
      </T>
      <T x={38.7} y={14.2} size={2.4} color={VOLT} o={c1} className="tabular">
        5 V
      </T>
      <T x={61.3} y={14.2} size={2.4} color={VOLT} o={c2} className="tabular">
        3.3 V
      </T>
      <T x={47.5} y={30} size={2.4} anchor="start" color={VOLT} o={c1} className="tabular">
        2.5 V
      </T>
      <T x={70.2} y={34} size={2.2} o={c2} color={MUTED}>
        引脚
      </T>
      <T x={86} y={32.2} size={2.4} anchor="start" color={AMP} o={c3} className="tabular">
        1 A
      </T>
      <T x={92.4} y={23.5} size={2.4} anchor="start" color={VOLT} o={c3} className="tabular">
        0.1 V
      </T>
    </div>
  )
}

export const film: FilmDef = {
  title: "电阻器",
  audio,
  timing,
  poster: 7.5,
  Stage,
}

export default function ResistorsFilm() {
  return <FilmPlayer film={film} />
}
