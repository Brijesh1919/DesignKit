import type {
  ApplyTextCorrectionPayload,
  ApplyBatchCorrectionsPayload,
} from '../../../shared/types'

/**
 * Robust font loader that loads all fonts used in a TextNode
 * before character operations are performed.
 */
export async function loadFontsForTextNode(textNode: TextNode): Promise<void> {
  if (textNode.fontName !== figma.mixed) {
    await figma.loadFontAsync(textNode.fontName as FontName)
    return
  }

  // Mixed fonts: use getStyledTextSegments if supported
  try {
    const segments = textNode.getStyledTextSegments(['fontName'])
    const loaded = new Set<string>()
    for (const seg of segments) {
      const key = `${seg.fontName.family}-${seg.fontName.style}`
      if (!loaded.has(key)) {
        loaded.add(key)
        await figma.loadFontAsync(seg.fontName)
      }
    }
    return
  } catch {
    // Fallback: character-by-character scan
  }

  const loaded = new Set<string>()
  const len = textNode.characters.length
  for (let i = 0; i < len; i++) {
    const font = textNode.getRangeFontName(i, i + 1)
    if (font !== figma.mixed) {
      const fn = font as FontName
      const key = `${fn.family}-${fn.style}`
      if (!loaded.has(key)) {
        loaded.add(key)
        try {
          await figma.loadFontAsync(fn)
        } catch {
          // ignore font load errors
        }
      }
    }
  }
}

/**
 * Safely replaces a specific character range in a TextNode while preserving styles.
 * Loads required fonts first.
 */
export async function applyTextCorrection(
  payload: ApplyTextCorrectionPayload
): Promise<boolean> {
  const node = figma.getNodeById(payload.nodeId)
  if (!node || node.type !== 'TEXT') {
    throw new Error('Target text layer not found or is no longer a text node')
  }

  const textNode = node as TextNode
  await loadFontsForTextNode(textNode)

  const currentText = textNode.characters
  let { start, end, original, replacement } = payload

  // Validate range
  if (start < 0 || end > currentText.length || start > end) {
    const foundIndex = currentText.indexOf(original)
    if (foundIndex !== -1) {
      start = foundIndex
      end = foundIndex + original.length
    } else {
      throw new Error(`Text has changed: could not locate "${original}" in layer`)
    }
  } else if (currentText.slice(start, end) !== original) {
    // If exact slice doesn't match, check if original moved slightly
    const localIndex = currentText.indexOf(original, Math.max(0, start - 20))
    if (localIndex !== -1 && Math.abs(localIndex - start) <= 30) {
      start = localIndex
      end = localIndex + original.length
    } else {
      const globalIndex = currentText.indexOf(original)
      if (globalIndex !== -1) {
        start = globalIndex
        end = globalIndex + original.length
      } else {
        throw new Error(`Text has changed: could not locate "${original}" in layer`)
      }
    }
  }

  // Preserve styles using deleteCharacters + insertCharacters
  textNode.deleteCharacters(start, end)
  if (replacement.length > 0) {
    textNode.insertCharacters(start, replacement, 'BEFORE')
  }

  return true
}

/**
 * Applies multiple safe text corrections across one or more TextNodes.
 * Corrections on the same node are applied in reverse order (highest offset first)
 * to prevent index shifts.
 */
export async function applyBatchCorrections(
  payload: ApplyBatchCorrectionsPayload
): Promise<number> {
  const byNode = new Map<string, ApplyTextCorrectionPayload[]>()
  for (const c of payload.corrections) {
    const list = byNode.get(c.nodeId) ?? []
    list.push(c)
    byNode.set(c.nodeId, list)
  }

  let count = 0
  for (const [nodeId, corrections] of byNode.entries()) {
    const node = figma.getNodeById(nodeId)
    if (!node || node.type !== 'TEXT') continue

    const textNode = node as TextNode
    try {
      await loadFontsForTextNode(textNode)

      // Sort descending by start position so early indices remain valid
      corrections.sort((a, b) => b.start - a.start)

      for (const c of corrections) {
        const currentText = textNode.characters
        let { start, end, original, replacement } = c

        if (
          start >= 0 &&
          end <= currentText.length &&
          currentText.slice(start, end) === original
        ) {
          textNode.deleteCharacters(start, end)
          if (replacement.length > 0) {
            textNode.insertCharacters(start, replacement, 'BEFORE')
          }
          count++
        } else {
          const found = currentText.indexOf(original)
          if (found !== -1) {
            textNode.deleteCharacters(found, found + original.length)
            if (replacement.length > 0) {
              textNode.insertCharacters(found, replacement, 'BEFORE')
            }
            count++
          }
        }
      }
    } catch (err) {
      console.warn(`[DesignKit TextQA] Batch correction failed on node ${nodeId}:`, err)
    }
  }

  return count
}
