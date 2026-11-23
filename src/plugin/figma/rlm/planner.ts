// ============================================================
// src/plugin/figma/rlm/planner.ts
// Responsive Layout Planner (Pure Decision Engine)
// 100% Offline & Deterministic — Zero External Dependencies
// ============================================================

import type { RLMNode, RLMViewport } from './types'

/**
 * Calculates responsive mobile font size.
 */
export function getMobileFontSize(desktopSize: number, vpWidth: number): number {
  if (vpWidth >= 768) {
    if (desktopSize >= 72) return 40
    if (desktopSize >= 56) return 34
    if (desktopSize >= 44) return 28
    if (desktopSize >= 36) return 24
    if (desktopSize >= 28) return 20
    return desktopSize
  }

  // Mobile (e.g. 390px)
  if (desktopSize >= 72) return 32
  if (desktopSize >= 56) return 28
  if (desktopSize >= 44) return 24
  if (desktopSize >= 36) return 20
  if (desktopSize >= 28) return 17
  if (desktopSize >= 22) return 15
  if (desktopSize >= 18) return 14
  if (desktopSize >= 14) return 13
  return Math.max(11, desktopSize)
}

/**
 * Clamps corner radius appropriately based on node role and dimensions.
 */
export function clampCornerRadius(
  radius: number,
  w: number,
  h: number,
  isPill: boolean
): number {
  if (radius <= 0) return 0
  const minDim = Math.min(w, h)
  if (isPill && minDim <= 56) {
    return Math.round(minDim / 2) // clean half-height capsule for small chips/buttons
  }
  // Large cards, containers, and sections must never exceed 24px (never giant pills!)
  return Math.min(radius, 24, Math.round(minDim * 0.15))
}

/**
 * Calculates optimal number of columns based on available container width,
 * minimum acceptable card width, and inter-card gap.
 * Works dynamically across any screen size (Mobile, Tablet, Desktop, or custom).
 */
export function calculateOptimalColumns(
  availableWidth: number,
  minCardWidth: number,
  gap: number,
  maxCols = 4
): number {
  if (availableWidth < minCardWidth) return 1
  const cols = Math.floor((availableWidth + gap) / (minCardWidth + gap))
  return Math.max(1, Math.min(cols, maxCols))
}

function hasCardStyle(node: RLMNode): boolean {
  const hasFill = node.style.fills.some(f => f.visible !== false)
  const hasStroke = node.style.strokes.some(s => s.visible !== false)
  const hasRadius = node.style.cornerRadii.tl >= 4
  return (hasFill || hasStroke) && hasRadius && node.geometry.width <= 600
}

/**
 * Intelligent clipping policy.
 * Only enables clipping when strictly required (rounded border containment, scrollable data).
 * Never clips standard content frames to avoid hiding overflowing text or button descenders.
 */
export function determineIntelligentClipping(node: RLMNode): boolean {
  if (node.role === 'ROOT') return false
  const hasRoundedBorder = node.style.cornerRadii.tl > 0 || node.style.cornerRadii.tr > 0
  const hasMediaOrBg = node.children.some(c => c.isImage || c.role === 'CARD_MEDIA' || c.role === 'BACKGROUND')
  if (hasRoundedBorder && (hasMediaOrBg || node.role === 'CARD')) return true
  if (node.role === 'CARD_MEDIA' || (node.isImage && hasRoundedBorder)) return true
  if (node.role === 'DATA_TABLE') return true
  return false
}

/**
 * Assigns responsive layout intents across the entire RLM tree.
 */
