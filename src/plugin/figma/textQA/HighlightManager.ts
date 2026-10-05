import type {
  SetReviewHighlightsPayload,
  TextIssueType,
  ReviewHighlightItem,
} from '../../../shared/types'
import { loadFontsForTextNode } from './TextReplacer'

const HIGHLIGHT_LAYER_NAME = '__DESIGNKIT_TEXT_QA_HIGHLIGHTS__'
const FOCUSED_WORD_LAYER_NAME = '__DESIGNKIT_FOCUSED_WORD_HIGHLIGHT__'

const ISSUE_COLORS: Record<TextIssueType, { r: number; g: number; b: number }> = {
  SPELLING:    { r: 0.94, g: 0.27, b: 0.27 }, // Red
  GRAMMAR:     { r: 0.55, g: 0.36, b: 0.96 }, // Purple
  SPACING:     { r: 0.96, g: 0.62, b: 0.04 }, // Yellow
  PUNCTUATION: { r: 0.98, g: 0.45, b: 0.09 }, // Orange
  TYPOGRAPHY:  { r: 0.23, g: 0.51, b: 0.96 }, // Blue
}

export interface WordBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Cleanly remove any temporary single-word focus highlight.
 */
export function clearFocusedWordHighlight(): void {
  const existing = figma.currentPage.findAll(
    n => n.name === FOCUSED_WORD_LAYER_NAME || n.getPluginData('designkit_focused_word') === 'true'
  )
  for (const node of existing) {
    try {
      node.remove()
    } catch {
      // ignore
    }
  }
}

/**
 * Cleanly remove all temporary Review Mode highlight indicators from the document.
 */
export function clearReviewHighlights(): void {
  clearFocusedWordHighlight()

  const existing = figma.currentPage.findAll(
    n => n.name === HIGHLIGHT_LAYER_NAME || n.getPluginData('designkit_temp_overlay') === 'true'
  )
  for (const node of existing) {
    try {
      node.remove()
    } catch {
      // ignore
    }
  }
}

/**
 * Accurately calculates pixel-perfect bounding boxes for multiple words/issues
 * inside a TextNode using Figma's native typography engine for measurement.
 * Handles auto-width, multi-line fixed-width, text wrapping, letter-spacing (tracking),
 * text-case, font size, line-height, and horizontal/vertical alignments (LEFT, CENTER, RIGHT).
 */
