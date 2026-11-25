import * as React from "react"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, easeInOut, enter, span, type FilmDef, type StageProps } from "../../kit"
import { MUTED, Outro, riseOf } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const GOOD = trace.good
const BAD = trace.power
const BORDER = "var(--border)"

/*
 * 链路预算, ~60 s. Scenes, each keyed to the words that introduce it:
 *   title (a transmitter, a fading wave, a receiver) → dBm: a trillion-fold range squeezed onto a ruler
 *   → +3 dB doubles, +10 dB ×10 → the bill: five chips joined by + and − → path loss: +6 dB per doubling
 *   → receiver sensitivity → Wi-Fi, Bluetooth, LoRa on one ladder
 *   → the budget as a waterfall: 0 dBm − 60 dB, 35 dB left; two concrete walls leave 5 dB → "drag the sliders".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  // the old scene has faded out by the time the next line starts and the new one fades in from there,
  // so two scenes never sit on top of each other
  const sc = (a: number, z: number) => span(t, a - 0.05, z - 0.3, 0.35, 0.3)
  const title = span(t, 0.25, b.dbm - 0.3, 0.4, 0.3)
  const dbm = sc(b.dbm, b.rule)
  const rule = sc(b.rule, b.bill)
  const bill = sc(b.bill, b.path)
  const path = sc(b.path, b.sens)
  const sens = sc(b.sens, b.tech)
  // the rates arrive on the last word of the line: keep them up into the gap
  const tech = span(t, b.tech - 0.05, b.margin + 0.4, 0.35, 0.4)
  const budget = sc(b.margin + 0.8, b.outro)

  return (
    <>
      <Scene o={title}>
        <T x={50} y={13} size={8} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          链路预算
        </T>
        <T x={50} y={22} size={3} color={MUTED} o={enter(t, b.intro + 1.1)} dy={rise(b.intro + 1.1, 1)}>
          信号走到对面，还剩多少
        </T>
        <Title t={t} b={b} still={still} />
      </Scene>
      <Scene o={dbm}>
        <Dbm t={t} b={b} still={still} />
      </Scene>
      <Scene o={rule}>
        <Rule t={t} b={b} still={still} />
      </Scene>
      <Scene o={bill}>
        <Bill t={t} b={b} still={still} />
      </Scene>
      <Scene o={path}>
        <Path t={t} b={b} still={still} />
      </Scene>
      <Scene o={sens}>
        <Sens t={t} b={b} still={still} />
      </Scene>
      <Scene o={tech}>
        <Tech t={t} b={b} still={still} />
      </Scene>
      <Scene o={budget}>
        <Budget t={t} b={b} still={still} />
      </Scene>

      <Outro t={t} b={b} still={still} hint="拖动下面的距离和额外损耗滑块，看余量" />
    </>
  )
}

/** A mast with two whiskers, standing on (x, y), `h` units tall. */
function Mast({ x, y, h = 12 }: { x: number; y: number; h?: number }) {
  return <path d={`M${x} ${y} V${y - h} M${x} ${y - h * 0.46} L${x - h * 0.38} ${y - h} M${x} ${y - h * 0.46} L${x + h * 0.38} ${y - h}`} strokeWidth={0.5} />
}

function Title({ t, b, still }: StageProps) {
  const e = enter(t, b.intro + 0.5, 0.6)
  const tx = 14
  const rx = 86
  const y = 42
  const P = 0.9
  const start = b.intro + 1.8
  return (
    <>
      <Svg>
        <g opacity={e}>
          <Mast x={tx} y={y} />
          <Mast x={rx} y={y} />
        </g>
        {Array.from({ length: 9 }, (_, k) => {
          const age = still ? 3 + k : t - start - k * P
          if (age <= 0) return null
          const r = age * 10
          if (r > rx - tx + 6) return null
          const o = Math.max(0, 1 - r / (rx - tx)) * Math.min(1, age / 0.3)
          return <path key={k} d={`M${tx + r * Math.cos(0.25)} ${y - 6 - r * Math.sin(0.25)} A${r} ${r} 0 0 1 ${tx + r * Math.cos(0.25)} ${y - 6 + r * Math.sin(0.25)}`} stroke={VOLT} strokeWidth={0.4} opacity={0.8 * o} />
        })}
      </Svg>
      <T x={tx} y={48} size={2.4} color={MUTED} o={enter(t, b.intro + 0.8)}>
        发射机
      </T>
      <T x={rx} y={48} size={2.4} color={MUTED} o={enter(t, b.intro + 3.2)}>
        接收机
      </T>
    </>
  )
}

