import * as React from "react"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, V, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { MUTED, Outro, hash, riseOf, sinePath } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const PH = trace.second
const TAU = Math.PI * 2

/*
 * 调制, ~60 s. Scenes, each keyed to the words that introduce it:
 *   title (slow information, fast wave) → why not send it directly (a 300 km wavelength)
 *   → the carrier carries the information → the sine's three knobs
 *   → AM: the envelope follows the signal → FM: spacing follows the signal
 *   → digital: on/off, two frequencies, phase flips → a symbol on the constellation
 *   → noise smears dense constellations → Shannon: bandwidth beats SNR → "try it below".
 * Colours: information blue, the modulated wave orange, the bare carrier grey.
 */
function Stage({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  // the old scene has faded out by the time the next line starts and the new one fades in from there,
  // so two scenes never sit on top of each other
  const sc = (a: number, z: number) => span(t, a - 0.05, z - 0.3, 0.35, 0.3)
  const title = span(t, 0.25, b.why - 0.3, 0.4, 0.3)
  const why = sc(b.why, b.carrier)
  const carrier = sc(b.carrier, b.three)
  const three = span(t, b.three - 0.05, b.am - 0.1, 0.35, 0.4)
  const am = sc(b.am, b.fm)
  const fm = span(t, b.fm - 0.05, b.dig - 0.35, 0.35, 0.4)
  const dig = sc(b.dig, b.qam)
  const qam = sc(b.qam, b.noise)
  const noise = sc(b.noise, b.shannon)
  // gone before the outro's title lands where the bars are
  const shannon = span(t, b.shannon - 0.05, b.outro - 0.55, 0.35, 0.4)

  return (
    <>
      <Scene o={title}>
        <T x={50} y={13} size={8} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          调制
        </T>
        <T x={50} y={22} size={3} color={MUTED} o={enter(t, b.intro + 1.1)} dy={rise(b.intro + 1.1, 1)}>
          把信息装到载波上
        </T>
        <Svg>
          <path d={sinePath(6, 44, 35, 4, 19, still ? 0 : t * 0.2)} stroke={AMP} strokeWidth={0.45} opacity={enter(t, b.intro + 0.6, 0.6)} />
          <path d={sinePath(56, 94, 35, 4, 3.4, still ? 0 : t * 1.4)} stroke={VOLT} strokeWidth={0.4} opacity={enter(t, b.intro + 2.6, 0.6)} />
          <Draw d="M46.5 35 H53.5 M51.8 33.4 L53.5 35 L51.8 36.6" p={enter(t, b.intro + 3.6, 0.5)} strokeWidth={0.4} />
        </Svg>
        <T x={25} y={43} size={2.6} color={AMP} o={enter(t, b.intro + 0.8)}>
          低频的信息
        </T>
        <T x={75} y={43} size={2.6} color={VOLT} o={enter(t, b.intro + 2.8)}>
          高频的电磁波
        </T>
      </Scene>

      <Scene o={why}>
        <Why t={t} b={b} still={still} />
      </Scene>
      <Scene o={carrier}>
        <Carrier t={t} b={b} still={still} />
      </Scene>
      <Scene o={three}>
        <Three t={t} b={b} still={still} />
      </Scene>
      <Scene o={am}>
        <Rows t={t} b={b} still={still} mode="am" />
      </Scene>
      <Scene o={fm}>
        <Rows t={t} b={b} still={still} mode="fm" />
      </Scene>
      <Scene o={dig}>
        <Digital t={t} b={b} still={still} />
      </Scene>
      <Scene o={qam}>
        <Qam t={t} b={b} still={still} />
      </Scene>
      <Scene o={noise}>
        <Noise t={t} b={b} still={still} />
      </Scene>
      <Scene o={shannon}>
        <Shannon t={t} b={b} still={still} />
      </Scene>

      <Outro t={t} b={b} still={still} hint="在实验台里切换调制方式，看每种波形" />
    </>
  )
}

// ── why not send it directly ─────────────────────────────────────────────────

function Why({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const y = 26
  return (
    <>
      <T x={50} y={9} size={3.4} weight={500} color={AMP} o={enter(t, b.why, 0.5)} dy={rise(b.why, 1)}>
        1 kHz 的声音信号
      </T>
      <Svg>
        <path d={sinePath(8, 92, y, 6, 84, still ? 0 : t * 0.08)} stroke={AMP} strokeWidth={0.45} opacity={enter(t, b.why, 0.6)} />
        <g opacity={enter(t, b.long - 0.3, 0.5)} strokeWidth={0.35}>
          <path d={`M8 37 V41 M92 37 V41 M8 39 H92`} />
        </g>
      </Svg>
      <T x={50} y={44.5} size={4.4} weight={600} color={VOLT} o={enter(t, b.long)} dy={rise(b.long, 1)}>
        波长 <M>300 km</M>
      </T>
      <T x={50} y={50.2} size={2.8} color={MUTED} o={enter(t, b.nomake)} dy={rise(b.nomake, 1)}>
        四分之一波长的天线要 <M>75 km</M>
      </T>
    </>
  )
}

// ── the carrier carries ──────────────────────────────────────────────────────

function Carrier({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const y = 34
  const carry = enter(t, b.info, 0.6)
  return (
    <>
      <Svg>
        <path d={sinePath(6, 94, y, 5, 3.4, still ? 0 : t * 1.4, 0.3)} stroke={MUTED} strokeWidth={0.4} opacity={enter(t, b.carrier, 0.6)} />
        <path d={sinePath(6, 94, 14, 4, 40, still ? 0 : t * 0.1)} stroke={AMP} strokeWidth={0.5} opacity={carry} />
        <path d="M50 20 V28" strokeWidth={0.3} strokeDasharray="0.8 1" opacity={carry} />
      </Svg>
      <T x={6} y={y + 10} size={2.8} anchor="start" color={MUTED} o={enter(t, b.car)} dy={rise(b.car, 1)}>
        高频的载波
      </T>
      <T x={6} y={5.5} size={2.8} anchor="start" color={AMP} o={carry} dy={rise(b.info, 1)}>
        低频的信息
      </T>
    </>
  )
}

// ── three knobs ──────────────────────────────────────────────────────────────

function Three({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const piece = (at: number, c: string, letter: string, word: string) => (
    <span className="relative">
      <span style={{ opacity: 0.22 + 0.78 * enter(t, at) }}>
        <V c={c}>{letter}</V>
      </span>
      <span
        data-film-text=""
        className="absolute whitespace-nowrap"
        style={{ opacity: enter(t, at), top: "100%", marginTop: "0.45em", left: "50%", transform: "translateX(-50%)", fontSize: "max(12px, 0.36em)", color: c, fontFamily: "var(--font-sans, inherit)", fontStyle: "normal" }}
      >
        {word}
      </span>
    </span>
  )
  const s = still ? 0 : t
  const panels = [
    { x: 18, at: b.amp, c: VOLT, d: (x0: number) => sinePath(x0, x0 + 24, 43, 2.4 + 2.2 * (still ? 0.5 : 0.5 + 0.5 * Math.sin(s * 3)), 6, s * 0.9) },
    { x: 50, at: b.freq, c: PH, d: (x0: number) => sinePath(x0, x0 + 24, 43, 4, 6 - 2.6 * (still ? 0.5 : 0.5 + 0.5 * Math.sin(s * 2.2)), s * 0.9) },
    { x: 82, at: b.phase, c: trace.third, d: (x0: number) => sinePath(x0, x0 + 24, 43, 4, 6, s * 0.9 - 0.5 * (still ? 0.5 : 0.5 + 0.5 * Math.sin(s * 2.2))) },
  ]
  return (
    <>
      <T x={50} y={16} size={5.4} o={enter(t, b.three)} dy={rise(b.three, 1)}>
        <span className="inline-flex items-center gap-[0.2em]">
          <V>v</V>
          <M>(</M>
          <V>t</V>
          <M>) =</M>
          {piece(b.amp, VOLT, "A", "幅度")}
          <M>cos(2π</M>
          {piece(b.freq, PH, "f", "频率")}
          <V>t</V>
          <M>+</M>
          {piece(b.phase, trace.third, "φ", "相位")}
          <M>)</M>
        </span>
      </T>
      <Svg>
        {panels.map((p) => (
          <g key={p.x} opacity={enter(t, p.at, 0.5)}>
            <path d={p.d(p.x - 12)} stroke={p.c} strokeWidth={0.45} />
            <path d={`M${p.x - 12} 43 H${p.x + 12}`} strokeWidth={0.12} stroke="var(--border)" />
          </g>
        ))}
      </Svg>
    </>
  )
}

// ── AM and FM ────────────────────────────────────────────────────────────────

const LAMC = 3.2

function Rows({ t, b, still, mode }: StageProps & { mode: "am" | "fm" }) {
  const rise = riseOf(t, still)
  const start = mode === "am" ? b.am + 0.3 : b.fm
  const res = mode === "am" ? b.amw : b.fmw
  const k = still ? 0 : t
  const sig = (x: number) => Math.sin(TAU * ((x - 6) / 40 - k * 0.1))
  const phC = k * 1.25
  const y1 = 11
  const y2 = 27
  const y3 = 42.5
  const amA = (x: number) => (5.6 * (1 + 0.8 * sig(x))) / 1.8
  const envTop = (x0: number, x1: number, sign: number) => {
    const pts: string[] = []
    for (let x = x0; x <= x1 + 1e-6; x += 1) pts.push(`${pts.length ? "L" : "M"}${x} ${y3 - sign * amA(x)}`)
    return pts.join("")
  }
  return (
    <>
      <Svg>
        <path d={sinePath(6, 94, y1, 4, 40, k * 0.1)} stroke={AMP} strokeWidth={0.5} opacity={enter(t, start, 0.5)} />
        <path d={sinePath(6, 94, y2, 4, LAMC, phC, 0.3)} stroke={MUTED} strokeWidth={0.35} opacity={enter(t, start + 0.2, 0.5)} />
        <g opacity={enter(t, res, 0.5)}>
          {mode === "am" ? (
            <path d={sinePath(6, 94, y3, amA, LAMC, phC, 0.3)} stroke={VOLT} strokeWidth={0.4} />
          ) : (
            <path d={sinePath(6, 94, y3, 5, (x) => LAMC / (1 + 0.55 * sig(x)), phC, 0.3)} stroke={VOLT} strokeWidth={0.4} />
          )}
        </g>
        {mode === "am" && (
          <g opacity={enter(t, b.env, 0.5)} stroke={AMP} strokeWidth={0.4} strokeDasharray="1 0.8">
            <path d={envTop(6, 94, 1)} />
            <path d={envTop(6, 94, -1)} />
          </g>
        )}
      </Svg>
      <T x={6} y={4} size={2.4} anchor="start" color={AMP} o={enter(t, start, 0.5)}>
        信息
      </T>
      <T x={6} y={19.5} size={2.4} anchor="start" color={MUTED} o={enter(t, start + 0.2, 0.5)}>
        载波
      </T>
      <T x={6} y={34.5} size={2.4} anchor="start" weight={600} color={VOLT} o={enter(t, res, 0.5)} dy={rise(res, 1)}>
        {mode === "am" ? "调幅：幅度跟着信息变" : "调频：频率跟着信息变"}
      </T>
      {mode === "fm" && (
        <T x={50} y={51.5} size={2.6} color={MUTED} o={enter(t, b.dense - 0.8)} dy={rise(b.dense - 0.8, 1)}>
          信息大，波变密；信息小，波变疏
        </T>
      )}
      {mode === "am" && (
        <T x={94} y={34.5} size={2.4} anchor="end" color={AMP} o={enter(t, b.env)} dy={rise(b.env, 1)}>
          蓝色虚线：包络
        </T>
      )}
    </>
  )
}

// ── digital ──────────────────────────────────────────────────────────────────

const BITS = [1, 0, 1, 1, 0, 1, 0, 0]

function Digital({ t, b, still }: StageProps) {
  const x0 = 24
  const bw = 8.75
  const k = still ? 0 : t
  const rows = [
    { y: 25, at: b.ask, name: "开关载波", abbr: "ASK" },
    { y: 36.5, at: b.fsk, name: "换频率", abbr: "FSK" },
    { y: 48, at: b.psk, name: "翻相位", abbr: "PSK" },
  ]
  const seg = (row: number) => {
    const pts: string[] = []
    BITS.forEach((bit, i) => {
      for (let u = 0; u <= bw + 1e-6; u += 0.25) {
        const x = x0 + i * bw + u
        let y = 0
        const ph = k * 0.9
        if (row === 0) y = bit ? 3.2 * Math.sin(TAU * (x / 1.9 - ph)) : 0
        else if (row === 1) y = 3.2 * Math.sin(TAU * (x / (bit ? 1.5 : 2.7) - ph))
        else y = 3.2 * Math.sin(TAU * (x / 1.9 - ph) + (bit ? 0 : Math.PI))
        pts.push(`${pts.length ? "L" : "M"}${x.toFixed(2)} ${(rows[row].y - y).toFixed(2)}`)
      }
    })
    return pts.join("")
  }
  return (
    <>
      <T x={4} y={9} size={2.4} anchor="start" color={MUTED} o={enter(t, b.dig, 0.5)}>
        比特
      </T>
      <Svg>
        {BITS.map((_, i) => (
          <rect key={i} x={x0 + i * bw + 0.5} y={5} width={bw - 1} height={8} rx={0.8} strokeWidth={0.2} opacity={enter(t, b.dig + i * 0.05, 0.5)} />
        ))}
        {rows.map((r, i) => (
          <React.Fragment key={i}>
            <path d={sinePath(x0, x0 + 8 * bw, r.y, 3.2, 1.9, k * 0.9, 0.25)} stroke={MUTED} strokeWidth={0.3} opacity={0.45 * enter(t, b.dig + 0.4, 0.5) * (1 - enter(t, r.at, 0.4))} />
            <path d={seg(i)} stroke={VOLT} strokeWidth={0.38} opacity={enter(t, r.at, 0.5)} />
          </React.Fragment>
        ))}
      </Svg>
      {BITS.map((bit, i) => (
        <T key={i} x={x0 + (i + 0.5) * bw} y={9} size={3.4} weight={600} color={bit ? AMP : MUTED} o={enter(t, b.dig + i * 0.05, 0.5)}>
          <M>{bit}</M>
        </T>
      ))}
      {rows.map((r) => (
        <React.Fragment key={r.abbr}>
          <T x={4} y={r.y - 1.5} size={2.4} anchor="start" weight={500} o={enter(t, r.at, 0.5)}>
            {r.name}
          </T>
          <T x={4} y={r.y + 2.4} size={1.9} anchor="start" color={MUTED} o={enter(t, r.at + 0.1, 0.5)}>
            {r.abbr}
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

// ── the constellation ────────────────────────────────────────────────────────

const QAM16 = [-3, -1, 1, 3].flatMap((i) => [-3, -1, 1, 3].map((q) => [i, q] as const))

function Plane({ cx, cy, r, o }: { cx: number; cy: number; r: number; o: number }) {
  return (
    <g opacity={o} strokeWidth={0.18} stroke="var(--border)">
      <circle cx={cx} cy={cy} r={r} />
      <path d={`M${cx - r - 2} ${cy} H${cx + r + 2} M${cx} ${cy - r - 2} V${cy + r + 2}`} />
    </g>
  )
}

function Qam({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const cx = 34
  const cy = 28
  const R = 23
  const vec = 1 - enter(t, b.sym - 0.1, 0.4)
  const r = lerp(9, 18, 0.5 + 0.5 * Math.sin(still ? 1 : t * 1.3))
  const th = still ? 0.8 : t * 0.9 + 0.6
  const q4 = enter(t, b.sym, 0.5) * (1 - enter(t, b.bits - 0.1, 0.4))
  const q16 = enter(t, b.bits, 0.5)
  const u = 5.5
  return (
    <>
      <Svg>
        <Plane cx={cx} cy={cy} r={R} o={enter(t, b.qam, 0.6)} />
        <g opacity={vec * enter(t, b.qam, 0.5)}>
          <path d={`M${cx} ${cy} L${cx + r * Math.cos(th)} ${cy - r * Math.sin(th)}`} stroke={VOLT} strokeWidth={0.5} />
          <circle cx={cx + r * Math.cos(th)} cy={cy - r * Math.sin(th)} r={0.9} fill={VOLT} stroke="none" />
          <path d={`M${cx + 6} ${cy} A6 6 0 0 0 ${cx + 6 * Math.cos(th)} ${cy - 6 * Math.sin(th)}`} stroke={PH} strokeWidth={0.4} />
        </g>
        <g opacity={q4}>
          {[-1, 1].flatMap((i) => [-1, 1].map((q) => <circle key={`${i}${q}`} cx={cx + i * 9} cy={cy - q * 9} r={1.1} fill={VOLT} stroke="none" />))}
        </g>
        <g opacity={q16}>
          {QAM16.map(([i, q]) => (
            <circle key={`${i}${q}`} cx={cx + (i * u) / 1} cy={cy - (q * u) / 1} r={0.9} fill={VOLT} stroke="none" />
          ))}
        </g>
      </Svg>
      <T x={78} y={20} size={3.4} weight={500} color={VOLT} o={vec * enter(t, b.qam, 0.5)} dy={rise(b.qam, 1)}>
        长度 = 幅度
      </T>
      <T x={78} y={30} size={3.4} weight={500} color={PH} o={vec * enter(t, b.qam + 0.3, 0.5)} dy={rise(b.qam + 0.3, 1)}>
        方向 = 相位
      </T>
      <T x={78} y={19} size={2.8} color={MUTED} o={q4}>
        4 个点
      </T>
      <T x={78} y={28} size={5.4} weight={600} o={q4} className="tabular">
        2 比特
      </T>
      <T x={78} y={19} size={2.8} color={MUTED} o={q16}>
        16 个点
      </T>
      <T x={78} y={28} size={5.4} weight={600} o={q16} className="tabular">
        4 比特
      </T>
      <T x={78} y={38} size={2.6} color={MUTED} o={enter(t, b.sym + 0.2) * (1 - vec)}>
        每个点 = 一个符号
      </T>
    </>
  )
}

// ── noise ────────────────────────────────────────────────────────────────────

function Cloud({ cx, cy, sigma, seed, o }: { cx: number; cy: number; sigma: number; seed: number; o: number }) {
  return (
    <>
      {Array.from({ length: 9 }, (_, k) => {
        const a = TAU * hash(seed * 13 + k * 3.1)
        const rr = sigma * 1.5 * Math.sqrt(hash(seed * 7 + k * 5.3))
        return <circle key={k} cx={cx + rr * Math.cos(a)} cy={cy + rr * Math.sin(a)} r={0.35} fill={AMP} stroke="none" opacity={0.75 * o} />
      })}
    </>
  )
}

function Noise({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const sigma = glide(t, b.noisy, 0, 4.6, 1.6)
  const nOn = enter(t, b.noisy - 0.1, 0.4)
  const L = { cx: 26, cy: 29 }
  const Rr = { cx: 72, cy: 29 }
  const left = enter(t, b.noise, 0.6)
  const right = enter(t, b.denser - 0.2, 0.6)
  return (
    <>
      <Svg>
        <Plane cx={L.cx} cy={L.cy} r={17} o={left} />
        <Plane cx={Rr.cx} cy={Rr.cy} r={17} o={right} />
        <g opacity={left}>
          {[-1, 1].flatMap((i) => [-1, 1].map((q, k) => <circle key={`${i}${q}`} cx={L.cx + i * 8} cy={L.cy - q * 8} r={1} fill={VOLT} stroke="none" opacity={1 - 0.3 * nOn * (k + 0)} />))}
        </g>
        <g opacity={right}>
          {QAM16.map(([i, q]) => (
            <circle key={`${i}${q}`} cx={Rr.cx + i * 4.2} cy={Rr.cy - q * 4.2} r={0.8} fill={VOLT} stroke="none" />
          ))}
        </g>
        {nOn > 0.01 && (
          <g>
            {[-1, 1].flatMap((i) => [-1, 1].map((q) => <Cloud key={`l${i}${q}`} cx={L.cx + i * 8} cy={L.cy - q * 8} sigma={sigma} seed={i * 3 + q + 10} o={nOn} />))}
            {QAM16.map(([i, q]) => (
              <Cloud key={`r${i}${q}`} cx={Rr.cx + i * 4.2} cy={Rr.cy - q * 4.2} sigma={sigma} seed={i * 5 + q * 2 + 30} o={nOn * right} />
            ))}
          </g>
        )}
      </Svg>
      <T x={L.cx} y={8} size={3} weight={500} o={left} dy={rise(b.noise, 1)}>
        QPSK · 2 比特
      </T>
      <T x={Rr.cx} y={8} size={3} weight={500} o={right} dy={rise(b.denser, 1)}>
        16-QAM · 4 比特
      </T>
      <T x={L.cx} y={51} size={2.8} color={trace.good} o={enter(t, b.wrong - 0.2)}>
        还分得清
      </T>
      <T x={Rr.cx} y={51} size={2.8} weight={600} color={trace.power} o={enter(t, b.wrong)} dy={rise(b.wrong, 1)}>
        挤在一起，认错
      </T>
    </>
  )
}

// ── Shannon ──────────────────────────────────────────────────────────────────

function Shannon({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const bw = enter(t, b.bw, 0.5)
  const snr = enter(t, b.snr, 0.5)
  const cheap = enter(t, b.cheap, 0.5)
  const grow = (at: number) => enter(t, at + 0.2, 0.9)
  const base = 45
  const groups = [
    { x: 27, at: b.bw, h2: 20, label: "带宽 ×2", out: "速率 ×2", c: trace.good },
    { x: 73, at: b.snr, h2: 11, label: "信噪比 ×2", out: "速率 +10%", c: MUTED },
  ]
  return (
    <>
      <T x={50} y={11} size={5.4} o={enter(t, b.shannon)} dy={rise(b.shannon, 1)}>
        <span className="inline-flex items-center gap-[0.22em]">
          <V>C</V>
          <M>=</M>
          <span style={{ opacity: 0.22 + 0.78 * bw }}>
            <V c={VOLT}>B</V>
          </span>
          <M>
            log<span style={{ fontSize: "0.6em", verticalAlign: "-0.25em" }}>2</span>(1 +
          </M>
          <span style={{ opacity: 0.22 + 0.78 * snr }}>
            <V c={PH}>S/N</V>
          </span>
          <M>)</M>
        </span>
      </T>
      <Svg>
        {groups.map((g, i) => {
          const o = i ? snr : bw
          const hh = lerp(10, g.h2, grow(g.at))
          return (
            <g key={g.x} opacity={o}>
              <rect x={g.x - 9} y={base - 10} width={8} height={10} rx={0.5} stroke="none" fill="color-mix(in srgb, var(--foreground) 14%, transparent)" />
              <rect x={g.x + 1} y={base - hh} width={8} height={hh} rx={0.5} stroke="none" fill={i === 0 ? trace.good : VOLT} opacity={i === 0 ? 0.55 + 0.45 * cheap : 0.8} />
              <path d={`M${g.x - 14} ${base} H${g.x + 14}`} strokeWidth={0.2} />
            </g>
          )
        })}
      </Svg>
      {groups.map((g, i) => (
        <React.Fragment key={g.x}>
          <T x={g.x} y={22} size={3} weight={500} color={i ? PH : VOLT} o={i ? snr : bw} dy={rise(g.at, 1)}>
            {g.label}
          </T>
          <T x={g.x} y={base + 4.5} size={2.8} weight={i ? 400 : 600} color={i ? MUTED : trace.good} o={(i ? snr : bw) * grow(g.at)}>
            {g.out}
          </T>
        </React.Fragment>
      ))}
      <T x={50} y={22} size={2.4} weight={600} color={trace.good} o={cheap} dy={rise(b.cheap, 1)}>
        加带宽更划算
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "调制：把信息装上载波",
  audio,
  timing,
  poster: 4.6,
  Stage,
}

export default function ModulationFilm() {
  return <FilmPlayer film={film} />
}