export function planResponsiveLayout(
  root: RLMNode,
  vp: RLMViewport
): void {
  const contentWidth = vp.width - vp.padding * 2

  // 1. Root Frame Intent
  root.intent = {
    layoutMode: 'VERTICAL',
    horizontalSizing: 'FIXED',
    verticalSizing: 'HUG',
    targetWidth: vp.width,
    itemSpacing: vp.rowGap,
    padding: { top: 0, right: 0, bottom: vp.padding * 2, left: 0 },
    alignItems: 'CENTER',
    justifyContent: 'MIN',
    preserveInstance: false,
    isAbsoluteInAutoLayout: false,
  }

  function planNode(node: RLMNode, availableWidth: number, isInsideCard = false) {
    const isPill = node.role === 'BADGE_OR_PILL' || (node.role === 'BUTTON_PRIMARY' && node.geometry.height <= 44)

    // Clamp corner radii in-model
    const r = node.style.cornerRadii
    node.style.cornerRadii = {
      tl: clampCornerRadius(r.tl, node.geometry.width, node.geometry.height, isPill),
      tr: clampCornerRadius(r.tr, node.geometry.width, node.geometry.height, isPill),
      bl: clampCornerRadius(r.bl, node.geometry.width, node.geometry.height, isPill),
      br: clampCornerRadius(r.br, node.geometry.width, node.geometry.height, isPill),
    }

    // 1. Proportional Image / Media Handling (Fit Content: Natural Aspect Ratio, Never Cropped)
    if (node.isImage || node.role === 'CARD_MEDIA') {
      const origW = Math.max(1, node.geometry.width)
      const origH = Math.max(1, node.geometry.height)
      const aspect = origH / origW
      node.intent.preserveMediaAspect = true
      node.intent.aspectRatio = aspect

      const targetImgW = isInsideCard ? availableWidth : Math.min(availableWidth, vp.width)
      // Natural aspect ratio calculation ensures image is never cropped or distorted
      const targetImgH = Math.round(targetImgW * aspect)

      node.intent = {
        layoutMode: 'NONE',
        horizontalSizing: 'FILL',
        verticalSizing: 'FIXED',
        targetWidth: targetImgW,
        targetHeight: targetImgH,
        itemSpacing: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        alignItems: 'CENTER',
        justifyContent: 'CENTER',
        preserveInstance: node.isInstance,
        isAbsoluteInAutoLayout: false,
        clipsContent: node.style.cornerRadii.tl > 0,
      }
      return
    }

    // 2. Background Layer Handling
    if (node.role === 'BACKGROUND') {
      node.intent = {
        layoutMode: 'NONE',
        horizontalSizing: 'FILL',
        verticalSizing: 'FILL',
        targetWidth: availableWidth,
        itemSpacing: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        alignItems: 'MIN',
        justifyContent: 'MIN',
        preserveInstance: true,
        isAbsoluteInAutoLayout: true,
        clipsContent: false,
      }
      return
    }

    switch (node.role) {
      case 'ANNOUNCEMENT_BAR': {
        node.intent = {
          layoutMode: 'HORIZONTAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: vp.width,
          itemSpacing: 8,
          padding: { top: 8, right: 12, bottom: 8, left: 12 },
          alignItems: 'CENTER',
          justifyContent: 'CENTER',
          preserveInstance: node.isInstance,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, vp.width - 24, false)
        }
        break
      }

      case 'NAVIGATION_BAR': {
        node.intent = {
          layoutMode: 'HORIZONTAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'FIXED',
          targetWidth: vp.width,
          targetHeight: vp.navH,
          itemSpacing: 12,
          padding: { top: 0, right: vp.padding, bottom: 0, left: vp.padding },
          alignItems: 'CENTER',
          justifyContent: 'SPACE_BETWEEN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, vp.width - vp.padding * 2, false)
        }
        break
      }

      case 'HERO_SECTION': {
        const innerW = Math.max(120, availableWidth - vp.padding * 2)
        node.intent = {
          layoutMode: 'VERTICAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: 18,
          padding: { top: 20, right: vp.padding, bottom: 24, left: vp.padding },
          alignItems: 'CENTER',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, innerW, false)
        }
        break
      }

      case 'TRUST_BADGES': {
        const innerW = Math.max(120, availableWidth - vp.padding * 2)
        node.intent = {
          layoutMode: 'HORIZONTAL',
          layoutWrap: 'WRAP',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: 12,
          padding: { top: 12, right: vp.padding, bottom: 12, left: vp.padding },
          alignItems: 'CENTER',
          justifyContent: 'CENTER',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, innerW, false)
        }
        break
      }

      case 'DATA_TABLE': {
        const innerW = Math.max(120, availableWidth - vp.padding * 2)
        node.intent = {
          layoutMode: 'VERTICAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: 8,
          padding: { top: 8, right: vp.padding, bottom: 8, left: vp.padding },
          alignItems: 'CENTER',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        for (const row of node.children) {
          const rowColCount = Math.max(1, row.children.length)
          const cols = calculateOptimalColumns(innerW, 130, 8, Math.min(2, rowColCount))
          const itemW = cols > 1 ? Math.floor((innerW - (cols - 1) * 8) / cols) : innerW

          row.intent = {
            layoutMode: cols > 1 ? 'HORIZONTAL' : 'VERTICAL',
            layoutWrap: cols > 1 ? 'WRAP' : 'NO_WRAP',
            horizontalSizing: 'FILL',
            verticalSizing: 'HUG',
            targetWidth: innerW,
            itemSpacing: 8,
            padding: { top: 6, right: 8, bottom: 6, left: 8 },
            alignItems: 'CENTER',
            justifyContent: 'SPACE_BETWEEN',
            preserveInstance: false,
            isAbsoluteInAutoLayout: false,
          }
          for (const cell of row.children) {
            planNode(cell, itemW, false)
            if (cols > 1) {
              cell.intent.horizontalSizing = 'FIXED'
              cell.intent.targetWidth = itemW
            } else {
              cell.intent.horizontalSizing = 'FILL'
              cell.intent.targetWidth = innerW
            }
          }
        }
        break
      }

      case 'METRIC_CARD_GROUP': {
        const innerW = Math.max(120, availableWidth - vp.padding * 2)
        const maxCols = vp.width >= 1024 ? 4 : vp.width >= 768 ? 3 : 2
        const cols = calculateOptimalColumns(innerW, 120, vp.colGap, maxCols)
        const itemW = cols > 1
          ? Math.floor((innerW - (cols - 1) * vp.colGap) / cols)
          : innerW

        node.intent = {
          layoutMode: cols > 1 ? 'HORIZONTAL' : 'VERTICAL',
          layoutWrap: cols > 1 ? 'WRAP' : 'NO_WRAP',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: vp.colGap,
          padding: { top: 8, right: vp.padding, bottom: 8, left: vp.padding },
          alignItems: 'CENTER',
          justifyContent: 'CENTER',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
          columns: cols,
        }
        for (const child of node.children) {
          planNode(child, itemW, true)
          if (cols > 1) {
            child.intent.horizontalSizing = 'FIXED'
            child.intent.targetWidth = itemW
          } else {
            child.intent.horizontalSizing = 'FILL'
            child.intent.targetWidth = innerW
          }
        }
        break
      }

      case 'TAG_CLOUD': {
        node.intent = {
          layoutMode: 'HORIZONTAL',
          layoutWrap: 'WRAP',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: 8,
          padding: { top: 4, right: 0, bottom: 4, left: 0 },
          alignItems: 'CENTER',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, availableWidth, false)
        }
        break
      }

      case 'BADGE_OR_PILL': {
        node.intent = {
          layoutMode: 'HORIZONTAL',
          horizontalSizing: 'HUG',
          verticalSizing: 'HUG',
          itemSpacing: 4,
          padding: { top: 4, right: 10, bottom: 4, left: 10 },
          alignItems: 'CENTER',
          justifyContent: 'CENTER',
          preserveInstance: node.isInstance,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, availableWidth, false)
        }
        break
      }

      case 'INLINE_MICRO_ROW': {
        node.intent = {
          layoutMode: 'HORIZONTAL',
          horizontalSizing: 'HUG',
          verticalSizing: 'HUG',
          itemSpacing: 8,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignItems: 'CENTER',
          justifyContent: 'MIN',
          preserveInstance: node.isInstance,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          if (child.typography) {
            child.intent = {
              layoutMode: 'NONE',
              horizontalSizing: 'HUG',
              verticalSizing: 'HUG',
              textAutoResize: 'WIDTH_AND_HEIGHT',
              itemSpacing: 0,
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              alignItems: 'MIN',
              justifyContent: 'MIN',
              preserveInstance: false,
              isAbsoluteInAutoLayout: false,
            }
          } else {
            child.intent = {
              layoutMode: 'NONE',
              horizontalSizing: 'FIXED',
              verticalSizing: 'FIXED',
              targetWidth: child.geometry.width,
              targetHeight: child.geometry.height,
              itemSpacing: 0,
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              alignItems: 'MIN',
              justifyContent: 'MIN',
              preserveInstance: child.isInstance,
              isAbsoluteInAutoLayout: false,
            }
          }
        }
        break
      }

      case 'INPUT_GROUP': {
        const canFitHorizontal = availableWidth >= 280
        node.intent = {
          layoutMode: canFitHorizontal ? 'HORIZONTAL' : 'VERTICAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: 8,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignItems: canFitHorizontal ? 'CENTER' : 'MIN',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          const isBtn = child.role === 'BUTTON_PRIMARY' || child.role === 'BUTTON_SECONDARY' || /(btn|button|submit)/i.test(child.name)
          if (isBtn) {
            planNode(child, availableWidth, false)
            if (canFitHorizontal) {
              child.intent.horizontalSizing = 'HUG'
            } else {
              child.intent.horizontalSizing = 'FILL'
            }
          } else {
            child.intent = {
              layoutMode: 'HORIZONTAL',
              horizontalSizing: 'FILL',
              verticalSizing: 'FIXED',
              targetHeight: 44,
              itemSpacing: 8,
              padding: { top: 8, right: 12, bottom: 8, left: 12 },
              alignItems: 'CENTER',
              justifyContent: 'MIN',
              preserveInstance: false,
              isAbsoluteInAutoLayout: false,
            }
            for (const inputKid of child.children) {
              planNode(inputKid, availableWidth - 24, false)
            }
          }
        }
        break
      }

      case 'FORM_FIELD': {
        node.intent = {
          layoutMode: 'VERTICAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: 6,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          if (child.typography && child.geometry.height <= 30) {
            child.intent = {
              layoutMode: 'NONE',
              horizontalSizing: 'FILL',
              verticalSizing: 'HUG',
              textAutoResize: 'HEIGHT',
              itemSpacing: 0,
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              alignItems: 'MIN',
              justifyContent: 'MIN',
              preserveInstance: false,
              isAbsoluteInAutoLayout: false,
            }
          } else {
            child.intent = {
              layoutMode: 'HORIZONTAL',
              horizontalSizing: 'FILL',
              verticalSizing: 'FIXED',
              targetHeight: Math.max(40, child.geometry.height),
              itemSpacing: 8,
              padding: { top: 8, right: 12, bottom: 8, left: 12 },
              alignItems: 'CENTER',
              justifyContent: 'MIN',
              preserveInstance: false,
              isAbsoluteInAutoLayout: false,
            }
          }
        }
        break
      }

      case 'CARD': {
        node.intent = {
          layoutMode: 'VERTICAL',
          horizontalSizing: isInsideCard ? 'FIXED' : 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: 10,
          padding: { top: 12, right: 12, bottom: 12, left: 12 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: node.isInstance,
          isAbsoluteInAutoLayout: node.style.layoutPositioning === 'ABSOLUTE',
        }
        for (const child of node.children) {
          planNode(child, availableWidth - 24, true)
        }
        break
      }

      case 'BUTTON_PRIMARY':
      case 'BUTTON_SECONDARY': {
        node.intent = {
          layoutMode: 'HORIZONTAL',
          horizontalSizing: isInsideCard ? 'FILL' : 'HUG',
          verticalSizing: 'HUG',
          itemSpacing: 8,
          padding: { top: 10, right: 18, bottom: 10, left: 18 },
          alignItems: 'CENTER',
          justifyContent: 'CENTER',
          preserveInstance: node.isInstance,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, availableWidth, isInsideCard)
        }
        break
      }

      case 'PRODUCT_GRID': {
        const innerW = Math.max(120, availableWidth - vp.padding * 2)
        const maxCols = vp.width >= 1024 ? 4 : vp.width >= 768 ? 3 : 2
        const cols = calculateOptimalColumns(innerW, 140, vp.colGap, maxCols)
        const itemW = cols > 1
          ? Math.floor((innerW - (cols - 1) * vp.colGap) / cols)
          : innerW

        node.intent = {
          layoutMode: cols > 1 ? 'HORIZONTAL' : 'VERTICAL',
          layoutWrap: cols > 1 ? 'WRAP' : 'NO_WRAP',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: vp.colGap,
          padding: { top: 12, right: vp.padding, bottom: 12, left: vp.padding },
          alignItems: 'CENTER',
          justifyContent: 'CENTER',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
          columns: cols,
        }

        for (const child of node.children) {
          planNode(child, itemW, true)
          if (cols > 1) {
            child.intent.horizontalSizing = 'FIXED'
            child.intent.targetWidth = itemW
          } else {
            child.intent.horizontalSizing = 'FILL'
            child.intent.targetWidth = innerW
          }
        }
        break
      }

      case 'DECORATIVE': {
        node.intent = {
          layoutMode: 'NONE',
          horizontalSizing: 'FIXED',
          verticalSizing: 'FIXED',
          targetWidth: node.geometry.width,
          targetHeight: node.geometry.height,
          itemSpacing: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: true,
          isAbsoluteInAutoLayout: true,
        }
        break
      }

      case 'BACKGROUND': {
        node.intent = {
          layoutMode: 'NONE',
          horizontalSizing: 'FILL',
          verticalSizing: 'FILL',
          itemSpacing: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: true,
          isAbsoluteInAutoLayout: true,
        }
        break
      }

      case 'TEXT_HEADING': {
        if (node.typography) {
          node.typography.fontSize = getMobileFontSize(node.typography.fontSize, vp.width)
        }
        node.intent = {
          layoutMode: 'NONE',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          textAutoResize: 'HEIGHT',
          minWidth: 120,
          itemSpacing: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        break
      }

      case 'TEXT_PARAGRAPH': {
        if (node.typography) {
          node.typography.fontSize = getMobileFontSize(node.typography.fontSize, vp.width)
        }
        node.intent = {
          layoutMode: 'NONE',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          textAutoResize: 'HEIGHT',
          minWidth: 120,
          itemSpacing: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        break
      }

      case 'TEXT_INLINE_LABEL': {
        if (node.typography) {
          node.typography.fontSize = getMobileFontSize(node.typography.fontSize, vp.width)
        }
        node.intent = {
          layoutMode: 'NONE',
          horizontalSizing: 'HUG',
          verticalSizing: 'HUG',
          textAutoResize: 'WIDTH_AND_HEIGHT',
          itemSpacing: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        break
      }

      case 'FOOTER': {
        node.intent = {
          layoutMode: 'VERTICAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: vp.width,
          itemSpacing: 20,
          padding: { top: vp.padding, right: vp.padding, bottom: vp.padding * 2, left: vp.padding },
          alignItems: 'MIN',
          justifyContent: 'MIN',
          preserveInstance: false,
          isAbsoluteInAutoLayout: false,
        }
        for (const child of node.children) {
          planNode(child, contentWidth, false)
        }
        break
      }

      default: {
        // Generic containers or wrappers
        const isCard = isInsideCard || (hasCardStyle(node) && node.children.length >= 2)
        const isCentered = node.children.some(c => c.typography?.textAlignHorizontal === 'CENTER')
        const padX = isCard ? 12 : (isInsideCard ? 0 : vp.padding)
        const innerW = Math.max(100, availableWidth - padX * 2)
        node.intent = {
          layoutMode: 'VERTICAL',
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG',
          targetWidth: availableWidth,
          itemSpacing: isCard ? 10 : 16,
          // CRUCIAL FOR PREVENTING DOUBLE MARGINS: Only add padding if it's a styled card or top section!
          padding: isCard
            ? { top: 12, right: 12, bottom: 12, left: 12 }
            : (isInsideCard ? { top: 0, right: 0, bottom: 0, left: 0 } : { top: 16, right: vp.padding, bottom: 16, left: vp.padding }),
          alignItems: isCentered ? 'CENTER' : 'MIN',
          justifyContent: isCentered ? 'CENTER' : 'MIN',
          preserveInstance: node.isInstance,
          isAbsoluteInAutoLayout: node.style.layoutPositioning === 'ABSOLUTE',
        }
        for (const child of node.children) {
          planNode(child, innerW, isCard)
        }
        break
      }
    }

    // Set intelligent clipping policy if not explicitly overridden
    if (node.intent.clipsContent === undefined) {
      node.intent.clipsContent = determineIntelligentClipping(node)
    }
  }

  // Plan all children of root
  for (const section of root.children) {
    planNode(section, vp.width, false)

    const isFullBleed = section.role === 'ANNOUNCEMENT_BAR' || section.role === 'NAVIGATION_BAR' || section.role === 'FOOTER'
    if (!isFullBleed) {
      section.intent.horizontalSizing = 'FILL'
      section.intent.targetWidth = vp.width
      if (section.intent.padding.left === 0 && section.intent.padding.right === 0) {
        section.intent.padding.left = vp.padding
        section.intent.padding.right = vp.padding
      }
      section.intent.alignItems = 'CENTER'
    }
  }
}
