// ============================================================
// src/plugin/figma/rlm/generator.ts
// Mobile-Native Auto Layout Generator from RLM Plan
// 100% Offline & Deterministic — Zero External Dependencies
// ============================================================

import type { RLMNode, RLMViewport } from './types'

const _loadedFontCache = new Set<string>()

async function ensureFontLoaded(fn: FontName): Promise<boolean> {
  const key = `${fn.family}::${fn.style}`
  if (_loadedFontCache.has(key)) return true
  try {
    if (typeof figma !== 'undefined' && typeof figma.loadFontAsync === 'function') {
      await figma.loadFontAsync(fn)
      _loadedFontCache.add(key)
      return true
    }
  } catch (_) { }
  return false
}

/**
 * Safely applies corner radii to a Figma node without throwing errors.
 */
function applyCornerRadiiToNode(node: any, radii: { tl: number; tr: number; bl: number; br: number }): void {
  try {
    const isUniform = radii.tl === radii.tr && radii.tl === radii.bl && radii.tl === radii.br
    if (isUniform && 'cornerRadius' in node) {
      node.cornerRadius = radii.tl
    }
    if ('topLeftRadius' in node) {
      node.topLeftRadius = radii.tl
      node.topRightRadius = radii.tr
      node.bottomLeftRadius = radii.bl
      node.bottomRightRadius = radii.br
    }
  } catch (_) { }
}

/**
 * Applies native Auto Layout and sizing properties to a frame or container node.
 */
