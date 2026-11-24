/*
 * A first-order model of one lithium-ion cell, shared by BatteryLab and
 * ChargeLab: an open-circuit voltage that depends on the state of charge,
 * behind a series resistance.
 */

/** Typical resting voltage of an NMC / LCO cell against state of charge (0–1). */
const OCV_TABLE: readonly (readonly [number, number])[] = [
  [0, 3.0],
  [0.02, 3.25],
  [0.05, 3.4],
  [0.1, 3.5],
  [0.2, 3.6],
  [0.3, 3.67],
  [0.4, 3.72],
  [0.5, 3.77],
  [0.6, 3.83],
  [0.7, 3.9],
  [0.8, 3.97],
  [0.9, 4.06],
  [1, 4.2],
]

/** Full-charge voltage and the voltage at which discharge must stop. */
export const V_FULL = 4.2
export const V_CUTOFF = 3.0

/** Open-circuit voltage at a state of charge between 0 (empty) and 1 (full). */
export function openCircuitVoltage(soc: number): number {
  const s = Math.min(1, Math.max(0, soc))
  for (let i = 1; i < OCV_TABLE.length; i++) {
    const [s1, v1] = OCV_TABLE[i]
    if (s <= s1) {
      const [s0, v0] = OCV_TABLE[i - 1]
      return v0 + ((v1 - v0) * (s - s0)) / (s1 - s0)
    }
  }
  return V_FULL
}

/** "2 小时 17 分钟", "36 分钟": a duration given in hours, the way people say it. */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "0 分钟"
  const total = Math.round(hours * 60)
  if (total < 1) return "不到 1 分钟"
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} 分钟`
  return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分钟`
}
