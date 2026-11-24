import * as React from "react"
import { Button, ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Readout, Schematic, SliderField, formatSI, trace } from "@/lab"
import { C0, formatLength } from "./kit"

/** A real wire resonates a little short of the free-space figure (end effect, finite thickness). */
const SHORTENING = 0.95

const PRESETS = [
  { label: "433 MHz", f: 433.92e6 },
  { label: "868 MHz", f: 868e6 },
  { label: "2.45 GHz", f: 2.45e9 },
  { label: "5.8 GHz", f: 5.8e9 },
]

/** Frequency → how long to cut a half-wave dipole and a quarter-wave monopole. */
export function AntennaLengthLab() {
  const [f, setF] = React.useState(433.92e6)
  const wavelength = C0 / f
  const dipole = (wavelength / 2) * SHORTENING
  const monopole = (wavelength / 4) * SHORTENING

  const where =
    monopole > 0.3
      ? `单极子要 ${formatLength(monopole)}，便携设备放不下，通常绕成线圈或加电感来缩短，代价是效率和带宽。`
      : monopole > 0.03
        ? `单极子 ${formatLength(monopole)}：做成外置的鞭状天线或弹簧天线正合适。`
        : `单极子只有 ${formatLength(monopole)}：可以直接画在 PCB 上，或者用一颗陶瓷天线。`

  return (
    <Lab title="天线长度计算" hint="选一个频率，看半波偶极子和四分之一波长单极子各要多长。" onReset={() => setF(433.92e6)}>
      <LabStage>
        {/*
          300 × 170. Dipole on x = 70: arms 24…78 and 86…140, fed in the gap.
          Monopole on x = 200: 78…136 above a ground plane at y = 140.
        */}
        <Schematic width={300} height={170} label={`半波偶极子总长 ${formatLength(dipole)}，四分之一波长单极子长 ${formatLength(monopole)}`}>
          <Label x={70} y={14}>
            半波偶极子
          </Label>
          <path d="M70 24V78M70 86V140" strokeWidth={3} strokeLinecap="butt" />
          <path d="M70 78H48M70 86H48" />
          <Label x={43} y={86.5} anchor="end" size={12} muted>
            馈线
          </Label>
          <path d="M94 24V140M90 24H98M90 140H98" stroke="var(--muted-foreground)" strokeWidth={1.25} />
          <Label x={102} y={79} anchor="start" size={12} muted>
            总长
          </Label>
          <Label x={102} y={95} anchor="start" color={trace.voltage} weight={600}>
            {formatLength(dipole)}
          </Label>

          <Label x={200} y={14}>
            λ/4 单极子
          </Label>
          <path d="M200 78V136" strokeWidth={3} strokeLinecap="butt" />
          <path d="M165 140H235" />
          <path d="M171 140L165 148M183 140L177 148M195 140L189 148M207 140L201 148M219 140L213 148M231 140L225 148" stroke="var(--muted-foreground)" strokeWidth={1.25} />
          <path d="M221 78V136M217 78H225M217 136H225" stroke="var(--muted-foreground)" strokeWidth={1.25} />
          <Label x={229} y={111.5} anchor="start" color={trace.voltage} weight={600}>
            {formatLength(monopole)}
          </Label>
          <Label x={200} y={164} size={12} muted>
            地平面（代替另一半）
          </Label>
        </Schematic>
      </LabStage>
      <LabControls>
        <SliderField label="工作频率" value={f} onChange={setF} min={50e6} max={6e9} log format={(v) => formatSI(v, "Hz", 5)} />
        <ControlField label="常用频率">
          {PRESETS.map((p) => (
            <Button key={p.label} size="sm" aria-pressed={f === p.f} className={f === p.f ? "border-foreground" : undefined} onClick={() => setF(p.f)}>
              {p.label}
            </Button>
          ))}
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="波长 λ" value={formatLength(wavelength)} />
        <Readout label="半波偶极子总长" value={formatLength(dipole)} color={trace.voltage} sub="0.95 × λ/2" />
        <Readout label="λ/4 单极子" value={formatLength(monopole)} color={trace.voltage} sub="0.95 × λ/4" />
      </LabReadouts>
      <LabNote>{where}这是空气里一根细导线的长度；画在电路板上或包进塑料外壳后还要再短一些，最后以实测为准。</LabNote>
    </Lab>
  )
}