export async function applyRLMNodeToFigma(
  rlm: RLMNode,
  vp: RLMViewport,
  log?: string[]
): Promise<void> {
  const node = rlm.figmaNodeRef
  if (!node) return

  // 1. Check if node is an Instance
  if (rlm.isInstance) {
    if (!rlm.intent.preserveInstance) {
      // Only detach if structural mutation is strictly required
      if ('detachInstance' in node && typeof (node as any).detachInstance === 'function') {
        try {
          rlm.figmaNodeRef = (node as any).detachInstance()
        } catch (_) { }
      }
    }
  }

  const activeNode = rlm.figmaNodeRef

  // 2. Corner Radii Application
  applyCornerRadiiToNode(activeNode, rlm.style.cornerRadii)

  // 3. Text Node Reflow
  if (activeNode.type === 'TEXT') {
    const textNode = activeNode as TextNode
    try {
      if (typeof textNode.fontName !== 'symbol') {
        await ensureFontLoaded(textNode.fontName as FontName)
      } else {
        const firstFont = textNode.getRangeFontName(0, 1)
        if (typeof firstFont !== 'symbol') {
          await ensureFontLoaded(firstFont as FontName)
        }
      }

      if (rlm.typography && typeof textNode.fontSize === 'number') {
        textNode.fontSize = rlm.typography.fontSize
      }

      if (rlm.intent.textAutoResize) {
        textNode.textAutoResize = rlm.intent.textAutoResize
        if (rlm.intent.textAutoResize === 'HEIGHT') {
          const fitW = rlm.intent.targetWidth || Math.max(120, vp.width - vp.padding * 2)
          if ('resize' in textNode && fitW > 0) {
            try {
              (textNode as any).resize(fitW, textNode.height)
            } catch (_) { }
          }
        }
      }
    } catch (_) { }
    return
  }

  // 4. Auto Layout Properties for Frame / Component Nodes
  if ('layoutMode' in activeNode) {
    const frame = activeNode as FrameNode

    try {
      // Set Auto Layout Mode
      frame.layoutMode = rlm.intent.layoutMode

      // If Auto Layout is enabled, configure spacing, padding & alignment
      if (rlm.intent.layoutMode !== 'NONE') {
        frame.itemSpacing = rlm.intent.itemSpacing
        frame.paddingTop = rlm.intent.padding.top
        frame.paddingRight = rlm.intent.padding.right
        frame.paddingBottom = rlm.intent.padding.bottom
        frame.paddingLeft = rlm.intent.padding.left

        if ('layoutWrap' in frame && rlm.intent.layoutWrap) {
          (frame as any).layoutWrap = rlm.intent.layoutWrap
          if (rlm.intent.layoutWrap === 'WRAP' && 'counterAxisSpacing' in frame) {
            (frame as any).counterAxisSpacing = rlm.intent.itemSpacing
          }
        }

        // Alignments
        if (rlm.intent.justifyContent === 'SPACE_BETWEEN') {
          frame.primaryAxisAlignItems = 'SPACE_BETWEEN'
        } else if (rlm.intent.justifyContent === 'CENTER') {
          frame.primaryAxisAlignItems = 'CENTER'
        } else if (rlm.intent.justifyContent === 'MAX') {
          frame.primaryAxisAlignItems = 'MAX'
        } else {
          frame.primaryAxisAlignItems = 'MIN'
        }

        if (rlm.intent.alignItems === 'CENTER' || rlm.role === 'ROOT') {
          frame.counterAxisAlignItems = 'CENTER'
        } else if (rlm.intent.alignItems === 'MAX') {
          frame.counterAxisAlignItems = 'MAX'
        } else {
          frame.counterAxisAlignItems = 'MIN'
        }
      }

      // Sizing Mode (FILL vs HUG vs FIXED)
      if ('layoutSizingHorizontal' in frame) {
        (frame as any).layoutSizingHorizontal = rlm.intent.horizontalSizing
      } else if (rlm.intent.layoutMode === 'HORIZONTAL') {
        frame.primaryAxisSizingMode = rlm.intent.horizontalSizing === 'HUG' ? 'AUTO' : 'FIXED'
      } else if (rlm.intent.layoutMode === 'VERTICAL') {
        frame.counterAxisSizingMode = rlm.intent.horizontalSizing === 'HUG' ? 'AUTO' : 'FIXED'
      }

      if ('layoutSizingVertical' in frame) {
        (frame as any).layoutSizingVertical = rlm.intent.verticalSizing
      } else if (rlm.intent.layoutMode === 'VERTICAL') {
        frame.primaryAxisSizingMode = rlm.intent.verticalSizing === 'HUG' ? 'AUTO' : 'FIXED'
      } else if (rlm.intent.layoutMode === 'HORIZONTAL') {
        frame.counterAxisSizingMode = rlm.intent.verticalSizing === 'HUG' ? 'AUTO' : 'FIXED'
      }

      // Explicit target width if fixed or specified
      const targetW = rlm.intent.targetWidth || (rlm.intent.horizontalSizing === 'FILL' ? vp.width : undefined)
      if (targetW && 'resize' in frame) {
        const curH = rlm.intent.targetHeight || frame.height
        frame.resize(targetW, curH)
      }

      // Intelligent clipping policy: only clip when strictly justified
      if ('clipsContent' in frame && rlm.intent.clipsContent !== undefined) {
        frame.clipsContent = rlm.intent.clipsContent
      }

      // Align and size direct children inside Auto Layout
      if (rlm.intent.layoutMode !== 'NONE') {
        const innerUsableW = Math.max(100, frame.width - (frame.paddingLeft || 0) - (frame.paddingRight || 0))
        for (const childRLM of rlm.children) {
          const childNode = childRLM.figmaNodeRef
          if (childNode && !childRLM.intent.isAbsoluteInAutoLayout) {
            try {
              if ('layoutAlign' in childNode) {
                (childNode as any).layoutAlign = childRLM.intent.horizontalSizing === 'FILL' ? 'STRETCH' : 'INHERIT'
              }
              if ('layoutSizingHorizontal' in childNode) {
                (childNode as any).layoutSizingHorizontal = childRLM.intent.horizontalSizing
              }
              if ('layoutSizingVertical' in childNode && childRLM.intent.verticalSizing) {
                (childNode as any).layoutSizingVertical = childRLM.intent.verticalSizing
              }

              // Explicitly size FILL children so canvas updates immediately without waiting for AL re-eval
              if (childRLM.intent.horizontalSizing === 'FILL' && 'resize' in childNode && !childRLM.isVectorIcon) {
                const fillW = childRLM.intent.targetWidth || (frame.layoutMode === 'VERTICAL' ? innerUsableW : childNode.width)
                if (fillW > 0) {
                  try {
                    (childNode as any).resize(fillW, childNode.height)
                  } catch (_) { }
                }
              } else if (childRLM.intent.horizontalSizing === 'FIXED' && childRLM.intent.targetWidth && 'resize' in childNode) {
                const curH = childRLM.intent.targetHeight || childNode.height
                childNode.resize(childRLM.intent.targetWidth, curH)
              }
            } catch (_) { }
          }
        }
      }
    } catch (e) {
      if (log) log.push(`Warning setting AL on "${activeNode.name}": ${e}`)
    }
  }

  // 5. Image & Media Proportional Resizing
  if (rlm.isImage || rlm.role === 'CARD_MEDIA') {
    const targetW = rlm.intent.targetWidth || (rlm.intent.horizontalSizing === 'FILL' ? vp.width : activeNode.width)
    const targetH = rlm.intent.targetHeight || activeNode.height
    if ('resize' in activeNode) {
      (activeNode as any).resize(targetW, targetH)
    }
    applyCornerRadiiToNode(activeNode, rlm.style.cornerRadii)
    if ('clipsContent' in activeNode && rlm.style.cornerRadii.tl > 0) {
      (activeNode as any).clipsContent = true
    }

    // Fit Content: Ensure image fills use scaleMode = 'FIT' so images are never cropped
    if ('fills' in activeNode && Array.isArray((activeNode as any).fills)) {
      try {
        const updatedFills = (activeNode as any).fills.map((f: Paint) => {
          if (f.type === 'IMAGE') {
            return {
              ...f,
              scaleMode: 'FIT',
            }
          }
          return f
        })
        ;(activeNode as any).fills = updatedFills
      } catch (_) { }
    }
  }

  // 5. Absolute Positioning in Auto Layout
  if (rlm.intent.isAbsoluteInAutoLayout && 'layoutPositioning' in activeNode) {
    try {
      (activeNode as any).layoutPositioning = 'ABSOLUTE'
    } catch (_) { }
  }

  // 6. Recurse into children
  for (const childRLM of rlm.children) {
    await applyRLMNodeToFigma(childRLM, vp, log)
  }
}