export async function calculateWordBoundingBoxes(
  textNode: TextNode,
  items: Array<{ start: number; end: number; original?: string; id?: string }>
): Promise<Map<string, WordBox>> {
  const resultMap = new Map<string, WordBox>()
  if (items.length === 0) return resultMap

  const bounds = textNode.absoluteBoundingBox || {
    x: textNode.x,
    y: textNode.y,
    width: textNode.width,
    height: textNode.height,
  }

  const fullText = textNode.characters || ''
  const targetWidth = Math.max(10, bounds.width)
  const isAutoWidth = textNode.textAutoResize === 'WIDTH_AND_HEIGHT'

  // Pre-load all fonts used in textNode
  await loadFontsForTextNode(textNode)

  // Extract base typographical styling
  let baseFont: FontName = { family: 'Inter', style: 'Regular' }
  if (textNode.fontName !== figma.mixed) {
    baseFont = textNode.fontName as FontName
  } else {
    try {
      const segs = textNode.getStyledTextSegments(['fontName'])
      if (segs.length > 0 && segs[0].fontName) baseFont = segs[0].fontName
    } catch {}
  }

  let fontSize = 16
  if (typeof textNode.fontSize === 'number') {
    fontSize = textNode.fontSize
  } else {
    try {
      const segs = textNode.getStyledTextSegments(['fontSize'])
      if (segs.length > 0 && typeof segs[0].fontSize === 'number') fontSize = segs[0].fontSize
    } catch {}
  }

  let letterSpacing: LetterSpacing = { value: 0, unit: 'PIXELS' }
  if (textNode.letterSpacing !== figma.mixed) {
    letterSpacing = textNode.letterSpacing
  }

  let textCase: TextCase = 'ORIGINAL'
  if (textNode.textCase !== figma.mixed) {
    textCase = textNode.textCase
  }

  let lineHeight = textNode.lineHeight !== figma.mixed ? textNode.lineHeight : { value: 135, unit: 'PERCENT' as const }

  // Create an off-canvas measurement TextNode configured with the exact font styles
  let measure: TextNode | null = null
  try {
    await figma.loadFontAsync(baseFont)
    measure = figma.createText()
    measure.fontName = baseFont
    measure.fontSize = fontSize
    measure.letterSpacing = letterSpacing
    measure.textCase = textCase
    measure.lineHeight = lineHeight
    measure.textAutoResize = 'WIDTH_AND_HEIGHT'
    measure.x = -99999
    measure.y = -99999
    measure.opacity = 0
    measure.name = '__temp_measure_node__'
  } catch {
    measure = null
  }

  try {
    // Measure line height step (deltaY) and single-line height (h1)
    let h1 = fontSize * 1.35
    let deltaY = fontSize * 1.35
    if (measure) {
      try {
        measure.characters = 'Ag'
        h1 = measure.height
        measure.characters = 'Ag\nAg'
        deltaY = measure.height - h1
        if (deltaY <= 0) deltaY = h1
      } catch {}
    }

    interface LayoutLine {
      lineIndex: number;
      text: string;
      startChar: number;
      endChar: number;
      width: number;
    }

    const lines: LayoutLine[] = []
    const paragraphs = fullText.split('\n')
    let globalChar = 0

    // Measure exact line wrapping as rendered by Figma
    for (let p = 0; p < paragraphs.length; p++) {
      const para = paragraphs[p]

      if (isAutoWidth || !measure) {
        let w = bounds.width
        if (measure) {
          measure.characters = para.length > 0 ? para : ' '
          w = measure.width
        }
        lines.push({
          lineIndex: lines.length,
          text: para,
          startChar: globalChar,
          endChar: globalChar + para.length,
          width: w,
        })
        globalChar += para.length + 1
        continue
      }

      // Multi-line: wrap words using exact pixel widths from Figma
      const words = para.split(' ')
      let curLineText = ''
      let curLineStart = globalChar
      let curLineWidth = 0

      for (let w = 0; w < words.length; w++) {
        const word = words[w]
        const testLine = curLineText.length === 0 ? word : curLineText + ' ' + word
        measure.characters = testLine
        const testW = measure.width

        if (curLineText.length > 0 && testW > targetWidth + 0.5) {
          // Wrapped to next line
          lines.push({
            lineIndex: lines.length,
            text: curLineText,
            startChar: curLineStart,
            endChar: curLineStart + curLineText.length,
            width: curLineWidth,
          })
          curLineStart += curLineText.length + 1
          curLineText = word
          measure.characters = word
          curLineWidth = measure.width
        } else {
          curLineText = testLine
          curLineWidth = testW
        }
      }

      if (curLineText.length > 0 || words.length === 0) {
        lines.push({
          lineIndex: lines.length,
          text: curLineText,
          startChar: curLineStart,
          endChar: curLineStart + curLineText.length,
          width: curLineWidth,
        })
      }

      globalChar += para.length + 1
    }

    if (lines.length === 0) {
      lines.push({
        lineIndex: 0,
        text: fullText,
        startChar: 0,
        endChar: fullText.length,
        width: bounds.width,
      })
    }

    // Compute bounding boxes for each requested issue item
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const key = item.id || `${item.start}-${item.end}`
      let start = Math.max(0, Math.min(item.start, fullText.length))
      let end = Math.max(start, Math.min(item.end, fullText.length))

      // Locate word in text if indices shifted
      if (item.original && fullText.slice(start, end) !== item.original) {
        const idx = fullText.indexOf(item.original)
        if (idx !== -1) {
          start = idx
          end = idx + item.original.length
        }
      }

      // Find the visual line containing this word
      let matchedLine = lines[0]
      for (let l = 0; l < lines.length; l++) {
        const line = lines[l]
        if (start >= line.startChar && start <= line.endChar) {
          matchedLine = line
          break
        }
      }

      const offsetInLine = Math.max(0, start - matchedLine.startChar)
      const prefix = matchedLine.text.slice(0, offsetInLine)
      const wordText = item.original || matchedLine.text.slice(offsetInLine, offsetInLine + (end - start)) || 'word'

      // Measure exact prefix width and word width in Figma
      let prefixWidth = 0
      let wordWidth = 30
      if (measure) {
        if (prefix.length > 0) {
          measure.characters = prefix
          prefixWidth = measure.width
        }
        measure.characters = wordText
        wordWidth = measure.width
      } else {
        const avgW = fontSize * 0.52
        prefixWidth = prefix.length * avgW
        wordWidth = Math.max(16, wordText.length * avgW)
      }

      // Account for exact horizontal alignment (LEFT, CENTER, RIGHT)
      let lineStartX = bounds.x
      if (textNode.textAlignHorizontal === 'CENTER') {
        lineStartX = bounds.x + Math.max(0, (bounds.width - matchedLine.width) / 2)
      } else if (textNode.textAlignHorizontal === 'RIGHT') {
        lineStartX = bounds.x + Math.max(0, bounds.width - matchedLine.width)
      }

      const wordX = lineStartX + prefixWidth

      // Account for vertical alignment (TOP, CENTER, BOTTOM)
      let verticalOffset = 0
      if (textNode.textAlignVertical === 'CENTER') {
        const totalH = h1 + (lines.length - 1) * deltaY
        verticalOffset = Math.max(0, (bounds.height - totalH) / 2)
      } else if (textNode.textAlignVertical === 'BOTTOM') {
        const totalH = h1 + (lines.length - 1) * deltaY
        verticalOffset = Math.max(0, bounds.height - totalH)
      }

      const wordY = bounds.y + verticalOffset + matchedLine.lineIndex * deltaY
      const wordH = deltaY > 0 ? deltaY : h1

      // Clamp safely within bounds
      const clampedX = Math.max(bounds.x, Math.min(wordX, bounds.x + bounds.width - wordWidth))
      const clampedY = Math.max(bounds.y, Math.min(wordY, bounds.y + bounds.height - wordH))
      const clampedW = Math.max(16, Math.min(wordWidth, bounds.width))

      resultMap.set(key, {
        x: Math.round(clampedX - 3),
        y: Math.round(clampedY - 2),
        width: Math.round(clampedW + 6),
        height: Math.round(wordH + 4),
      })
    }
  } finally {
    if (measure) {
      try {
        measure.remove()
      } catch {}
    }
  }

  return resultMap
}

