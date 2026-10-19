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

// -------------------------------------------------------
// Create a single custom text style
// -------------------------------------------------------
export async function createCustomTextStyle(
  payload: import('../../shared/types').CreateCustomTextStylePayload
): Promise<TextStyle> {
  const fontName = await loadFontSafely(
    payload.fontFamily || 'Inter',
    payload.fontWeight || 400
  )

  const existing = figma.getLocalTextStyles()
  let style = existing.find(s => s.name === payload.name)
  if (!style) {
    style = figma.createTextStyle()
    style.name = payload.name
  }

  style.fontName = fontName
  style.fontSize = payload.fontSize
  if (payload.lineHeight && payload.lineHeight > 0) {
    style.lineHeight = { value: payload.lineHeight, unit: 'PIXELS' }
  } else {
    style.lineHeight = { unit: 'AUTO' }
  }

  if (typeof payload.letterSpacing === 'number') {
    style.letterSpacing = { value: payload.letterSpacing, unit: 'PIXELS' }
  }

  return style
}

// -------------------------------------------------------
// Extract text styles & unstyled layers across selection / page
// -------------------------------------------------------
export function getTextStyleExtractorData(
  scope: 'selection' | 'page' = 'selection'
): import('../../shared/types').TextStyleExtractorData {
  let targetNodes: SceneNode[] = []
  if (scope === 'selection' && figma.currentPage.selection.length > 0) {
    targetNodes = [...figma.currentPage.selection]
  } else {
    targetNodes = [...figma.currentPage.children]
  }

  const allTextNodes: TextNode[] = []
  function collectText(node: SceneNode) {
    if (node.type === 'TEXT') {
      allTextNodes.push(node as TextNode)
    }
    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        collectText(child)
      }
    }
  }

  for (const n of targetNodes) {
    collectText(n)
  }

  // Count usage of local styles
  const localStyles = figma.getLocalTextStyles()
  const usageMap = new Map<string, number>()
  for (const t of allTextNodes) {
    if (t.textStyleId && typeof t.textStyleId === 'string' && t.textStyleId !== '') {
      usageMap.set(t.textStyleId, (usageMap.get(t.textStyleId) || 0) + 1)
    }
  }

  const localStylesData: import('../../shared/types').LocalTextStyleInfo[] = localStyles.map(s => {
    let lh = 'Auto'
    if (s.lineHeight.unit === 'PIXELS') {
      lh = `${Math.round(s.lineHeight.value)}px`
    } else if (s.lineHeight.unit === 'PERCENT') {
      lh = `${Math.round(s.lineHeight.value)}%`
    }
    return {
      id: s.id,
      name: s.name,
      fontSize: s.fontSize,
      fontFamily: s.fontName ? s.fontName.family : 'Inter',
      fontWeight: s.fontName ? s.fontName.style : 'Regular',
      lineHeight: lh,
      usageCount: usageMap.get(s.id) || 0,
    }
  })

  const unstyledNodes: import('../../shared/types').UnstyledTextItem[] = []
  for (const t of allTextNodes) {
    if (!t.textStyleId || t.textStyleId === '') {
      const family = t.fontName !== figma.mixed ? (t.fontName as FontName).family : 'Mixed'
      const size = typeof t.fontSize === 'number' ? t.fontSize : 0
      unstyledNodes.push({
        nodeId: t.id,
        nodeName: t.name,
        textSnippet: t.characters.slice(0, 36).trim() || '(Empty text)',
        fontSize: size,
        fontFamily: family,
      })
    }
  }

  return {
    localStyles: localStylesData,
    unstyledNodes,
  }
}

// -------------------------------------------------------
// Apply a text style to a specific text node
// -------------------------------------------------------
export function applyStyleToText(nodeId: string, styleId: string): void {
  const node = figma.getNodeById(nodeId)
  if (!node || node.type !== 'TEXT') {
    throw new Error('Layer is not a text layer or could not be found')
  }
  ;(node as TextNode).textStyleId = styleId
}

// -------------------------------------------------------
// Apply line height to selected text layers
// -------------------------------------------------------
export async function applyLineHeightToSelection(
  payload: import('../../shared/types').ApplyLineHeightPayload
): Promise<number> {
  const selection = figma.currentPage.selection
  if (selection.length === 0) {
    throw new Error('Please select at least one text layer or frame containing text')
  }

  const textNodes: TextNode[] = []
  function collect(node: SceneNode) {
    if (node.type === 'TEXT') {
      textNodes.push(node as TextNode)
    }
    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        collect(child)
      }
    }
  }

  for (const n of selection) {
    collect(n)
  }

  if (textNodes.length === 0) {
    throw new Error('No text layers found in current selection')
  }

  let count = 0
  for (const text of textNodes) {
    try {
      if (text.fontName !== figma.mixed) {
        await figma.loadFontAsync(text.fontName as FontName)
      } else {
        const segments = text.getStyledTextSegments(['fontName'])
        for (const seg of segments) {
          await figma.loadFontAsync(seg.fontName)
        }
      }

      if (payload.unit === 'PERCENT') {
        text.lineHeight = { value: payload.lineHeight, unit: 'PERCENT' }
      } else {
        text.lineHeight = { value: payload.lineHeight, unit: 'PIXELS' }
      }
      count++
    } catch (err) {
      console.warn('[DesignKit] Could not set line height for node:', text.name, err)
    }
  }

  return count
}

