import * as React from "react"
import { Capacitor, Chip, Diode, Led, Resistor, Switch } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Scene, Svg, Sym, T, enter, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, FG, GOOD, Hl, MUTED, SECOND, VOLT, riseAt } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * 原理图怎么读, ~55 s. Scenes, each keyed to its line:
 *   title → connections only (schematic vs board) → net labels join → crossings with / without a dot
 *   → one small board, read block by block (power, ground, MCU, input, output, I²C) with the drawing habits
 *   → R3 on the schematic, in the BOM, on the silkscreen → "walk it, pick SDA".
 */
function Stage({ t, b, still }: StageProps) {
  const title = span(t, 0.25, b.conn - 0.45)
  const conn = span(t, b.conn - 0.25, b.label - 0.35)
  const label = span(t, b.label - 0.25, b.cross - 0.45)
  const cross = span(t, b.cross - 0.25, b.order - 0.45)
  const board = span(t, b.order - 0.25, b.bom - 0.45)
  const bom = span(t, b.bom - 0.25, b.outro - 0.4)
  const outro = enter(t, b.outro - 0.1, 0.5)
  const rise = (at: number, d = 1.6) => riseAt(t, at, still, d)

  return (
    <>
      <Scene o={title}>
        <T x={50} y={19} size={8} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          原理图怎么读
        </T>
        <T x={50} y={28.5} size={2.8} color={MUTED} o={enter(t, b.intro + 1.0)}>
          按功能，一块一块读
        </T>
        <Svg>
          <g opacity={enter(t, b.intro + 1.2)}>
            <Draw d="M12 38 H88" p={enter(t, b.intro + 1.3, 1.2)} />
            <Sym x={28} y={38} scale={0.22}>
              <Resistor x={0} y={0} />
            </Sym>
            <Sym x={50} y={38} scale={0.22}>
              <Capacitor x={0} y={0} />
            </Sym>
            <Sym x={72} y={38} scale={0.22}>
              <Led x={0} y={0} />
            </Sym>
          </g>
        </Svg>
      </Scene>

      <Scene o={conn}>
        <Conn t={t} b={b} still={still} />
      </Scene>

      <Scene o={label}>
        <Labels t={t} b={b} still={still} />
      </Scene>

      <Scene o={cross}>
        <Cross t={t} b={b} still={still} />
      </Scene>

      <Scene o={board}>
        <Board t={t} b={b} still={still} />
      </Scene>

      <Scene o={bom}>
        <Bom t={t} b={b} still={still} />
      </Scene>

      <Scene o={outro}>
        <T x={50} y={16} size={6} weight={600} dy={rise(b.outro)}>
          走一遍这块板
        </T>
        <T x={50} y={24} size={2.8} color={MUTED} o={enter(t, b.sda - 0.4)} dy={rise(b.sda - 0.4, 1)}>
          选 SDA，看那根没画的线
        </T>
        <Svg>
          <path d="M37 36 H63" stroke={SECOND} strokeWidth={0.3} strokeDasharray="1.2 1" opacity={enter(t, b.sda)} />
          <g opacity={enter(t, b.sda + 0.4)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
            <path d="M50 42 V49 M47.6 46.6 L50 49 L52.4 46.6" />
          </g>
        </Svg>
        <Tag x={30} y={36} o={enter(t, b.outro + 0.5)} color={SECOND}>
          SDA
        </Tag>
        <Tag x={70} y={36} o={enter(t, b.outro + 0.7)} color={SECOND}>
          SDA
        </Tag>
      </Scene>
    </>
  )
}

/** A net label: its name in a pill. */
function Tag({ x, y, o, color = SECOND, anchor = "middle", children }: { x: number; y: number; o: number; color?: string; anchor?: "start" | "middle" | "end"; children: React.ReactNode }) {
  return (
    <T x={x} y={y} size={2.8} weight={600} color={color} o={o} anchor={anchor} className="rounded-sm border border-current px-[0.6em] py-[0.3em]">
      {children}
    </T>
  )
}

// ── schematic vs board ───────────────────────────────────────────────────────

function Conn({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const sch = enter(t, b.conn, 0.5)
  const wire = enter(t, b.links - 0.1, 0.6)
  // the board comes in on "不画它们在板子上的", so the far-apart parts are seen while it is said
  const board = enter(t, b.pos - 1.5, 0.6)
  const trace = enter(t, b.pos - 1.0, 1.2)
  return (
    <>
      <T x={25} y={13} size={2.6} color={MUTED} o={sch}>
        原理图
      </T>
      <Svg>
        <Sym x={12} y={30} scale={0.26} opacity={sch}>
          <Resistor x={0} y={0} />
        </Sym>
        <Sym x={33} y={30} scale={0.26} opacity={sch}>
          <Chip x={0} y={0} w={44} h={52} left={[" "]} right={[" ", " "]} pitch={18} label="U1" />
        </Sym>
        <Draw d="M19.8 30 H24" p={wire} stroke={AMP} strokeWidth={0.5} />
        <Hl x={4} y={22} w={44} h={16} o={wire} color={AMP} dash />
        {/* the board: the same two parts, far apart */}
        <g opacity={board}>
          <rect x={56} y={16} width={38} height={28} rx={1.5} stroke={MUTED} />
          <rect x={59} y={19.5} width={5} height={2.4} fill={MUTED} stroke="none" />
          <rect x={85} y={36} width={6} height={6} fill={MUTED} stroke="none" />
        </g>
        <Draw d="M64 20.7 C72 20.7 74 38 85 39" p={trace} stroke={AMP} strokeWidth={0.5} />
      </Svg>
      <T x={25} y={44} size={2.6} o={enter(t, b.links)} color={AMP} weight={600}>
        挨在一起，相连
      </T>
      <T x={75} y={13} size={2.6} color={MUTED} o={board}>
        电路板
      </T>
      <T x={63} y={26} size={2.4} o={board}>
        R1
      </T>
      <T x={88} y={32.5} size={2.4} o={board}>
        U1
      </T>
      <T x={75} y={49} size={2.6} o={enter(t, b.pos - 0.2)} dy={rise(b.pos - 0.2, 1)} weight={600}>
        实际隔得很远
      </T>
    </>
  )
}

// ── net labels ───────────────────────────────────────────────────────────────

function Labels({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const chips = enter(t, b.label, 0.5)
  const lab = enter(t, b.lab, 0.4)
  const join = enter(t, b.join - 0.1, 0.7)
  const pulse = still ? 1 : 0.55 + 0.45 * Math.sin((t - b.join) * 6)
  return (
    <>
      <Svg>
        <g opacity={chips}>
          <Sym x={20} y={28} scale={0.26}>
            <Chip x={0} y={0} w={60} h={60} right={["PC0", "PC1", "PC2"]} pitch={18} />
          </Sym>
          <Sym x={80} y={28} scale={0.26}>
            <Chip x={0} y={0} w={60} h={60} left={["VDD", "SDA", "GND"]} pitch={18} />
          </Sym>
        </g>
        {/* PC1 leaves the chip at (20 + (25+14)*.26, 28), SDA enters at (80 - 39*.26, 28) */}
        <Draw d="M31.4 28 H34" p={lab} stroke={SECOND} strokeWidth={0.4} />
        <Draw d="M66 28 H68.6" p={lab} stroke={SECOND} strokeWidth={0.4} />
        <path d="M44 28 C48 22 52 22 56 28" stroke={SECOND} strokeWidth={0.3} strokeDasharray="1.2 1" opacity={join * (still ? 0.8 : pulse)} />
      </Svg>
      <T x={20} y={17} size={2.6} weight={600} o={chips}>
        单片机
      </T>
      <T x={80} y={17} size={2.6} weight={600} o={chips}>
        传感器
      </T>
      <Tag x={34.5} y={28} o={lab} anchor="start">
        SDA
      </Tag>
      <Tag x={65.5} y={28} o={enter(t, b.lab + 0.3, 0.4)} anchor="end">
        SDA
      </Tag>
      <T x={50} y={40} size={2.6} color={MUTED} o={span(t, b.far, b.lab + 0.6, 0.4, 0.3)} dy={rise(b.far, 1)}>
        隔得远，中间一根线都没有
      </T>
      <T x={50} y={40} size={2.8} weight={600} color={SECOND} o={enter(t, b.join)} dy={rise(b.join, 1)}>
        同名网络标号，就是同一个网络
      </T>
      <T x={20} y={46} size={2.4} color={MUTED} o={enter(t, b.far + 0.3)}>
        PC1 是引脚名
      </T>
      <T x={80} y={46} size={2.4} color={MUTED} o={enter(t, b.far + 0.3)}>
        SDA 是网络名
      </T>
    </>
  )
}

// ── crossings ────────────────────────────────────────────────────────────────

function Cross({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const l = enter(t, b.cross + 0.1, 0.6)
  const dot = enter(t, b.dot - 0.1, 0.3)
  const r = enter(t, b.cross + 0.4, 0.6)
  const no = enter(t, b.nodot - 0.1, 0.3)
  return (
    <>
      <Svg>
        <g opacity={l}>
          <path d="M10 30 H40 M25 17 V43" />
        </g>
        <circle cx={25} cy={30} r={1.1 * dot} fill={GOOD} stroke="none" />
        <g opacity={r}>
          <path d="M60 30 H72.5 a2.5 2.5 0 0 1 5 0 H90 M75 17 V43" />
        </g>
        <Hl x={19} y={24} w={12} h={12} o={dot} color={GOOD} />
        <Hl x={69} y={24} w={12} h={12} o={no} color={MUTED} />
      </Svg>
      <T x={25} y={50} size={3.2} weight={600} color={GOOD} o={dot} dy={rise(b.dot, 1)}>
        有圆点：相连
      </T>
      <T x={75} y={50} size={3.2} weight={600} color={MUTED} o={no} dy={rise(b.nodot, 1)}>
        没有圆点：跨过去
      </T>
      <T x={25} y={11} size={2.6} color={MUTED} o={l}>
        交叉
      </T>
      <T x={75} y={11} size={2.6} color={MUTED} o={r}>
        交叉
      </T>
    </>
  )
}

// ── one small board, read block by block ─────────────────────────────────────

const RAIL = 8
const GND = 47

function Board({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const w = enter(t, b.order, 1.8)
  const parts = enter(t, b.order + 0.2, 0.8)
  // each block's highlight lights up on its word and stays dim after the next one comes
  const steps = [b.pwr, b.gnd, b.mcu, b.in, b.out, b.comm, b.habit]
  const hl = (i: number) => enter(t, steps[i], 0.35) * (0.35 + 0.65 * (1 - enter(t, steps[i + 1], 0.35)))
  const habits = enter(t, b.lr - 0.1, 0.5)
  const up = enter(t, b.up - 0.1, 0.5)
  const sda = enter(t, b.comm, 0.4)
  return (
    <>
      <Svg>
        {/* rails and wires */}
        <Draw d={`M26 ${RAIL} H90`} p={w} stroke={VOLT} />
        <Draw d={`M26 ${RAIL} V26 H23.7`} p={w} />
        <Draw d={`M50 ${RAIL} V19.9`} p={w} />
        <Draw d={`M86 ${RAIL} V9.8`} p={w} />
        <Draw d={`M4 26 H8.3`} p={w} />
        <Draw d={`M16 34.2 V${GND}`} p={w} />
        <Draw d={`M16 ${GND} H88`} p={w} stroke={MUTED} />
        <Draw d={`M50 40.1 V${GND}`} p={w} />
        <Draw d={`M86 26.2 V${GND}`} p={w} />
        <Draw d={`M32 ${GND - 1} V30 H41.4`} p={w} />
        <Draw d="M58.6 33.8 H64 M76 33.8 H80" p={w} />
        <Draw d={`M80 45.8 V${GND}`} p={w} />
        <Draw d="M58.6 26.2 H61 M76 20 H78.3" p={w} stroke={SECOND} />
        <circle cx={50} cy={GND} r={0.6} fill={FG} stroke="none" opacity={w} />
        <circle cx={16} cy={GND} r={0.6} fill={FG} stroke="none" opacity={w} />
        <circle cx={86} cy={GND} r={0.6} fill={FG} stroke="none" opacity={w} />
        <circle cx={80} cy={GND} r={0.6} fill={FG} stroke="none" opacity={w} />
        <circle cx={32} cy={GND} r={0.6} fill={FG} stroke="none" opacity={w} />
        <circle cx={50} cy={RAIL} r={0.6} fill={VOLT} stroke="none" opacity={w} />
        <circle cx={86} cy={RAIL} r={0.6} fill={VOLT} stroke="none" opacity={w} />
        <circle cx={4} cy={26} r={0.9} fill="var(--background)" opacity={parts} />

        {/* parts */}
        <g opacity={parts}>
          <Sym x={16} y={26} scale={0.24}>
            <Chip x={0} y={0} w={36} h={40} left={[" "]} right={[" "]} bottom={[" "]} label="3.3" />
          </Sym>
          <Sym x={50} y={30} scale={0.24}>
            <Chip x={0} y={0} w={44} h={56} top={[" "]} bottom={[" "]} left={[" "]} right={[" ", "", " "]} pitch={16} label="MCU" />
          </Sym>
          <Sym x={86} y={18} scale={0.24}>
            <Chip x={0} y={0} w={36} h={40} left={[" "]} top={[" "]} bottom={[" "]} />
          </Sym>
          <Sym x={32} y={40} scale={0.2}>
            <Switch x={0} y={0} rot={90} />
          </Sym>
          <Sym x={70} y={33.8} scale={0.2}>
            <Resistor x={0} y={0} />
          </Sym>
          <Sym x={80} y={39.8} scale={0.2}>
            <Led x={0} y={0} rot={90} />
          </Sym>
        </g>

        {/* highlights */}
        <Hl x={1} y={RAIL + 3} w={26.6} h={27} o={hl(0)} color={VOLT} dash />
        <path d={`M16 ${GND} H88`} stroke={FG} strokeWidth={0.9} opacity={hl(1)} />
        <Hl x={40} y={18.2} w={20} h={24} o={hl(2)} color={AMP} />
        <Hl x={28.5} y={29} w={7} h={19} o={hl(3)} color={GOOD} dash />
        <Hl x={62} y={29.5} w={22} h={18.5} o={hl(4)} color={GOOD} dash />
        <Hl x={77} y={9.2} w={18} h={20} o={hl(5)} color={SECOND} dash />

        {/* habits: signal left to right, supply on top, ground below */}
        <g opacity={habits} stroke={MUTED} strokeWidth={0.3}>
          <path d="M12 52 H39 M61 52 H85 M82.6 50.6 L85 52 L82.6 53.4" />
        </g>
        <path d={`M26 ${RAIL} H90`} stroke={VOLT} strokeWidth={0.9} opacity={up * 0.9} />
      </Svg>

      <T x={2.5} y={RAIL + 5.2} size={2.4} weight={600} anchor="start" color={VOLT} o={hl(0)}>
        电源
      </T>
      <T x={2.5} y={30.5} size={2.2} color={MUTED} o={parts} anchor="start">
        USB 5V
      </T>
      <T x={93} y={RAIL} size={2.4} weight={600} color={VOLT} o={w}>
        3V3
      </T>
      <T x={6} y={GND} size={2.4} weight={600} o={w}>
        GND
      </T>
      <T x={50} y={51} size={2.4} weight={600} color={FG} o={hl(1) * (1 - enter(t, b.lr - 0.1, 0.3))}>
        地：每个芯片都要接
      </T>
      <T x={44} y={15.8} size={2.4} weight={600} color={AMP} o={hl(2)}>
        主芯片
      </T>
      <T x={24} y={40} size={2.4} weight={600} color={GOOD} o={hl(3)}>
        输入
      </T>
      <T x={73} y={26} size={2.4} weight={600} color={GOOD} o={hl(4)}>
        输出
      </T>
      <T x={90.5} y={32} size={2.4} weight={600} color={SECOND} o={hl(5)}>
        通信
      </T>
      <T x={61} y={23.8} size={2.4} weight={600} color={SECOND} o={sda} anchor="start">
        SDA
      </T>
      <T x={75.8} y={17.6} size={2.4} weight={600} color={SECOND} o={sda} anchor="end">
        SDA
      </T>
      <T x={50} y={52} size={2.4} color={MUTED} o={habits} dy={rise(b.lr, 0.8)}>
        信号 左进右出
      </T>
      <T x={62} y={3.8} size={2.4} weight={600} color={VOLT} o={up} dy={rise(b.up, 0.8)}>
        电源在上
      </T>
      <T x={93.5} y={GND} size={2.4} weight={600} o={up} dy={rise(b.up, 0.8)}>
        地在下
      </T>
    </>
  )
}

// ── schematic ↔ BOM ↔ silkscreen ─────────────────────────────────────────────

function Bom({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const sch = enter(t, b.bom, 0.5)
  const ref = enter(t, b.ref, 0.4)
  const row = enter(t, b.bomRow, 0.5)
  const pcb = enter(t, b.pcb - 0.2, 0.5)
  return (
    <>
      <Svg>
        <Sym x={18} y={31} scale={0.3} opacity={sch}>
          <Resistor x={0} y={0} />
        </Sym>
        <g stroke="var(--border)" strokeWidth={0.15} opacity={row}>
          <path d="M33 26 H67 M33 33.5 H67" />
        </g>
        <g opacity={pcb}>
          <rect x={73} y={21} width={20} height={20} rx={1.2} stroke={MUTED} />
          <rect x={77} y={30} width={2.4} height={2.2} fill={MUTED} stroke="none" />
          <rect x={86.6} y={30} width={2.4} height={2.2} fill={MUTED} stroke="none" />
        </g>
        <Hl x={78} y={26} w={10} h={9} o={pcb} color={VOLT} />
        <Hl x={14} y={21} w={9} h={7} o={ref} color={VOLT} />
      </Svg>
      <T x={18} y={24.5} size={3.4} weight={600} color={VOLT} o={sch}>
        R3
      </T>
      <T x={18} y={41} size={2.6} color={MUTED} o={sch}>
        10k
      </T>
      <T x={18} y={13} size={2.6} color={MUTED} o={sch}>
        原理图
      </T>
      <T x={50} y={13} size={2.6} color={MUTED} o={row} dy={rise(b.bomRow, 1)}>
        物料清单
      </T>
      <T x={39} y={22.5} size={2.2} color={MUTED} o={row}>
        位号
      </T>
      <T x={50} y={22.5} size={2.2} color={MUTED} o={row}>
        阻值
      </T>
      <T x={61} y={22.5} size={2.2} color={MUTED} o={row}>
        封装
      </T>
      <T x={39} y={30} size={3.2} weight={600} color={VOLT} o={row}>
        R3
      </T>
      <T x={50} y={30} size={3.2} o={row} className="tabular">
        10 kΩ
      </T>
      <T x={61} y={30} size={3.2} o={row} className="tabular">
        0603
      </T>
      <T x={83} y={13} size={2.6} color={MUTED} o={pcb} dy={rise(b.pcb - 0.2, 1)}>
        电路板丝印
      </T>
      <T x={83} y={36.6} size={2.4} weight={600} color={VOLT} o={pcb}>
        R3
      </T>
      <T x={50} y={49} size={2.6} color={MUTED} o={enter(t, b.pcb + 0.2)} dy={rise(b.pcb + 0.2, 1)}>
        三处靠同一个位号对应
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "原理图怎么读",
  audio,
  timing,
  poster: 3.6,
  Stage,
}

export default function ReadingSchematicsFilm() {
  return <FilmPlayer film={film} />
}

void Diode
