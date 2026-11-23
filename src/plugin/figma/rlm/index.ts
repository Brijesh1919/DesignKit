// ============================================================
// src/plugin/figma/rlm/index.ts
// Responsive Layout Model (RLM) Conversion Pipeline
// 100% Offline & Deterministic — Zero External Dependencies
// ============================================================

import type { RLMValidationResult, RLMViewport } from './types'
import { parseSceneNodeToRLM } from './parser'
import { classifyRLMTree } from './classifier'
import { planResponsiveLayout } from './planner'
import { applyRLMNodeToFigma } from './generator'
import { validateRLMPlan } from './validator'
import { analyzeSectionOverflow } from './overflowAnalyzer'

export * from './types'
export * from './relationships'
export * from './parser'
export * from './classifier'
export * from './planner'
export * from './generator'
export * from './validator'
export * from './overflowAnalyzer'

export const RLM_VIEWPORTS: Record<string, RLMViewport> = {
  laptop: { width: 1024, height: 768, name: 'Laptop', padding: 32, colGap: 20, rowGap: 40, navH: 64, defaultCardCols: 3 },
  tablet: { width: 768, height: 1024, name: 'Tablet', padding: 24, colGap: 16, rowGap: 34, navH: 60, defaultCardCols: 2 },
  mobile: { width: 390, height: 844, name: 'Mobile', padding: 20, colGap: 12, rowGap: 28, navH: 56, defaultCardCols: 1 },
  'small-mobile': { width: 320, height: 568, name: 'Small Mobile', padding: 16, colGap: 10, rowGap: 24, navH: 52, defaultCardCols: 1 },
}

/**
 * End-to-end RLM Conversion Engine.
 * Converts a cloned desktop artboard into a clean, mobile-native Auto Layout design.
 */
export async function convertWithRLM(
  clone: FrameNode,
  viewportId = 'mobile',
  log: string[] = []
): Promise<RLMValidationResult> {
  const vp = RLM_VIEWPORTS[viewportId] || RLM_VIEWPORTS['mobile']
  log.push(`[RLM] Starting Responsive Layout Model Conversion for ${vp.name} (${vp.width}x${vp.height})`)

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

  // Stage 6: Post-generation audit
  const postAudit = validateRLMPlan(rlmRoot, vp)
  log.push(`[RLM Health Score] ${postAudit.healthScore}/100`)

  return postAudit
}
