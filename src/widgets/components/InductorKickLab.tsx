import * as React from "react"
import {
  Battery,
  Diode,
  Inductor,
  Junction,
  Lab,
  LabControls,
  LabNote,
  LabReadouts,
  LabStage,
  Label,
  PlayButton,
  Plot,
  Readout,
  Resistor,
  Schematic,
  SliderField,
  Switch,
  SwitchField,
  Wire,
  formatSI,
  trace,
  useFrame,
  usePlayback,
} from "@/lab"

const VS = 12
/** Forward drop of the freewheel diode. */
const VF = 0.7
/**
 * With no diode the voltage across the opening switch climbs until something
 * gives: here the contact gap is taken to break down (arc) at 350 V.
 */
const VBD = 350
/** Seconds of circuit time on each side of the switch event. */
const HALF = 5e-3
/** Slow motion: one second on screen is one millisecond in the circuit. */
const SLOW = 1e-3

interface Wave {
  /** Coil current, t seconds after the switch moved. */
  i: (t: number) => number
  /** Voltage across the switch. */
  v: (t: number) => number
  /** When the coil runs out of current (open switch only). */
  tEnd: number
}

/** Switch closed: L·di/dt = Vs − i·R, so the current climbs towards Vs / R with τ = L / R. */
function closedWave(i0: number, r: number, l: number): Wave {
  const tau = l / r
  const iFinal = VS / r
  return { i: (t) => iFinal + (i0 - iFinal) * Math.exp(-t / tau), v: () => 0, tEnd: Infinity }
}

/**
 * Switch open: the coil keeps its current flowing through whatever clamps it,
 * the diode (0.7 V) or the arc across the contacts (VBD − Vs), until it runs dry:
 * L·di/dt = −(Vclamp + i·R). A low clamp voltage means a slow, gentle decay; a
 * high one means the current is gone in microseconds.
 */
function openWave(i0: number, r: number, l: number, diode: boolean): Wave {
  const tau = l / r
  const vClamp = diode ? VF : VBD - VS
  const tEnd = i0 > 1e-9 ? tau * Math.log(1 + (i0 * r) / vClamp) : 0
  return {
    i: (t) => (t < tEnd ? Math.max(0, (i0 + vClamp / r) * Math.exp(-t / tau) - vClamp / r) : 0),
    v: (t) => (t < tEnd ? VS + vClamp : VS),
    tEnd,
  }
}

/** Sample times across [ta, tb], with extra points inside a short spike and on both sides of its end. */
function sampleTimes(w: Wave, ta: number, tb: number, n = 60): number[] {
  if (!(tb > ta)) return [ta]
  const ts = Array.from({ length: n + 1 }, (_, k) => ta + ((tb - ta) * k) / n)
  if (w.tEnd > ta && w.tEnd < tb) {
    for (let k = 1; k < 8; k++) if ((w.tEnd * k) / 8 > ta) ts.push((w.tEnd * k) / 8)
    ts.push(w.tEnd * (1 - 1e-9), w.tEnd)
  }
  return ts.sort((a, b) => a - b)
}

const INITIAL_PREV = { dur: HALF, i0: 0 }
/** Start with the event already played out, so the first picture is the complete turn-off. */
const FINISHED = 1

/**
 * A coil (L in series with its winding resistance R) switched on and off, with
 * and without a freewheel diode. Shown like a scope triggered on the switch:
 * the 5 ms before it moved on the left, what follows on the right, in slow motion.
 */
