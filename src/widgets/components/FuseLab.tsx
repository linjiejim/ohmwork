import * as React from "react"
import { Battery, Button, ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Readout, Resistor, Schematic, SliderField, SwitchField, Wire, clamp, fixed, formatSI, percent, trace, useFrame } from "@/lab"

const VS = 12
/** The fuse's rated current: what it carries forever. */
const RATED = 2
/** Below this the element never gets hot enough to melt (a little above the rating, as on real fuses). */
const MIN_FUSING = 1.25 * RATED
/** Thermal time constant of the fuse element, seconds. */
const TAU_FUSE = 3
/** The most this wire can carry continuously before its insulation overheats. */
const WIRE_LIMIT = 5
/** The wire is much heavier than the fuse element, so it warms more slowly. */
const TAU_WIRE = 6

const INITIAL = { heat: 0, wire: 0, blown: false }

/**
 * A fuse between the supply and a load that can be made to draw too much.
 * Model: element and wire are each one thermal mass heated by I²R, so their
 * temperature rise follows dθ/dt = ((I / Ilimit)² − θ) / τ, with θ = 1 the
 * melting point of the element (or the limit of the wire's insulation).
 * From cold the fuse opens after t = −τ·ln(1 − (Imin / I)²): the more current, the sooner.
 */
