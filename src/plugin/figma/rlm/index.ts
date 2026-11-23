// ============================================================
// src/plugin/figma/rlm/index.ts
// Responsive Layout Model (RLM) Conversion Pipeline
// 100% Offline & Deterministic — Zero External Dependencies
// ============================================================

import type { RLMValidationResult, RLMViewport } from './types'
import { parseSceneNodeToRLM } from './parser'
import { classifyRLMTree, findNavigationRLM } from './classifier'
import { planResponsiveLayout } from './planner'
import { applyRLMNodeToFigma } from './generator'
import { validateRLMPlan } from './validator'
import { analyzeSectionOverflow } from './overflowAnalyzer'
import { transformMobileNavigation } from './navTransformer'

export * from './types'
export * from './relationships'
export * from './parser'
export * from './classifier'
export * from './planner'
export * from './generator'
export * from './validator'
export * from './overflowAnalyzer'
export * from './navTransformer'

export const RLM_VIEWPORTS: Record<string, RLMViewport> = {
  desktop: { width: 1440, height: 900, name: 'Desktop', padding: 40, colGap: 24, rowGap: 48, navH: 72, defaultCardCols: 4 },
  laptop: { width: 1024, height: 768, name: 'Laptop', padding: 32, colGap: 20, rowGap: 40, navH: 64, defaultCardCols: 3 },
  tablet: { width: 768, height: 1024, name: 'Tablet', padding: 24, colGap: 16, rowGap: 34, navH: 60, defaultCardCols: 2 },
  'tablet-portrait': { width: 768, height: 1024, name: 'Tablet (Portrait)', padding: 24, colGap: 16, rowGap: 34, navH: 60, defaultCardCols: 2 },
  'tablet-landscape': { width: 1024, height: 768, name: 'Tablet (Landscape)', padding: 32, colGap: 20, rowGap: 40, navH: 64, defaultCardCols: 3 },
  mobile: { width: 390, height: 844, name: 'Mobile', padding: 20, colGap: 12, rowGap: 28, navH: 56, defaultCardCols: 1 },
  'mobile-compact': { width: 375, height: 812, name: 'Mobile (Compact)', padding: 16, colGap: 12, rowGap: 26, navH: 54, defaultCardCols: 1 },
  'mobile-large': { width: 430, height: 932, name: 'Mobile (Large)', padding: 20, colGap: 14, rowGap: 30, navH: 58, defaultCardCols: 1 },
  'small-mobile': { width: 320, height: 568, name: 'Small Mobile', padding: 16, colGap: 10, rowGap: 24, navH: 52, defaultCardCols: 1 },
}

/**
 * Resolves any target specification (preset string, numeric width, or viewport object) into an RLMViewport.
 * Supports universal conversion between arbitrary screen dimensions:
 * Desktop -> Mobile, Mobile -> Tablet, Desktop -> Tablet, Tablet -> Mobile, Any -> Any.
 */
export function resolveViewport(target: string | number | RLMViewport): RLMViewport {
  if (typeof target === 'object' && target !== null && 'width' in target) {
    return target
  }

  if (typeof target === 'number') {
    const w = Math.max(280, Math.round(target))
    const isMobile = w <= 500
    const isTablet = w > 500 && w <= 900
    const padding = w <= 360 ? 14 : isMobile ? 18 : isTablet ? 24 : 36
    const colGap = w <= 360 ? 10 : isMobile ? 12 : isTablet ? 16 : 24
    const rowGap = w <= 360 ? 24 : isMobile ? 28 : isTablet ? 34 : 44
    const navH = w <= 360 ? 52 : isMobile ? 56 : isTablet ? 60 : 70
    const defaultCardCols = isMobile ? 1 : isTablet ? 2 : 4
    return {
      width: w,
      height: isMobile ? 844 : isTablet ? 1024 : 900,
      name: `${w}px Viewport`,
      padding,
      colGap,
      rowGap,
      navH,
      defaultCardCols,
    }
  }

  const key = String(target).toLowerCase()
  return RLM_VIEWPORTS[key] || RLM_VIEWPORTS['mobile']
}

/**
 * End-to-end RLM Conversion Engine.
 * Converts any source artboard into a clean, responsive Auto Layout design for any target viewport.
 */
export async function convertWithRLM(
  clone: FrameNode,
  viewport: string | number | RLMViewport = 'mobile',
  log: string[] = []
): Promise<RLMValidationResult> {
  const vp = resolveViewport(viewport)
  log.push(`[RLM] Starting Universal Responsive Layout Conversion for ${vp.name} (${vp.width}x${vp.height})`)

  // Stage 1: Read-only parse
  const rlmRoot = parseSceneNodeToRLM(clone)
  log.push(`[RLM] Parsed SceneNode tree: ${rlmRoot.children.length} top-level nodes`)

  // Stage 2: Semantic Pattern Recognition & Confidence Scoring
  classifyRLMTree(rlmRoot, clone.height)
  log.push(`[RLM] Semantic classification complete`)

  // Stage 3: Responsive Layout Planning
  planResponsiveLayout(rlmRoot, vp)
  log.push(`[RLM] Responsive intents planned for ${vp.name}`)

  // Stage 3.5: Dedicated Overflow & Clipping Analysis
  for (const section of rlmRoot.children) {
    const report = analyzeSectionOverflow(section, vp, vp.width - vp.padding * 2)
    if (report.hasAccidentalOverflow) {
      log.push(`[RLM Overflow] "${section.name}": detected accidental overflow; corrected bounds`)
    }
    if (report.hasClippedContent) {
      log.push(`[RLM Clipping Guard] "${section.name}": expanded vertical bounds to prevent clipping essential copy`)
    }
  }

  // Stage 4: Pre-execution validation
  const preAudit = validateRLMPlan(rlmRoot, vp)
  if (!preAudit.valid) {
    log.push(`[RLM Validation Warning] Issues found: ${preAudit.issues.join('; ')}`)
  }

  // Stage 5: Mobile-Native Auto Layout Generation
  await applyRLMNodeToFigma(rlmRoot, vp, log)
  log.push(`[RLM] Generated mobile-native Auto Layout structure`)

  // Stage 5.5: Mobile Navigation & Menu Component Generation
  if (vp.width < 768) {
    const navSection = findNavigationRLM(rlmRoot)
    if (navSection) {
      await transformMobileNavigation(navSection, vp, clone, log)
    }
  }

  // Stage 6: Post-generation audit
  const postAudit = validateRLMPlan(rlmRoot, vp)
  log.push(`[RLM Health Score] ${postAudit.healthScore}/100`)

  return postAudit
}