/**
 * Calculates the bounding box for a single word in a TextNode.
 */
export async function calculateSingleWordBoundingBox(
  textNode: TextNode,
  start: number,
  end: number,
  word?: string
): Promise<WordBox> {
  const map = await calculateWordBoundingBoxes(textNode, [
    { start, end, original: word, id: 'single' },
  ])
  return (
    map.get('single') || {
      x: textNode.x,
      y: textNode.y,
      width: Math.max(20, textNode.width),
      height: Math.max(20, textNode.height),
    }
  )
}

/**
 * Synchronous fallback for calculateWordBoundingBox if ever needed outside async context.
 */
export function calculateWordBoundingBox(
  textNode: TextNode,
  start: number = 0,
  end: number = 0,
  word?: string
): WordBox {
  const bounds = textNode.absoluteBoundingBox || {
    x: textNode.x,
    y: textNode.y,
    width: textNode.width,
    height: textNode.height,
  }

  const fullText = textNode.characters || ''
  const len = fullText.length
  if (len === 0) return bounds

  let safeStart = Math.max(0, Math.min(start, len))
  let safeEnd = Math.max(safeStart, Math.min(end, len))
  if (word && fullText.slice(safeStart, safeEnd) !== word) {
    const idx = fullText.indexOf(word)
    if (idx !== -1) {
      safeStart = idx
      safeEnd = idx + word.length
    }
  }

  let fontSize = 16
  if (typeof textNode.fontSize === 'number') fontSize = textNode.fontSize
  const lineHeight =
    typeof textNode.lineHeight === 'object' && textNode.lineHeight.unit === 'PIXELS'
      ? textNode.lineHeight.value
      : fontSize * 1.35

  const totalLines = Math.max(1, Math.round(bounds.height / lineHeight))
  const ratio = safeStart / Math.max(1, len)
  const lineIdx = Math.min(totalLines - 1, Math.floor(ratio * totalLines))
  const wordY = bounds.y + lineIdx * lineHeight
  const wordW = Math.max(24, (safeEnd - safeStart) * fontSize * 0.55)

  return {
    x: bounds.x,
    y: wordY,
    width: Math.min(wordW, bounds.width),
    height: Math.min(lineHeight + 4, bounds.height),
  }
}

/**
 * Create or clear visual indicators for Review Mode.
 * Accurately outlines the EXACT incorrect word(s) inside the paragraph using
 * native Figma measurements.
 */