export function InductorKickLab() {
  const [l, setL] = React.useState(0.1)
  const [r, setR] = React.useState(120)
  const [diode, setDiode] = React.useState(false)
  const [closed, setClosed] = React.useState(false)
  /** The phase before the last switch event: how long it lasted and the coil current when it began. */
  const [prev, setPrev] = React.useState(INITIAL_PREV)
  /** Circuit seconds since the switch last moved. */
  const [el, setEl] = React.useState(FINISHED)
  const playback = usePlayback()

  const tau = l / r
  const prevWave = closed ? openWave(prev.i0, r, l, diode) : closedWave(prev.i0, r, l)
  /** Coil current at the instant the switch moved: the same just before and just after. */
  const i0 = prevWave.i(prev.dur)
  const wave = closed ? closedWave(i0, r, l) : openWave(i0, r, l, diode)
  const limit = Math.max(HALF, closed ? 8 * tau : wave.tEnd * 1.02)
  useFrame((dt) => setEl((e) => Math.min(limit, e + dt * SLOW)), playback.playing && el < limit)

  const t = Math.min(el, limit)
  const iNow = wave.i(t) < 1e-6 ? 0 : wave.i(t)
  const vNow = wave.v(t)
  const kicked = !closed && i0 > 1e-3
  const arcing = kicked && !diode && t < 0.3e-3
  const iBattery = closed || !diode ? iNow : 0
  const iDiode = !closed && diode ? iNow : 0

  const flip = () => {
    setPrev({ dur: t, i0 })
    setClosed(!closed)
    setEl(0)
  }
  const restart = () => setEl(0)

  // the plotted window: [−5 ms, 0] is the tail of the previous phase, [0, now] the current one
  const tShown = Math.min(t, HALF)
  const pts: { x: number; i: number; v: number }[] = []
  if (prev.dur < HALF) {
    // before the previous phase began, the switch sat where it is now
    const before = { i: prev.i0, v: closed ? 0 : VS }
    pts.push({ x: -HALF * 1e3, ...before }, { x: -prev.dur * 1e3, ...before })
  }
  for (const tp of sampleTimes(prevWave, Math.max(0, prev.dur - HALF), prev.dur)) pts.push({ x: (tp - prev.dur) * 1e3, i: prevWave.i(tp), v: prevWave.v(tp) })
  for (const tc of sampleTimes(wave, 0, tShown)) pts.push({ x: tc * 1e3, i: wave.i(tc), v: wave.v(tc) })

  const xAxis = { min: -HALF * 1e3, max: HALF * 1e3, label: "时间 (ms)" }
  const event = { x: 0, label: closed ? "合上开关" : "断开开关" }

  return (
    <Lab
      title="线圈的断电尖峰"
      hint="慢放 1000 倍：屏幕上的 1 秒是电路里的 1 毫秒。合上开关，等电流升上去再断开；然后加上续流二极管重做一遍。"
      actions={<PlayButton playback={playback} />}
      onReset={() => {
        setL(0.1)
        setR(120)
        setDiode(false)
        setClosed(false)
        setPrev(INITIAL_PREV)
        setEl(FINISHED)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
            Battery (40,110) vertical: + (40,80), − (40,140). Top rail y = 30.
            Coil on the right: L (230,60) vertical (230,30) – (230,90), then R (230,120) (230,90) – (230,150).
            Diode (170,90) rot 270: anode (170,120) at the bottom, cathode (170,60) towards the + rail.
            Switch (140,170) on the bottom rail: (110,170) – (170,170).
          */}
          <Schematic width={300} height={205} label={`12 V 电源、开关和一个线圈（电感 L 串联线圈电阻 R）${diode ? "，线圈两端反向并联一只续流二极管" : ""}`}>
            <Wire points={[[40, 80], [40, 30], [170, 30]]} current={iBattery} scale={0.2} />
            <Wire points={[[170, 30], [230, 30]]} current={iNow} scale={0.2} />
            <Wire points={[[230, 150], [230, 170], [170, 170]]} current={iBattery} scale={0.2} />
            <Wire points={[[110, 170], [40, 170], [40, 140]]} current={iBattery} scale={0.2} />
            <g opacity={diode ? undefined : 0.3}>
              <Wire points={[[230, 150], [170, 150], [170, 120]]} current={iDiode} scale={0.2} />
              <Wire points={[[170, 60], [170, 30]]} current={iDiode} scale={0.2} />
              <Diode x={170} y={90} rot={270} label="续流" value="二极管" labelSide="left" />
            </g>
            {diode && <Junction x={170} y={30} />}
            {diode && <Junction x={230} y={150} />}
            <rect x={214} y={36} width={82} height={108} rx={4} stroke="var(--muted-foreground)" strokeWidth={1.25} strokeDasharray="4 4" />
            <Label x={268} y={26} muted>
              线圈
            </Label>
            <Battery x={40} y={110} rot={90} label={`${VS} V`} />
            <Inductor x={230} y={60} rot={90} label="L" value={formatSI(l, "H")} />
            <Resistor x={230} y={120} rot={90} label="R" value={formatSI(r, "Ω")} />
            <Switch x={140} y={170} closed={closed} onClick={flip} />
            {arcing && (
              <>
                <path d="M153 152v4M153 164v3M145 160h4M157 160h4M147.5 154.5l2.5 2.5M158.5 154.5l-2.5 2.5M158.5 165.5l-2.5 -2.5" stroke={trace.power} />
                <Label x={141} y={152} anchor="end" color={trace.power}>
                  电弧
                </Label>
              </>
            )}
            <Label x={140} y={194} color={trace.voltage}>
              开关两端 {formatSI(vNow, "V")}
            </Label>
          </Schematic>
          <div className="flex min-w-0 flex-col gap-3">
            <Plot
              height={160}
              x={xAxis}
              y={{ min: 0, max: 250, label: "线圈电流 (mA)" }}
              series={[{ points: pts.map((p) => [p.x, p.i * 1e3] as const), label: "线圈电流", color: trace.current }]}
              lines={[event]}
              markers={[
                ...(closed ? [] : [{ x: 0, y: i0 * 1e3, label: formatSI(i0, "A") }]),
                { x: tShown * 1e3, y: iNow * 1e3, color: trace.current },
              ]}
            />
            <Plot
              height={160}
              x={xAxis}
              y={{ min: 0, max: 400, label: "开关两端电压 (V)" }}
              series={[{ points: pts.map((p) => [p.x, p.v] as const), label: "开关两端电压", color: trace.voltage }]}
              lines={[event, { y: VS, label: `电源 ${VS} V` }]}
              markers={[
                ...(kicked ? [{ x: 0, y: wave.v(0), label: formatSI(wave.v(0), "V") }] : []),
                { x: tShown * 1e3, y: vNow, color: trace.voltage },
              ]}
            />
          </div>
        </div>
      </LabStage>
      <LabControls>
        <SliderField
          label="电感 L"
          value={l}
          onChange={(v) => {
            setL(v)
            restart()
          }}
          min={0.02}
          max={0.5}
          log
          unit="H"
        />
        <SliderField
          label="线圈电阻 R"
          value={r}
          onChange={(v) => {
            setR(v)
            restart()
          }}
          min={60}
          max={480}
          log
          unit="Ω"
        />
        <SwitchField label="合上开关" checked={closed} onChange={(on) => on !== closed && flip()} />
        <SwitchField
          label="加续流二极管"
          hint="反向并联在线圈两端"
          checked={diode}
          onChange={(on) => {
            setDiode(on)
            restart()
          }}
        />
      </LabControls>
      <LabReadouts>
        <Readout label="时间常数 τ = L ÷ R" value={formatSI(tau, "s")} />
        <Readout label="稳态电流 V ÷ R" value={formatSI(VS / r, "A")} />
        <Readout label="线圈电流" value={formatSI(iNow, "A")} color={trace.current} />
        <Readout label="开关两端电压" value={formatSI(vNow, "V")} color={trace.voltage} />
        <Readout label="线圈储能 ½LI²" value={formatSI(0.5 * l * iNow * iNow, "J")} />
      </LabReadouts>
      {closed ? (
        <LabNote>
          开关合上：电流不会一步到位，按 τ = L ÷ R = {formatSI(tau, "s")} 往上爬，大约 5τ 后稳定在 V ÷ R = {formatSI(VS / r, "A")}。电感越大、线圈电阻越小，爬得越慢。
        </LabNote>
      ) : !kicked ? (
        <LabNote>断开的时候线圈里还没有电流，所以什么也没发生。先合上开关，等电流升上去再断开。</LabNote>
      ) : diode ? (
        <LabNote tone="good">
          有续流二极管：{formatSI(i0, "A")} 的电流改道走二极管，在线圈里绕圈，用 {formatSI(wave.tEnd, "s")} 慢慢耗尽。开关两端只比电源高一个二极管压降：{VS} V + {VF} V = {formatSI(VS + VF, "V")}。
        </LabNote>
      ) : (
        <LabNote tone="bad">
          没有续流二极管：{formatSI(i0, "A")} 的电流无路可走，约 {formatSI(wave.tEnd, "s", 2)} 就被掐断。线圈为了不让电流突变，把开关两端推到约 {VBD} V（这里按触点间隙在这个电压被击穿、拉出电弧来算），是电源电压的 {Math.round(VBD / VS)} 倍。换成三极管当开关，它会被击穿。
        </LabNote>
      )}
    </Lab>
  )
}
