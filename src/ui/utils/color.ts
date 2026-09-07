// ============================================================
// Pure color math — no external dependencies.
// Used by all color-related tool components.
// ============================================================

// -------------------------------------------------------
// Basic conversions
// -------------------------------------------------------

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
      .join('')
  )
}

export function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
        break
      case gn:
        h = ((bn - rn) / d + 2) / 6
        break
      case bn:
        h = ((rn - gn) / d + 4) / 6
        break
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

export function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  const hn = h / 360
  const sn = s / 100
  const ln = l / 100

  if (sn === 0) {
    const v = Math.round(ln * 255)
    return { r: v, g: v, b: v }
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
  const p = 2 * ln - q

  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  }
}

export function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l)
  return rgbToHex(r, g, b)
}

// -------------------------------------------------------
// WCAG 2.1 contrast
// -------------------------------------------------------

function linearize(c: number): number {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

export function contrastRatio(hex1: string, hex2: string): number | null {
  const c1 = hexToRgb(hex1)
  const c2 = hexToRgb(hex2)
  if (!c1 || !c2) return null

  const l1 = relativeLuminance(c1.r, c1.g, c1.b)
  const l2 = relativeLuminance(c2.r, c2.g, c2.b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// -------------------------------------------------------
// Color palette generation (50–950 shades)
// Strategy: fix hue, interpolate lightness toward
// extremes, with mild saturation adjustments.
// -------------------------------------------------------

export interface PaletteShade {
  shade: string
  hex: string
}

const SHADE_STOPS = [
  { shade: '50',  lTarget: 97, sScale: 0.10 },
  { shade: '100', lTarget: 94, sScale: 0.22 },
  { shade: '200', lTarget: 87, sScale: 0.44 },
  { shade: '300', lTarget: 77, sScale: 0.65 },
  { shade: '400', lTarget: 66, sScale: 0.85 },
  { shade: '500', lTarget: -1, sScale: 1.00 }, // -1 = use base
  { shade: '600', lTarget: -2, sScale: 1.06 }, // -2 = base - delta
  { shade: '700', lTarget: -3, sScale: 1.08 },
  { shade: '800', lTarget: -4, sScale: 1.05 },
  { shade: '900', lTarget: -5, sScale: 1.00 },
  { shade: '950', lTarget: -6, sScale: 0.95 },
]

export function generatePalette(baseHex: string): PaletteShade[] {
  const rgb = hexToRgb(baseHex)
  if (!rgb) return []

  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b)

  const darkDeltas = [10, 22, 35, 47, 55]

  return SHADE_STOPS.map(({ shade, lTarget, sScale }) => {
    let finalL: number
    if (lTarget === -1) {
      finalL = l
    } else if (lTarget <= -2) {
      const idx = Math.abs(lTarget) - 2
      finalL = Math.max(3, l - darkDeltas[idx])
    } else {
      finalL = lTarget
    }

    const finalS = Math.min(100, s * sScale)
    return { shade, hex: hslToHex(h, finalS, finalL) }
  })
}

// -------------------------------------------------------
// Color harmony generation
// -------------------------------------------------------

export interface HarmonySet {
  complementary: string[]
  analogous: string[]
  triadic: string[]
  splitComplementary: string[]
  tetradic: string[]
  monochromatic: string[]
}

function rotateHue(base: { h: number; s: number; l: number }, deg: number): string {
  return hslToHex((base.h + deg + 360) % 360, base.s, base.l)
}

export function generateHarmonies(baseHex: string): HarmonySet | null {
  const rgb = hexToRgb(baseHex)
  if (!rgb) return null

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const { h, s, l } = hsl

  const R = (deg: number) => rotateHue(hsl, deg)

  return {
    complementary: [baseHex, R(180)],
    analogous: [R(-30), baseHex, R(30)],
    triadic: [baseHex, R(120), R(240)],
    splitComplementary: [baseHex, R(150), R(210)],
    tetradic: [baseHex, R(90), R(180), R(270)],
    monochromatic: [
      hslToHex(h, Math.max(s * 0.3, 5), Math.min(l + 35, 95)),
      hslToHex(h, Math.max(s * 0.6, 10), Math.min(l + 18, 88)),
      baseHex,
      hslToHex(h, Math.min(s * 1.1, 100), Math.max(l - 18, 10)),
      hslToHex(h, Math.min(s * 1.15, 100), Math.max(l - 35, 5)),
    ],
  }
}

// -------------------------------------------------------
// Misc helpers
// -------------------------------------------------------

/** Returns true if white text is more readable on the given background. */
export function shouldUseWhiteText(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  const lum = relativeLuminance(rgb.r, rgb.g, rgb.b)
  return lum < 0.35
}

/** Clamp a value between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** True if the string is a valid 6-digit hex (with or without #). */
export function isValidHex(hex: string): boolean {
  return /^#?[0-9a-f]{6}$/i.test(hex)
}

/** Normalise hex: ensure leading # and lowercase. */
export function normalizeHex(hex: string): string {
  const clean = hex.replace(/^#/, '').toLowerCase()
  if (clean.length === 3) {
    return '#' + clean.split('').map(c => c + c).join('')
  }
  return '#' + clean
}

// -------------------------------------------------------
// Simple k-means for dominant color extraction (used in UI)
// -------------------------------------------------------

export function extractDominantColors(
  pixels: Uint8ClampedArray,
  k = 6,
  maxIter = 20
): string[] {
  // Sample pixels (skip transparent)
  const samples: [number, number, number][] = []
  const step = Math.max(1, Math.floor(pixels.length / (4 * 3000)))

  for (let i = 0; i < pixels.length; i += 4 * step) {
    const a = pixels[i + 3]
    if (a < 128) continue
    samples.push([pixels[i], pixels[i + 1], pixels[i + 2]])
  }

  if (samples.length < k) return samples.map(([r, g, b]) => rgbToHex(r, g, b))

  // Initialise centroids by random sampling
  const centroids: [number, number, number][] = []
  const used = new Set<number>()
  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * samples.length)
    if (!used.has(idx)) {
      used.add(idx)
      centroids.push([...samples[idx]] as [number, number, number])
    }
  }

  // Iterate
  let assignments = new Int32Array(samples.length)
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false
    // Assign
    for (let i = 0; i < samples.length; i++) {
      const [r, g, b] = samples[i]
      let best = 0
      let bestDist = Infinity
      for (let c = 0; c < k; c++) {
        const [cr, cg, cb] = centroids[c]
        const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
        if (d < bestDist) { bestDist = d; best = c }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true }
    }

    // Update centroids
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0])
    for (let i = 0; i < samples.length; i++) {
      const c = assignments[i]
      sums[c][0] += samples[i][0]
      sums[c][1] += samples[i][1]
      sums[c][2] += samples[i][2]
      sums[c][3]++
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) {
        centroids[c] = [
          sums[c][0] / sums[c][3],
          sums[c][1] / sums[c][3],
          sums[c][2] / sums[c][3],
        ]
      }
    }

    if (!changed) break
  }

  // Count cluster sizes and sort by frequency
  const counts = new Array(k).fill(0)
  for (let i = 0; i < assignments.length; i++) counts[assignments[i]]++
  const order = Array.from({ length: k }, (_, i) => i).sort(
    (a, b) => counts[b] - counts[a]
  )

  return order.map(c => {
    const [r, g, b] = centroids[c]
    return rgbToHex(Math.round(r), Math.round(g), Math.round(b))
  })
}
