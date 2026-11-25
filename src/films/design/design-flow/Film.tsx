import * as React from "react"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, easeInOut, enter, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, Box, Check, Flow, GOOD, MUTED, POWER, VOLT } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * 从需求到电路：设计流程, ~65 s.
 *   title (a logger board) → the seven stations as a path → requirements as numbers → block diagram
 *   → part picking → duty-cycle current plot → battery-life bars → schematic checklist
 *   → first power-up on a current-limited supply → "try the calculator".
 * From the requirements on, a thin rail of the seven stations stays at the top.
 */
const STATIONS = ["需求", "框图", "选型", "原理图", "板子", "打样", "调试"]
const SX = (i: number) => 10 + i * 13.33

function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  // each scene is gone before the next one's content arrives, so two never sit on top of each other
  const title = span(t, 0.25, b.stations - 0.45)
  const stations = span(t, b.stations - 0.25, b.req - 0.45)
  const req = span(t, b.req - 0.25, b.block - 0.45)
  const block = span(t, b.block - 0.25, b.pick - 0.45)
  const pick = span(t, b.pick - 0.25, b.power - 0.45)
  const power = span(t, b.power - 0.25, b.life - 0.45)
  const life = span(t, b.life - 0.25, b.check - 0.45)
  const check = span(t, b.check - 0.25, b.first - 0.45)
  const first = span(t, b.first - 0.25, b.outro - 0.45)
  const outro = enter(t, b.outro - 0.1, 0.5)
  const rail = Math.min(enter(t, b.req - 0.2), 1 - outro)
  const active = t < b.block - 0.2 ? 0 : t < b.pick - 0.2 ? 1 : t < b.check - 0.2 ? 2 : t < b.first - 0.2 ? 3 : 6

  return (
    <>
      <Scene o={title} dy={lift(b.stations - 0.45)}>
        <T x={50} y={11} size={6.4} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          温湿度记录器
        </T>
        <T x={50} y={19} size={2.8} color={MUTED} o={enter(t, b.intro + 0.9)} dy={rise(b.intro + 0.9, 1)}>
          一颗纽扣电池，用满一年
        </T>
        <Logger t={t} b={b} />
      </Scene>

      <Scene o={stations}>
        <Path t={t} b={b} still={still} />
      </Scene>

      <Scene o={rail}>
        <Svg>
          <path d={`M${SX(0)} 4.2 H${SX(6)}`} stroke="var(--border)" strokeWidth={0.25} />
          {STATIONS.map((_, i) => (
            <circle key={i} cx={SX(i)} cy={4.2} r={i === active ? 0.9 : 0.55} fill={i === active ? GOOD : "var(--muted-foreground)"} stroke="none" opacity={i === active ? 1 : 0.5} />
          ))}
        </Svg>
        {STATIONS.map((s, i) => (
          <T key={s} x={SX(i)} y={7.6} size={1.9} color={i === active ? undefined : MUTED} weight={i === active ? 600 : 400} o={i === active ? 1 : 0.7}>
            {s}
          </T>
        ))}
      </Scene>

      <Scene o={req}>
        <T x={50} y={14} size={3} color={MUTED} o={enter(t, b.req)} dy={rise(b.req, 1)}>
          需求，写成数字
        </T>
        <Svg>
          <path d="M20 22.5 H80 M20 33.5 H80 M20 44.5 H80" stroke="var(--border)" strokeWidth={0.2} opacity={enter(t, b.req + 0.2)} />
        </Svg>
        {(
          [
            [20, "功能", "每分钟测一次", b.min],
            [31, "供电", "用满一年", b.year],
            [42, "成本", "30 元以内", b.cost],
          ] as const
        ).map(([y, k, v, at]) => (
          <React.Fragment key={k}>
            <T x={34} y={y} size={2.8} anchor="end" color={MUTED} o={enter(t, at - 0.1)}>
              {k}
            </T>
            <T x={38} y={y} size={5} anchor="start" weight={600} o={enter(t, at)} dy={rise(at, 1)} className="tabular">
              {v}
            </T>
          </React.Fragment>
        ))}
      </Scene>

      <Scene o={block}>
        <Blocks t={t} b={b} />
      </Scene>

      <Scene o={pick}>
        <Pick t={t} b={b} still={still} />
      </Scene>

      <Scene o={power}>
        <Duty t={t} b={b} still={still} />
      </Scene>

      <Scene o={life}>
        <Life t={t} b={b} still={still} />
      </Scene>

      <Scene o={check}>
        <Checklist t={t} b={b} />
      </Scene>

      <Scene o={first}>
        <PowerUp t={t} b={b} still={still} />
      </Scene>

      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
          拖动下面的唤醒间隔，看续航怎么变
        </T>
        <Svg>
          <g opacity={enter(t, b.drag + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
            <path d="M50 38 V45 M47.6 42.6 L50 45 L52.4 42.6" />
          </g>
        </Svg>
      </Scene>
    </>
  )
}

// ── title: a little logger board ────────────────────────────────────────────

function Logger({ t, b }: Pick<StageProps, "t" | "b">) {
  const o = enter(t, b.intro + 1.4, 0.7)
  return (
    <Svg>
      <g opacity={o}>
        <Box x={32} y={24} w={36} h={20} />
        <Box x={43} y={29} w={10} h={10} color={AMP} />
        <Box x={36} y={36} w={4} h={4} color={VOLT} />
        <circle cx={61} cy={34} r={4.4} stroke={GOOD} />
        <path d="M61 31.4 v5.2 M58.4 34 h5.2" stroke={GOOD} strokeWidth={0.2} />
        <path d="M53 32 H58 M53 36 H56.6 M40 36 V34 H43 M48 29 V26.5 H40" strokeWidth={0.2} stroke="var(--muted-foreground)" />
      </g>
    </Svg>
  )
}

// ── the seven stations as a path ───────────────────────────────────────────

function Path({ t, b, still }: StageProps) {
  const at = [b.s1, b.s2, b.s3, b.s4, b.s5, b.s6, b.s7]
  // the walker sits on the latest station and slides to the next one
  let walker = SX(0)
  for (let i = 1; i < 7; i++) walker = lerp(walker, SX(i), easeInOut((t - (at[i] - 0.45)) / 0.4))
  const line = Math.min(1, Math.max(0, (walker - SX(0)) / (SX(6) - SX(0))))
  return (
    <>
      <T x={50} y={12} size={3} color={MUTED} o={enter(t, b.stations)}>
        一条流水线，七站
      </T>
      <Svg>
        <path d={`M${SX(0)} 28 H${SX(6)}`} stroke="var(--border)" strokeWidth={0.4} />
        <Draw d={`M${SX(0)} 28 H${SX(6)}`} p={line} stroke={GOOD} strokeWidth={0.5} />
        {STATIONS.map((_, i) => {
          const o = 0.3 + 0.7 * enter(t, at[i] - 0.1)
          return <circle key={i} cx={SX(i)} cy={28} r={3.4 * (0.6 + 0.4 * o)} fill="var(--background)" stroke={i < 6 && at[i + 1] - 0.45 < t ? GOOD : "currentColor"} opacity={o} />
        })}
        {t > at[0] - 0.2 && <circle cx={walker} cy={28} r={1.1} fill={GOOD} stroke="none" opacity={enter(t, at[0] - 0.1)} />}
      </Svg>
      {STATIONS.map((s, i) => (
        <React.Fragment key={s}>
          <T x={SX(i)} y={28.1} size={2.4} font="math" color={MUTED} o={enter(t, at[i])} className="tabular" scale={still ? 1 : 1}>
            <M>{i + 1}</M>
          </T>
          <T x={SX(i)} y={36.5} size={2.8} weight={600} o={enter(t, at[i])} dy={still ? 0 : (1 - enter(t, at[i], 0.5)) * 1.2}>
            {s}
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

// ── block diagram ───────────────────────────────────────────────────────────

function Blocks({ t, b }: Pick<StageProps, "t" | "b">) {
  const boxes: [string, number, number, number, number, number][] = [
    ["电池", 5, 30, 16, 8, b.blk],
    ["单片机", 50, 26, 22, 16, b.blk + 0.2],
    ["稳压", 27, 30, 16, 8, b.box],
    ["传感器", 50, 10, 22, 8, b.box + 0.3],
    ["Flash", 79, 22, 16, 8, b.box + 0.6],
    ["串口", 79, 38, 16, 8, b.box + 0.9],
  ]
  const ln = enter(t, b.link, 0.8)
  return (
    <>
      <T x={27} y={14} size={3} color={MUTED} o={enter(t, b.block)} anchor="start">
        系统框图
      </T>
      <Svg>
        {boxes.map(([, x, y, w, h, at]) => (
          <Box key={at} x={x} y={y} w={w} h={h} o={enter(t, at)} color={at === b.blk + 0.2 ? AMP : undefined} />
        ))}
        <Draw d="M21 34 H27" p={ln} />
        <Draw d="M43 34 H50" p={ln} stroke={VOLT} />
        <Draw d="M61 18 V26" p={ln} />
        <Draw d="M72 30 H75.5 V26 H79" p={ln} />
        <Draw d="M72 38 H75.5 V42 H79" p={ln} />
      </Svg>
      {boxes.map(([s, x, y, w, h, at]) => (
        <T key={s} x={x + w / 2} y={y + h / 2} size={2.8} weight={500} o={enter(t, at + 0.1)}>
          {s}
        </T>
      ))}
      <T x={46.5} y={30.8} size={2} color={VOLT} o={ln}>
        <M>3 V</M>
      </T>
      <T x={64.5} y={22} size={2} color={MUTED} anchor="start" o={ln}>
        <M>I²C</M>
      </T>
      <T x={87} y={34} size={2} color={MUTED} o={ln}>
        存数据
      </T>
      <T x={87} y={50} size={2} color={MUTED} o={ln}>
        导出
      </T>
    </>
  )
}

// ── part picking ────────────────────────────────────────────────────────────

function Pick({ t, b, still }: StageProps) {
  const chip = enter(t, b.pick - 0.1, 0.6)
  const items: [string, string, number, number, number, "start" | "end"][] = [
    ["供货", "买得到吗，贵不贵", b.p1, 31, 20, "end"],
    ["封装", "自己焊得了吗", b.p2, 31, 40, "end"],
    ["资料", "手册全不全", b.p3, 69, 20, "start"],
    ["参考设计", "有官方原理图吗", b.p4, 69, 40, "start"],
  ]
  return (
    <>
      <T x={50} y={13} size={3} color={MUTED} o={enter(t, b.pick)}>
        选型，看四样
      </T>
      <Svg>
        <g opacity={chip}>
          <Box x={42} y={22} w={16} h={18} />
          {[25, 29, 33, 37].map((y) => (
            <path key={y} d={`M38.5 ${y} H42 M58 ${y} H61.5`} strokeWidth={0.25} />
          ))}
          <circle cx={44.6} cy={24.6} r={0.6} fill="currentColor" stroke="none" />
        </g>
        {items.map(([, , at, x, y, a]) => (
          <Check key={at} x={a === "end" ? x + 3 : x - 3} y={y} p={enter(t, at, 0.5)} r={1.5} />
        ))}
      </Svg>
      <T x={50} y={31} size={2.6} color={MUTED} o={chip}>
        单片机
      </T>
      {items.map(([k, d, at, x, y, a]) => (
        <React.Fragment key={k}>
          <T x={x} y={y - 1.6} size={3.8} weight={600} anchor={a} o={enter(t, at)} dy={still ? 0 : (1 - enter(t, at, 0.5)) * 1}>
            {k}
          </T>
          <T x={x} y={y + 2.4} size={2.3} color={MUTED} anchor={a} o={enter(t, at + 0.2)}>
            {d}
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

// ── duty cycle ──────────────────────────────────────────────────────────────

const PX0 = 14
const PX1 = 88
const PY = 42

function Duty({ t, b, still }: StageProps) {
  const axes = enter(t, b.power, 0.9)
  const pulses = [24, 42, 60, 78]
  const first = enter(t, b.wake, 0.35)
  return (
    <>
      <T x={14} y={13} size={3} anchor="start" color={MUTED} o={enter(t, b.power)}>
        电流随时间变化
      </T>
      <Svg>
        <Draw d={`M${PX0} ${PY} H${PX1}`} p={axes} />
        <Draw d={`M${PX0} ${PY} V17`} p={axes} />
        {pulses.map((x, i) => {
          const o = i === 0 ? first : enter(t, b.wake + 0.5 + i * 0.5, 0.35)
          const h = 22 * o
          return h > 0.05 ? <rect key={x} x={x - 0.8} y={PY - h - 0.4} width={1.6} height={h} fill={AMP} stroke="none" /> : null
        })}
        <Draw d={`M${PX0} ${PY - 0.5} H${PX1}`} p={enter(t, b.sleep - 0.1, 0.9)} stroke={GOOD} strokeWidth={0.5} />
        <g opacity={enter(t, b.wake + 2.4)} strokeWidth={0.2} stroke="var(--muted-foreground)">
          <path d={`M${pulses[0]} ${PY + 3} H${pulses[1]} M${pulses[0]} ${PY + 2.2} V${PY + 3.8} M${pulses[1]} ${PY + 2.2} V${PY + 3.8}`} />
        </g>
      </Svg>
      <T x={PX0 - 1.5} y={PY - 22} size={2.2} anchor="end" color={AMP} o={first} className="tabular">
        5 mA
      </T>
      <T x={pulses[0] + 3} y={PY - 20} size={2.8} weight={600} anchor="start" color={AMP} o={first}>
        醒来 0.2 s
      </T>
      <T x={(pulses[0] + pulses[1]) / 2} y={PY + 6} size={2.2} color={MUTED} o={enter(t, b.wake + 2.4)}>
        每 60 s 一次
      </T>
      {/* under the baseline, clear of the pulses. Asleep: MCU 2 μA + sensor 3.5 μA (the lesson's numbers);
          5 mA × 0.2 s / 60 s + 5.5 μA ≈ 22 μA */}
      <T x={70} y={PY + 4} size={2.8} weight={600} color={GOOD} o={enter(t, b.sleep)} dy={still ? 0 : (1 - enter(t, b.sleep, 0.5)) * 1}>
        睡觉：约 5.5 μA
      </T>
    </>
  )
}

// ── battery life ────────────────────────────────────────────────────────────

function Life({ t, b }: StageProps) {
  // 220 mAh ÷ 22.2 μA ≈ 9900 h ≈ 413 days, as in the lesson
  const days = 413
  const bar1 = enter(t, b.days - 0.2, 1.2)
  const bar2 = enter(t, b.led, 0.5)
  const dim = 1 - 0.55 * enter(t, b.led, 0.4)
  const n = Math.round(days * bar1)
  return (
    <>
      <T x={50} y={13.5} size={3} color={MUTED} o={enter(t, b.life)}>
        续航 = 电池容量 ÷ 平均电流
      </T>
      <T x={30} y={24} size={2.4} color={MUTED} o={enter(t, b.avg - 0.1) * dim}>
        平均电流
      </T>
      <T x={30} y={30} size={5} weight={600} color={AMP} o={enter(t, b.avg) * dim} className="tabular">
        22 μA
      </T>
      <T x={70} y={24} size={2.4} color={MUTED} o={enter(t, b.cap - 0.1) * dim}>
        电池容量
      </T>
      <T x={70} y={30} size={5} weight={600} o={enter(t, b.cap) * dim} className="tabular">
        220 mAh
      </T>
      <Svg>
        <Draw d="M12 41 H88" p={enter(t, b.days - 0.3, 0.5)} stroke="var(--border)" strokeWidth={0.3} />
        <rect x={12} y={38.4} width={76 * bar1} height={2.6} rx={0.6} fill={GOOD} stroke="none" opacity={dim} />
        <rect x={12} y={46.6} width={Math.max(0.3, 76 * (9 / days) * bar2)} height={2.6} rx={0.6} fill={POWER} stroke="none" opacity={bar2 > 0.01 ? 1 : 0} />
      </Svg>
      <T x={88} y={35.2} size={3.4} anchor="end" weight={600} color={GOOD} o={enter(t, b.days - 0.1) * dim} className="tabular">
        {n} 天
      </T>
      <T x={12} y={44} size={2.4} anchor="start" color={POWER} o={bar2}>
        指示灯常亮
      </T>
      <T x={88} y={44} size={3.4} anchor="end" weight={600} color={POWER} o={enter(t, b.few)}>
        只剩几天
      </T>
    </>
  )
}

// ── schematic checklist ─────────────────────────────────────────────────────

function Checklist({ t, b }: Pick<StageProps, "t" | "b">) {
  const rows: [string, string, number][] = [
    ["电源", "每路电压对不对，有没有防反接", b.c1],
    ["去耦", "每个电源脚旁边一颗 100 nF", b.c2],
    ["上拉", "I²C、复位、开漏输出", b.c3],
    ["测试点", "留下表笔能碰到的地方", b.c4],
  ]
  return (
    <>
      <T x={50} y={13} size={3} color={MUTED} o={enter(t, b.check)}>
        原理图检查清单
      </T>
      <Svg>
        {rows.map(([k, , at], i) => (
          <Check key={k} x={21} y={21 + i * 8.5} p={enter(t, at, 0.5)} r={1.8} />
        ))}
      </Svg>
      {rows.map(([k, d, at], i) => {
        const o = 0.3 + 0.7 * enter(t, at)
        return (
          <React.Fragment key={k}>
            <T x={27} y={21 + i * 8.5} size={4} weight={600} anchor="start" o={enter(t, b.check + 0.2 + i * 0.1) * o}>
              {k}
            </T>
            <T x={47} y={21 + i * 8.5} size={2.6} color={MUTED} anchor="start" o={enter(t, b.check + 0.3 + i * 0.1) * o}>
              {d}
            </T>
          </React.Fragment>
        )
      })}
    </>
  )
}

// ── first power-up ──────────────────────────────────────────────────────────

function PowerUp({ t, b, still }: StageProps) {
  const sup = enter(t, b.first, 0.5)
  const lit = [b.one, b.one + 0.7, b.one + 1.4, b.one + 2.1].map((at) => enter(t, at, 0.4))
  const blocks: [string, number, number][] = [
    ["电源", 50, 19],
    ["单片机", 72, 19],
    ["传感器", 50, 32],
    ["Flash", 72, 32],
  ]
  const phase = still ? 0 : t * 6
  const wire = enter(t, b.lim - 0.3, 0.6)
  const bat = enter(t, b.bat, 0.5)
  return (
    <>
      <Svg>
        <Box x={6} y={20} w={26} h={20} o={sup} />
        <Draw d="M32 29 H46" p={wire} />
        <Flow x0={32} y0={29} x1={46} y1={29} phase={phase} spacing={2.6} o={wire} />
        <Box x={46} y={14} w={46} h={34} o={sup} dash="1 0.8" sw={0.25} />
        {blocks.map(([, x, y], i) => (
          <Box key={x + y} x={x} y={y} w={18} h={10} o={sup} color={GOOD} fill={0.18 * lit[i]} sw={0.3 + 0.2 * lit[i]} />
        ))}
        <g opacity={bat} stroke={POWER}>
          <circle cx={19} cy={48} r={2.6} />
          <path d="M16.2 45.2 L21.8 50.8 M21.8 45.2 L16.2 50.8" />
        </g>
      </Svg>
      <T x={19} y={23.2} size={2.4} color={MUTED} o={sup}>
        可调电源
      </T>
      <T x={19} y={30} size={4.4} weight={600} color={VOLT} o={sup} className="tabular">
        3.3 V
      </T>
      <T x={19} y={36} size={2.6} weight={600} color={AMP} o={enter(t, b.lim - 0.1)} className="tabular">
        限流 50 mA
      </T>
      {blocks.map(([s, x, y], i) => (
        <T key={s} x={x + 9} y={y + 5} size={2.6} weight={500} o={sup} color={lit[i] > 0.5 ? undefined : MUTED}>
          {s}
        </T>
      ))}
      <T x={27} y={48} size={2.4} anchor="start" color={POWER} o={bat}>
        先别装电池
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "从需求到电路：设计流程",
  audio,
  timing,
  poster: 3.6,
  Stage,
}

export default function DesignFlowFilm() {
  return <FilmPlayer film={film} />
}
