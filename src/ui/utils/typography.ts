// ============================================================
// Typography scale math — pure functions, no dependencies.
// ============================================================

export type ScaleKey =
  | 'minorSecond'
  | 'majorSecond'
  | 'minorThird'
  | 'majorThird'
  | 'perfectFourth'
  | 'augmentedFourth'
  | 'perfectFifth'
  | 'goldenRatio'

export interface ScaleInfo {
  key: ScaleKey
  label: string
  ratio: number
}

export const SCALES: ScaleInfo[] = [
  { key: 'minorSecond',     label: 'Minor Second',     ratio: 1.067 },
  { key: 'majorSecond',     label: 'Major Second',     ratio: 1.125 },
  { key: 'minorThird',      label: 'Minor Third',      ratio: 1.200 },
  { key: 'majorThird',      label: 'Major Third',      ratio: 1.250 },
  { key: 'perfectFourth',   label: 'Perfect Fourth',   ratio: 1.333 },
  { key: 'augmentedFourth', label: 'Augmented Fourth', ratio: 1.414 },
  { key: 'perfectFifth',    label: 'Perfect Fifth',    ratio: 1.500 },
  { key: 'goldenRatio',     label: 'Golden Ratio',     ratio: 1.618 },
]

export interface TypeLevel {
  name: string
  /** Integer step from the base (0 = Body / base size) */
  step: number
  fontSize: number
  lineHeight: number
  letterSpacing: number
  /** Suggested font weight for this level */
  suggestedWeight: number
}

// -------------------------------------------------------
// Level definitions — integer steps so every ratio
// produces clearly different font sizes.
// Positive = bigger than base, negative = smaller.
// -------------------------------------------------------
const LEVEL_DEFS: { name: string; step: number; suggestedWeight: number }[] = [
  { name: 'Display',    step: 5, suggestedWeight: 700 },
  { name: 'H1',         step: 4, suggestedWeight: 700 },
  { name: 'H2',         step: 3, suggestedWeight: 600 },
  { name: 'H3',         step: 2, suggestedWeight: 600 },
  { name: 'Body Large', step: 1, suggestedWeight: 400 },
  { name: 'Body',       step: 0, suggestedWeight: 400 },
  { name: 'Small',      step: -1, suggestedWeight: 400 },
  { name: 'Caption',    step: -2, suggestedWeight: 400 },
]

// -------------------------------------------------------
// Line-height helpers
// -------------------------------------------------------
function autoLineHeight(size: number): number {
  // Tight for very large headings, roomy for small body text
  if (size >= 56) return Math.round(size * 1.05)
  if (size >= 40) return Math.round(size * 1.15)
  if (size >= 28) return Math.round(size * 1.25)
  if (size >= 20) return Math.round(size * 1.40)
  if (size >= 16) return Math.round(size * 1.50)
  return Math.round(size * 1.60)
}

function lineHeightForMode(
  size: number,
  mode: 'auto' | 'tight' | 'normal' | 'relaxed'
): number {
  switch (mode) {
    case 'tight':   return Math.round(size * 1.2)
    case 'normal':  return Math.round(size * 1.5)
    case 'relaxed': return Math.round(size * 1.7)
    default:        return autoLineHeight(size)
  }
}

function autoLetterSpacing(size: number): number {
  // Tighten large headings, neutral for body
  if (size >= 48) return -1.5
  if (size >= 36) return -0.75
  if (size >= 28) return -0.25
  if (size >= 20) return -0.1
  return 0
}

// -------------------------------------------------------
// Main export: generate the full scale
// -------------------------------------------------------
export function generateTypeScale(
  baseSize: number,
  scaleKey: ScaleKey,
  lineHeightMode: 'auto' | 'tight' | 'normal' | 'relaxed' = 'auto'
): TypeLevel[] {
  const scaleInfo = SCALES.find(s => s.key === scaleKey)
  const ratio = scaleInfo?.ratio ?? 1.25

  return LEVEL_DEFS.map(({ name, step, suggestedWeight }) => {
    // Integer exponent ensures every ratio produces meaningfully
    // different font sizes (no fractional steps).
    const fontSize = Math.round(baseSize * Math.pow(ratio, step))
    const lineHeight = lineHeightForMode(fontSize, lineHeightMode)
    const letterSpacing = autoLetterSpacing(fontSize)

    return { name, step, fontSize, lineHeight, letterSpacing, suggestedWeight }
  })
}