export function FuseLab() {
  const [load, setLoad] = React.useState(1.5)
  const [fitted, setFitted] = React.useState(true)
  const [sim, setSim] = React.useState(INITIAL)

  const open = fitted && sim.blown
  const i = open ? 0 : load
  const heatTarget = fitted ? (i / MIN_FUSING) ** 2 : 0
  const wireTarget = (i / WIRE_LIMIT) ** 2
  const moving = Math.abs(sim.heat - heatTarget) > 1e-3 || Math.abs(sim.wire - wireTarget) > 1e-3
  useFrame((dt) => {
    setSim((s) => {
      const heat = s.heat + (heatTarget - s.heat) * (1 - Math.exp(-dt / TAU_FUSE))
      const wire = s.wire + (wireTarget - s.wire) * (1 - Math.exp(-dt / TAU_WIRE))
      return { heat, wire, blown: s.blown || (fitted && heat >= 1) }
    })
  }, moving)

  const willBlow = load > MIN_FUSING
  const blowTime = willBlow ? -TAU_FUSE * Math.log(1 - (MIN_FUSING / load) ** 2) : Infinity
  const blowText = blowTime < 1 ? `约 ${fixed(blowTime, 2)} s` : `约 ${fixed(blowTime, 1)} s`
  const wireHot = sim.wire >= 1
  const glow = clamp(sim.heat, 0, 1)

  let tone: "neutral" | "good" | "warn" | "bad" = "good"
  let note: string
  if (!fitted) {
    if (load > WIRE_LIMIT) {
      tone = "bad"
      note = `没装保险丝，${formatSI(load, "A")} 超过了这根导线能长期承受的 ${WIRE_LIMIT} A：导线越来越烫，绝缘皮软化、冒烟，再下去就是起火。保险丝防的就是这个。`
    } else {
      tone = "warn"
      note = "没装保险丝。眼下的电流导线还扛得住，可一旦负载短路，就没有任何东西能把电流切断。"
    }
  } else if (sim.blown) {
    tone = "warn"
    note =
      load > RATED
        ? `保险丝熔断，电流归零：它牺牲自己，保住了导线和电源。负载还想要 ${formatSI(load, "A")}，故障没排除就换新的，新保险丝照样会断。`
        : "保险丝已经熔断，电流是 0。负载电流回到额定值以内了，现在可以更换保险丝。"
  } else if (load <= RATED) {
    note = `负载电流 ${formatSI(load, "A")} 没超过额定值 ${RATED} A，保险丝一直通着也不会断。`
  } else if (!willBlow) {
    tone = "warn"
    note = "电流超过了额定值，但还没到熔断点：保险丝发烫，却可能一直不断。它不是精确的限流器，在额定值附近反应很慢。"
  } else {
    tone = "warn"
    note = `电流是额定值的 ${fixed(load / RATED, 1)} 倍，熔丝正在升温，从冷态算起${blowText} 后熔断。电流越大，断得越快。`
  }

  return (
    <Lab
      title="保险丝实验台"
      hint="把负载电流往上拖，超过保险丝的额定值。熔断以后，再试试不装保险丝会怎样。"
      onReset={() => {
        setLoad(1.5)
        setFitted(true)
        setSim(INITIAL)
      }}
    >
      <LabStage>
        {/*
          Battery (40,100) vertical: + (40,70), − (40,130). Fuse centred (130,40): (100,40) – (160,40).
          Load (250,100) vertical: (250,70) – (250,130). Bottom rail y = 160.
        */}
        <Schematic width={300} height={186} label={`12 V 电源经过${fitted ? `一只 ${RATED} A 保险丝` : "一段导线"}给负载供电`}>
          {/* the wire warming up */}
          <path d="M40 70V40H100M160 40H250V70M250 130V160H40V130" stroke={trace.power} strokeWidth={7} opacity={clamp((sim.wire - 0.25) / 0.75, 0, 1) * 0.55} />
          <Wire points={[[40, 70], [40, 40], [100, 40]]} current={i} scale={5} />
          <Wire points={[[160, 40], [250, 40], [250, 70]]} current={i} scale={5} />
          <Wire points={[[250, 130], [250, 160], [40, 160], [40, 130]]} current={i} scale={5} />
          <Battery x={40} y={100} rot={90} label={`${VS} V`} />
          <Resistor x={250} y={100} rot={90} label="负载" value={formatSI(VS / load, "Ω")} labelSide="left" />
          {!fitted ? (
            <path d="M100 40H160" />
          ) : open ? (
            <>
              <path d="M100 40H123l2.5 4M160 40H137l-2.5 4" />
              <rect x={114} y={33} width={32} height={14} rx={3} />
              <Label x={130} y={66} color={trace.power}>
                已熔断
              </Label>
            </>
          ) : (
            <>
              <path d="M100 40H160" />
              <path d="M116 40H144" stroke={trace.power} strokeWidth={3.5} opacity={glow} />
              <rect x={114} y={33} width={32} height={14} rx={3} />
            </>
          )}
          <Label x={130} y={20}>
            {fitted ? `保险丝 ${RATED} A` : "没装保险丝"}
          </Label>
          <Label x={145} y={150} color={trace.current}>
            I = {formatSI(i, "A")}
          </Label>
          <Label x={145} y={179} muted>
            导线最多长期承受 {WIRE_LIMIT} A
          </Label>
        </Schematic>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="负载电流" value={load} onChange={setLoad} min={0.5} max={10} step={0.1} unit="A" color={trace.current} />
        <SwitchField
          label="装上保险丝"
          hint="关掉 = 用导线直接短接"
          checked={fitted}
          onChange={(on) => {
            setFitted(on)
            // switching it back on fits a fresh fuse
            if (on) setSim((s) => ({ ...s, heat: 0, blown: false }))
          }}
        />
        <ControlField label="熔断以后">
          <Button disabled={!open} onClick={() => setSim((s) => ({ ...s, heat: 0, blown: false }))}>
            更换保险丝
          </Button>
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="实际电流" value={formatSI(i, "A")} color={trace.current} />
        <Readout label="保险丝" value={!fitted ? "没装" : sim.blown ? "已熔断" : "完好"} sub={fitted && !sim.blown ? `熔丝温升 ${percent(glow)}，到 100% 熔断` : undefined} />
        <Readout label="这个电流下多久熔断" value={!fitted ? "—" : willBlow ? blowText : "不会熔断"} />
        <Readout label="导线温升" value={percent(sim.wire)} color={trace.power} sub={wireHot ? "超过上限，过热" : "100% 是上限"} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}