export async function setReviewHighlights(payload: SetReviewHighlightsPayload): Promise<void> {
  clearReviewHighlights()

  if (!payload.enabled || !payload.items || payload.items.length === 0) {
    return
  }

  const highlightNodes: SceneNode[] = []
  const itemsByNode = new Map<string, ReviewHighlightItem[]>()

  for (const item of payload.items) {
    const list = itemsByNode.get(item.nodeId) ?? []
    list.push(item)
    itemsByNode.set(item.nodeId, list)
  }

  for (const [nodeId, items] of itemsByNode.entries()) {
    const targetNode = figma.getNodeById(nodeId)
    if (!targetNode || targetNode.type !== 'TEXT') continue

    const sceneNode = targetNode as TextNode
    try {
      const bounds = sceneNode.absoluteBoundingBox
      if (!bounds) continue

      // 1. Subtle, clean dashed outline for the parent text layer container (no heavy red fill)
      const containerRect = figma.createRectangle()
      containerRect.name = `Layer Scope: ${sceneNode.name}`
      containerRect.x = bounds.x - 2
      containerRect.y = bounds.y - 2
      containerRect.resize(bounds.width + 4, bounds.height + 4)
      containerRect.cornerRadius = 4
      containerRect.fills = []
      containerRect.strokes = [
        {
          type: 'SOLID',
          color: { r: 0.6, g: 0.6, b: 0.65 },
          opacity: 0.3,
        },
      ]
      containerRect.strokeWeight = 1
      containerRect.strokeAlign = 'OUTSIDE'
      containerRect.dashPattern = [4, 4]
      containerRect.locked = true
      containerRect.setPluginData('designkit_temp_overlay', 'true')
      highlightNodes.push(containerRect)

      // 2. Measure exact word coordinates for all items in this node
      const boxMap = await calculateWordBoundingBoxes(
        sceneNode,
        items.map((it, idx) => ({
          start: it.start ?? 0,
          end: it.end ?? ((it.start ?? 0) + (it.original ? it.original.length : 1)),
          original: it.original,
          id: it.issueId || `item-${idx}`,
        }))
      )

      // 3. Render precise highlight boxes directly on the specific incorrect words
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const key = item.issueId || `item-${i}`
        const wordBox = boxMap.get(key)
        if (!wordBox) continue

        const color = ISSUE_COLORS[item.type] ?? { r: 0.94, g: 0.27, b: 0.27 }
        const wordRect = figma.createRectangle()
        wordRect.name = `Review Issue: "${item.original || 'word'}" (${item.type})`
        wordRect.x = wordBox.x
        wordRect.y = wordBox.y
        wordRect.resize(wordBox.width, wordBox.height)
        wordRect.cornerRadius = 4

        // Solid, vibrant issue-colored stroke + soft fill directly over the word
        wordRect.fills = [
          {
            type: 'SOLID',
            color,
            opacity: 0.18,
          },
        ]
        wordRect.strokes = [
          {
            type: 'SOLID',
            color,
            opacity: 0.92,
          },
        ]
        wordRect.strokeWeight = 1.75
        wordRect.strokeAlign = 'OUTSIDE'
        wordRect.locked = true
        wordRect.setPluginData('designkit_temp_overlay', 'true')
        highlightNodes.push(wordRect)
      }
    } catch (err) {
      console.warn(`[DesignKit TextQA] Could not create highlight for node ${nodeId}:`, err)
    }
  }

  if (highlightNodes.length > 0) {
    const group = figma.group(highlightNodes, figma.currentPage)
    group.name = HIGHLIGHT_LAYER_NAME
    group.locked = true
    group.setPluginData('designkit_temp_overlay', 'true')
  }
}

/**
 * Creates a focused visual highlight indicator targeting the specific word
 * in a paragraph when the user clicks an issue or the "Focus Word" button to review it.
 */
export async function setFocusedWordHighlight(
  textNode: TextNode,
  word: string,
  issueType: TextIssueType = 'SPELLING',
  start: number = 0,
  end: number = 0
): Promise<void> {
  clearFocusedWordHighlight()

  try {
    const color = ISSUE_COLORS[issueType] ?? { r: 0.94, g: 0.27, b: 0.27 }
    const wordBox = await calculateSingleWordBoundingBox(textNode, start, end, word)

    const rect = figma.createRectangle()
    rect.name = FOCUSED_WORD_LAYER_NAME
    rect.x = wordBox.x
    rect.y = wordBox.y
    rect.resize(wordBox.width, wordBox.height)
    rect.cornerRadius = 4

    rect.fills = [{ type: 'SOLID', color, opacity: 0.24 }]
    rect.strokes = [{ type: 'SOLID', color, opacity: 1.0 }]
    rect.strokeWeight = 2.5
    rect.strokeAlign = 'OUTSIDE'

    rect.locked = true
    rect.setPluginData('designkit_temp_overlay', 'true')
    rect.setPluginData('designkit_focused_word', 'true')
    figma.currentPage.appendChild(rect)
  } catch (err) {
    console.warn('[DesignKit TextQA] Could not create focused word highlight:', err)
  }
}