// ── dBm ──────────────────────────────────────────────────────────────────────

function Dbm({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const cards = [
    { x: 18, w: "1 W", d: "30 dBm", sub: "对讲机", at: b.dbm + 0.2 },
    { x: 50, w: "1 mW", d: "0 dBm", sub: "蓝牙常用", at: b.one },
    { x: 82, w: "0.3 pW", d: "−95 dBm", sub: "蓝牙接收极限", at: b.dbm + 0.5 },
  ]
  const conv = enter(t, b.dbmw + 0.1, 0.5)
  return (
    <>
      <T x={50} y={9} size={3.2} color={MUTED} o={enter(t, b.dbm)} dy={rise(b.dbm, 1)}>
        功率跨度：差了三万亿倍
      </T>
      <Svg>
        <Draw d="M30 25 H39 M61 25 H67.5" p={enter(t, b.dbm + 0.4, 0.6)} strokeWidth={0.25} />
        <path d="M66.2 23.8 L67.5 25 L66.2 26.2" opacity={enter(t, b.dbm + 1, 0.4)} strokeWidth={0.25} />
      </Svg>
      {cards.map((c, i) => {
        const o = i === 1 ? enter(t, b.one - 0.2, 0.5) : enter(t, b.dbm + i * 0.15, 0.5)
        return (
          <React.Fragment key={c.x}>
            <T x={c.x} y={25} size={i === 1 ? 5.4 : 5} weight={600} color={i === 1 ? VOLT : undefined} o={o * (1 - conv * (i === 1 ? 0 : 1)) * (i === 1 ? 0 : 1)} className="tabular">
              {c.w}
            </T>
            <T x={c.x} y={25} size={5.4} weight={600} color={i === 1 ? VOLT : undefined} o={i === 1 ? o : conv * enter(t, b.dbmw + i * 0.15, 0.5)} className="tabular">
              {c.d}
            </T>
            <T x={c.x} y={34} size={2.6} color={MUTED} o={i === 1 ? 0 : conv * enter(t, b.dbmw + 0.4 + i * 0.1)} className="tabular">
              {c.w}
            </T>
            <T x={c.x} y={40} size={2.4} color={MUTED} o={(i === 1 ? o : enter(t, b.dbm + 0.9)) * 0.9}>
              {c.sub}
            </T>
          </React.Fragment>
        )
      })}
      <T x={50} y={34} size={3} weight={600} color={VOLT} o={enter(t, b.one)} dy={rise(b.one, 1)} className="tabular">
        <M>= 1 mW</M>
      </T>
      <T x={50} y={48} size={2.6} color={MUTED} o={enter(t, b.dbmw + 0.6)}>
        以 1 mW 为基准的分贝
      </T>
    </>
  )
}

// ── +3 dB, +10 dB ────────────────────────────────────────────────────────────

function Rule({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const base = 50
  const bars = [
    { x: 22, h: 3.4, at: b.rule, dbm: "0 dBm", mw: "1 mW", c: VOLT },
    { x: 50, h: 6.8, at: b.three, dbm: "3 dBm", mw: "2 mW", c: VOLT },
    { x: 78, h: 34, at: b.ten, dbm: "10 dBm", mw: "10 mW", c: VOLT },
  ]
  return (
    <>
      <Svg>
        <path d={`M8 ${base} H92`} strokeWidth={0.25} />
        {bars.map((br) => {
          const o = enter(t, br.at, 0.5)
          return <rect key={br.x} x={br.x - 5} y={base - br.h * o} width={10} height={br.h * o} rx={0.5} stroke="none" fill={br.c} fillOpacity={0.75} />
        })}
        {/* both steps start from 0 dBm: +3 dB lands on 3 dBm, +10 dB on 10 dBm */}
        <g opacity={enter(t, b.three, 0.5)} strokeWidth={0.3}>
          <path d="M22 33 V30 H44 M42.4 28.8 L44 30 L42.4 31.2" />
        </g>
        <g opacity={enter(t, b.ten, 0.5)} strokeWidth={0.3}>
          <path d="M22 30 V21 H71 M69.4 19.8 L71 21 L69.4 22.2" />
        </g>
      </Svg>
      {bars.map((br) => (
        <React.Fragment key={br.x}>
          <T x={br.x} y={base - br.h - 9} size={4.2} weight={600} color={br.c} o={enter(t, br.at + 0.1, 0.5)} dy={rise(br.at, 1)} className="tabular">
            {br.dbm}
          </T>
          <T x={br.x} y={base - br.h - 4} size={2.6} color={MUTED} o={enter(t, br.at + 0.2, 0.5)} className="tabular">
            {br.mw}
          </T>
        </React.Fragment>
      ))}
      <T x={33} y={26.6} size={2.8} weight={600} o={enter(t, b.three + 0.2, 0.5)} className="tabular">
        +3 dB · ×2
      </T>
      <T x={47} y={17.6} size={2.8} weight={600} o={enter(t, b.ten + 0.2, 0.5)} className="tabular">
        +10 dB · ×10
      </T>
    </>
  )
}

// ── the bill ─────────────────────────────────────────────────────────────────

function Bill({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const chips = [
    { w: "接收功率", u: "dBm", c: AMP, sign: "" },
    { w: "发射功率", u: "dBm", c: VOLT, sign: "=" },
    { w: "天线增益", u: "dBi", c: GOOD, sign: "+" },
    { w: "路径损耗", u: "dB", c: BAD, sign: "−" },
    { w: "其他损耗", u: "dB", c: BAD, sign: "−" },
  ]
  const cw = 15.5
  const gap = 4.5
  const x0 = 50 - (5 * cw + 4 * gap) / 2
  return (
    <>
      <T x={50} y={11} size={2.8} color={MUTED} o={enter(t, b.bill)} dy={rise(b.bill, 1)}>
        一条链路 = 一串加减
      </T>
      <Svg>
        {chips.map((c, i) => {
          const o = enter(t, b.bill + 0.2 + i * 0.45, 0.45)
          return <rect key={i} x={x0 + i * (cw + gap)} y={22} width={cw} height={9} rx={1} stroke={c.c} strokeWidth={0.4} opacity={o} />
        })}
      </Svg>
      {chips.map((c, i) => {
        const o = enter(t, b.bill + 0.2 + i * 0.45, 0.45)
        const cx = x0 + i * (cw + gap) + cw / 2
        return (
          <React.Fragment key={i}>
            <T x={cx} y={26.5} size={2.5} weight={500} color={c.c} o={o} dy={rise(b.bill + 0.2 + i * 0.45, 1)}>
              {c.w}
            </T>
            <T x={cx} y={36} size={2.2} color={MUTED} o={o}>
              {c.u}
            </T>
            {c.sign && (
              <T x={x0 + i * (cw + gap) - gap / 2} y={26.5} size={4.2} o={o}>
                <M>{c.sign}</M>
              </T>
            )}
          </React.Fragment>
        )
      })}
      <T x={50} y={46} size={5} weight={600} o={enter(t, b.bll, 0.5)} dy={rise(b.bll, 1)}>
        全是加减法
      </T>
    </>
  )
}

// ── path loss ────────────────────────────────────────────────────────────────

function Path({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const tx = 8
  const y = 26
  const half = 0.3
  const arcs = [
    { r: 24, at: b.path, label: "10 m", db: "60 dB", o: 0.9 },
    { r: 48, at: b.dbl, label: "20 m", db: "66 dB", o: 0.6 },
    { r: 72, at: b.six, label: "40 m", db: "72 dB", o: 0.35 },
  ]
  return (
    <>
      <Svg>
        <Mast x={tx} y={y + 6} h={12} />
        <g stroke={BORDER} strokeWidth={0.15} strokeDasharray="1 1" opacity={enter(t, b.path, 0.6)}>
          <path d={`M${tx} ${y} L${tx + 72 * Math.cos(half)} ${y - 72 * Math.sin(half)} M${tx} ${y} L${tx + 72 * Math.cos(half)} ${y + 72 * Math.sin(half)}`} />
        </g>
        {arcs.map((a) => (
          <Draw key={a.r} d={`M${tx + a.r * Math.cos(half)} ${y - a.r * Math.sin(half)} A${a.r} ${a.r} 0 0 1 ${tx + a.r * Math.cos(half)} ${y + a.r * Math.sin(half)}`} p={enter(t, a.at - 0.1, 0.7)} stroke={VOLT} strokeWidth={0.55} opacity={a.o} />
        ))}
        <g opacity={enter(t, b.six - 0.1, 0.5)} strokeWidth={0.3} stroke={BAD}>
          <path d="M33 53 H57 M55.4 51.8 L57 53 L55.4 54.2" opacity={0} />
        </g>
      </Svg>
      {arcs.map((a) => (
        <React.Fragment key={a.r}>
          <T x={tx + a.r + 2.5} y={y - 3} size={2.6} anchor="start" color={MUTED} o={enter(t, a.at, 0.5)} className="tabular">
            <M>{a.label}</M>
          </T>
          <T x={tx + a.r + 2.5} y={y + 3} size={3.4} anchor="start" weight={600} color={BAD} o={enter(t, a.at + 0.2, 0.5)} dy={rise(a.at, 1)} className="tabular">
            <M>{a.db}</M>
          </T>
        </React.Fragment>
      ))}
      <T x={tx + 36} y={51} size={2.8} weight={600} color={BAD} o={enter(t, b.dbl + 0.5)} className="tabular">
        <M>+6 dB</M>
      </T>
      <T x={tx + 60} y={51} size={2.8} weight={600} color={BAD} o={enter(t, b.six + 0.5)} className="tabular">
        <M>+6 dB</M>
      </T>
      <T x={18} y={8} size={2.8} color={MUTED} o={enter(t, b.path)} dy={rise(b.path, 1)}>
        自由空间路径损耗
      </T>
      <T x={44} y={8} size={2.8} color={MUTED} o={enter(t, b.dbl)} dy={rise(b.dbl, 1)}>
        距离每翻一倍
      </T>
    </>
  )
}

// ── sensitivity ladder ───────────────────────────────────────────────────────

const LY = (dbm: number) => 8 + 0.31 * -dbm

function Ladder({ t, at, ticks }: { t: number; at: number; ticks: number[] }) {
  return (
    <>
      <Svg>
        <path d={`M16 6 V${LY(-140)}`} strokeWidth={0.3} opacity={enter(t, at, 0.6)} />
        {ticks.map((v) => (
          <path key={v} d={`M16 ${LY(v)} h-1`} strokeWidth={0.25} opacity={enter(t, at, 0.6)} />
        ))}
      </Svg>
      {ticks.map((v) => (
        <T key={v} x={13.5} y={LY(v)} size={2.2} anchor="end" color={MUTED} o={enter(t, at + 0.1, 0.5)} className="tabular">
          {String(v).replace("-", "−")}
        </T>
      ))}
      <T x={14} y={3.6} size={2.2} color={MUTED} o={enter(t, at + 0.1, 0.5)}>
        dBm
      </T>
    </>
  )
}

function Sens({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const line = enter(t, b.ble - 0.3, 0.8)
  const y = LY(-95)
  const my = still ? LY(-60) : LY(0) + (LY(-100) - LY(0)) * easeInOut((t - (b.sens + 0.3)) / (b.ble - b.sens + 1.6))
  return (
    <>
      <Ladder t={t} at={b.sens - 0.1} ticks={[0, -30, -60, -90]} />
      <Svg>
        <g opacity={line}>
          <rect x={17} y={6} width={74} height={y - 6} stroke="none" fill={GOOD} fillOpacity={0.1} />
          <rect x={17} y={y} width={74} height={LY(-130) - y} stroke="none" fill={BAD} fillOpacity={0.1} />
          <path d={`M17 ${y} H91`} stroke={AMP} strokeWidth={0.55} />
        </g>
      </Svg>
      <T x={54} y={12} size={3.4} weight={600} color={GOOD} o={line} dy={rise(b.ble, 1)}>
        听得清
      </T>
      <T x={54} y={y + 8} size={3.4} weight={600} color={BAD} o={line}>
        听不清
      </T>
      <T x={90} y={y - 3.2} size={3} anchor="end" weight={600} color={AMP} o={enter(t, b.ble, 0.5)} className="tabular">
        蓝牙灵敏度 <M>−95 dBm</M>
      </T>
      <T x={60} y={5} size={2.8} color={MUTED} o={enter(t, b.sens + 0.3)} dy={rise(b.sens + 0.3, 1)}>
        接收机能听清的最弱信号
      </T>
      <Svg>
        <g opacity={enter(t, b.sens + 0.2, 0.5) * (1 - enter(t, b.ble + 0.5, 0.5))}>
          <circle cx={28} cy={my} r={1.1} fill={AMP} stroke="none" />
          <path d={`M22 ${my} H34`} stroke={AMP} strokeWidth={0.3} />
        </g>
      </Svg>
      <T x={37} y={my} size={2.4} anchor="start" color={AMP} o={enter(t, b.sens + 0.2, 0.5) * (1 - enter(t, b.ble + 0.5, 0.5))}>
        越来越弱的信号
      </T>
    </>
  )
}

// ── three technologies on one ladder ─────────────────────────────────────────

function Tech({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const rows = [
    { v: -75, name: "无线网", c: VOLT, at: b.tech, speed: "上百 Mbit/s", sat: b.slow },
    { v: -95, name: "蓝牙", c: AMP, at: b.narrow, speed: "约 1 Mbit/s", sat: b.slow + 0.25 },
    { v: -137, name: "LoRa", c: trace.second, at: b.simple, speed: "约 0.3 kbit/s", sat: b.slow + 0.5 },
  ]
  return (
    <>
      <Ladder t={t} at={b.tech - 0.1} ticks={[-60, -90, -120]} />
      <Svg>
        {rows.map((r) => (
          <Draw key={r.name} d={`M17 ${LY(r.v)} H52`} p={enter(t, r.at - 0.1, 0.7)} stroke={r.c} strokeWidth={0.7} />
        ))}
      </Svg>
      {rows.map((r) => (
        <React.Fragment key={r.name}>
          <T x={54} y={LY(r.v)} size={2.5} anchor="start" weight={600} color={r.c} o={enter(t, r.at, 0.5)} className="tabular">
            {r.name} <M>{String(r.v).replace("-", "−")}</M>
          </T>
          <T x={94} y={LY(r.v)} size={2.4} anchor="end" color={MUTED} o={enter(t, r.sat, 0.5)} className="tabular">
            <M>{r.speed}</M>
          </T>
        </React.Fragment>
      ))}
      <T x={70} y={9} size={3.2} weight={600} o={enter(t, b.far, 0.5)} dy={rise(b.far, 1)}>
        灵敏度越低，传得越远
      </T>
      <T x={94} y={LY(-75) - 4.6} size={2.4} anchor="end" color={MUTED} o={enter(t, b.slow - 0.1, 0.5)}>
        速率
      </T>
    </>
  )
}

// ── the budget as a waterfall ────────────────────────────────────────────────

const BY = (dbm: number) => 10 + 0.4 * -dbm

function Budget({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const sensY = BY(-95)
  const tx = 10
  const pl = 22
  const r1 = 34
  const wl = 52
  const r2 = 64
  const m1 = enter(t, b.mrg - 0.1, 0.5) * (1 - enter(t, b.wls - 0.1, 0.4))
  const w = enter(t, b.wls, 0.6)
  const ok = enter(t, b.ten2 - 0.1, 0.5)
  return (
    <>
      <Svg>
        <path d={`M4 ${sensY} H94`} stroke={AMP} strokeWidth={0.35} strokeDasharray="1.2 1" opacity={enter(t, b.margin + 0.8, 0.6)} />
        <g opacity={enter(t, b.margin + 0.8, 0.5)}>
          <circle cx={tx} cy={BY(0)} r={1.2} fill={VOLT} stroke="none" />
        </g>
        <g opacity={enter(t, b.margin + 1.7, 0.5)}>
          <path d={`M${tx} ${BY(0)} H${pl - 3} M${pl + 3} ${BY(-60)} H${r1}`} strokeWidth={0.15} strokeDasharray="0.8 0.9" />
          <rect x={pl - 3} y={BY(0)} width={6} height={BY(-60) - BY(0)} rx={0.4} stroke="none" fill={BAD} fillOpacity={0.55} />
        </g>
        <g opacity={enter(t, b.rx - 0.1, 0.5)}>
          <circle cx={r1} cy={BY(-60)} r={1.2} fill={AMP} stroke="none" />
        </g>
        <g opacity={m1} stroke={GOOD} strokeWidth={0.4}>
          <path d={`M44 ${BY(-60)} V${sensY} M42.6 ${BY(-60)} H45.4 M42.6 ${sensY} H45.4`} />
        </g>
        <g opacity={w}>
          <rect x={wl - 3} y={BY(-60)} width={6} height={BY(-90) - BY(-60)} rx={0.4} stroke="none" fill={BAD} fillOpacity={0.55} />
          <circle cx={r2} cy={BY(-90)} r={1.2} fill={AMP} stroke="none" />
          <path d={`M74 ${BY(-90)} V${sensY} M72.6 ${BY(-90)} H75.4 M72.6 ${sensY} H75.4`} stroke={BAD} strokeWidth={0.4} />
          <path d={`M${r1} ${BY(-60)} H${wl - 3} M${wl} ${BY(-90)} H${r2}`} strokeWidth={0.15} strokeDasharray="0.8 0.9" />
        </g>
      </Svg>
      <T x={tx} y={5.5} size={2.3} color={VOLT} o={enter(t, b.margin + 0.8, 0.5)}>
        发射 <M>0 dBm</M>
      </T>
      <T x={pl} y={BY(-60) + 4.5} size={2.3} color={BAD} o={enter(t, b.margin + 1.8, 0.5)}>
        路径损耗
      </T>
      <T x={pl} y={BY(-60) + 8.5} size={2.3} weight={600} color={BAD} o={enter(t, b.margin + 1.8, 0.5)} className="tabular">
        <M>−60 dB</M>
      </T>
      <T x={r1} y={BY(-60) - 4} size={2.3} color={AMP} o={enter(t, b.rx, 0.5)} dy={rise(b.rx, 1)}>
        收到 <M>−60 dBm</M>
      </T>
      <T x={46} y={(BY(-60) + sensY) / 2} size={3.2} anchor="start" weight={600} color={GOOD} o={m1} dy={rise(b.mrg, 1)} className="tabular">
        余量 <M>35 dB</M>
      </T>
      <T x={6} y={sensY + 4} size={2.3} anchor="start" color={AMP} o={enter(t, b.margin + 0.8, 0.6)}>
        灵敏度 <M>−95 dBm</M>
      </T>
      <T x={wl} y={BY(-60) - 4} size={2.3} color={BAD} o={w} dy={rise(b.wls, 1)}>
        承重墙 <M>−30 dB</M>
      </T>
      <T x={r2} y={BY(-90) - 4} size={2.3} color={AMP} o={w}>
        收到 <M>−90 dBm</M>
      </T>
      <T x={77} y={43.5} size={3.2} anchor="start" weight={600} color={BAD} o={enter(t, b.five - 0.1, 0.5)} dy={rise(b.five, 1)} className="tabular">
        余量 <M>5 dB</M>
      </T>
      <T x={90} y={11} size={2.8} anchor="end" weight={600} color={GOOD} o={ok} dy={rise(b.ten2, 1)}>
        最好留 <M>10 dB</M> 以上
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "链路预算与常见无线技术",
  audio,
  timing,
  poster: 4.6,
  Stage,
}

export default function LinkBudgetFilm() {
  return <FilmPlayer film={film} />
}
