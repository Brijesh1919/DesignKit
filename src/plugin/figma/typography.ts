import type { TextStyleDef } from '../../shared/types'

// -------------------------------------------------------
// Map numeric weight → Figma font style string.
// Figma uses style names like "Regular", "Bold" etc.
// -------------------------------------------------------
const WEIGHT_STYLE_MAP: [number, string[]][] = [
  [100, ['Thin', 'Hairline']],
  [200, ['ExtraLight', 'Extra Light', 'UltraLight', 'Ultra Light']],
  [300, ['Light']],
  [400, ['Regular', 'Book', 'Normal']],
  [500, ['Medium']],
  [600, ['SemiBold', 'Semi Bold', 'Demi Bold', 'DemiBold']],
  [700, ['Bold']],
  [800, ['ExtraBold', 'Extra Bold', 'UltraBold', 'Ultra Bold']],
  [900, ['Black', 'Heavy']],
]

/** Return ordered list of Figma style name candidates for a numeric weight. */
function weightToStyleCandidates(weight: number): string[] {
  // Find exact match first
  for (const [w, styles] of WEIGHT_STYLE_MAP) {
    if (w === weight) return styles
  }
  // Nearest weight fallback
  let closest = WEIGHT_STYLE_MAP[3] // 400/Regular
  let minDist = Infinity
  for (const entry of WEIGHT_STYLE_MAP) {
    const d = Math.abs(entry[0] - weight)
    if (d < minDist) { minDist = d; closest = entry }
  }
  return closest[1]
}

// -------------------------------------------------------
// Attempt to load a font, trying multiple style name
// candidates in order. Returns the loaded FontName or
// throws if every attempt fails.
// -------------------------------------------------------
async function tryLoadFont(family: string, styleCandidates: string[]): Promise<FontName | null> {
  for (const style of styleCandidates) {
    try {
      const fontName: FontName = { family, style }
      await figma.loadFontAsync(fontName)
      return fontName
    } catch {
      // Try next candidate
    }
  }
  return null
}

// -------------------------------------------------------
// Robust font loader with multi-level fallback:
//   1. Requested family + weight style candidates
//   2. Requested family + Regular
//   3. Inter + same weight candidates
//   4. Inter + Regular  (always available in Figma)
// -------------------------------------------------------
async function loadFontSafely(family: string, weight: number): Promise<FontName> {
  const styleCandidates = weightToStyleCandidates(weight)

  // 1. Requested family, all style candidates for this weight
  const attempt1 = await tryLoadFont(family, styleCandidates)
  if (attempt1) return attempt1

  // 2. Requested family, Regular fallback
  const attempt2 = await tryLoadFont(family, ['Regular', 'Book', 'Normal'])
  if (attempt2) return attempt2

  // 3. Inter + requested weight
  if (family.toLowerCase() !== 'inter') {
    const attempt3 = await tryLoadFont('Inter', styleCandidates)
    if (attempt3) return attempt3
  }

  // 4. Inter Regular — guaranteed to be available in Figma
  const fontName: FontName = { family: 'Inter', style: 'Regular' }
  await figma.loadFontAsync(fontName)
  return fontName
}

// -------------------------------------------------------
// Create (or update) Figma text styles from scale data.
//
// IMPORTANT: Each style is processed sequentially so that
// font loading never races with style creation.
// The font is always loaded and awaited BEFORE any
// font-dependent property is set on the style object.
//
// Returns the number of styles successfully created.
// -------------------------------------------------------
export async function createTextStyles(styles: TextStyleDef[]): Promise<number> {
  let created = 0

  // Retrieve existing styles once up front
  const existing = figma.getLocalTextStyles()

  for (const def of styles) {
    try {
      // ---- Step 1: Load the font FIRST ----
      // Must be completed before setting fontSize, fontName,
      // lineHeight, or letterSpacing on any text style.
      const fontName = await loadFontSafely(
        def.fontFamily ?? 'Inter',
        def.fontWeight ?? 400
      )

      // ---- Step 2: Find or create the style ----
      let style = existing.find(s => s.name === def.name)
      if (!style) {
        style = figma.createTextStyle()
        style.name = def.name
      }

      // ---- Step 3: Set font-dependent properties ----
      // Now that the font is loaded, these assignments
      // will not throw "unloaded font" errors.
      style.fontName       = fontName
      style.fontSize       = def.fontSize
      style.lineHeight     = { value: def.lineHeight, unit: 'PIXELS' }
      style.letterSpacing  = { value: def.letterSpacing, unit: 'PIXELS' }

      created++
    } catch (err) {
      console.error(`[DesignKit] Failed to create text style "${def.name}":`, err)
      // Continue with remaining styles even if one fails
    }
  }

  return created
}
