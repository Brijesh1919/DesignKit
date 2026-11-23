// ============================================================
// src/plugin/figma/rlm/validator.ts
// Node-Aware Validation & Layout Health Audit
// 100% Offline & Deterministic — Zero External Dependencies
// ============================================================

import type { RLMNode, RLMValidationResult, RLMViewport } from './types'

/**
 * Validates the planned RLM tree before and after generation.
 * Catches text squashing, container overflows, and missing sizing constraints.
 */
export function validateRLMPlan(
  root: RLMNode,
  vp: RLMViewport
): RLMValidationResult {
  const issues: string[] = []
  let textSquashCount = 0
  let overlapCount = 0
  let overflowCount = 0

  function auditNode(node: RLMNode) {
    // 1. Text Squashing Check
    if (node.typography) {
      const chars = node.typography.characters.trim()
      const isShort = chars.length <= 15
      const intentW = node.intent.targetWidth || node.geometry.width

      // If text is multi-word (length > 20) but constrained to <= 60px, it will cascade vertically!
      if (chars.length > 20 && intentW <= 60 && node.intent.textAutoResize === 'HEIGHT') {
        textSquashCount++
        issues.push(`Text node "${node.name}" (${chars.substring(0, 15)}...) width constrained to ${intentW}px; risks vertical ribbon squashing.`)
      }
    }

    // 2. Viewport Overflow Check
    const isLeafText = node.originalType === 'TEXT'
    const currentW = node.figmaNodeRef ? node.figmaNodeRef.width : (node.intent.targetWidth || node.geometry.width)
    if (!isLeafText && currentW > vp.width + 4 && node.role !== 'ROOT') {
      overflowCount++
      issues.push(`Container "${node.name}" width (${currentW}px) exceeds target viewport (${vp.width}px).`)
    }

    // 3. Corner Radius Distortion Check
    const minDim = Math.min(node.geometry.width, node.geometry.height)
    const isPill = node.role === 'BADGE_OR_PILL' || (node.role === 'BUTTON_PRIMARY' && minDim <= 56)
    if (!isPill && node.style.cornerRadii.tl > 28 && minDim > 80) {
      issues.push(`Container "${node.name}" has oversized corner radius (${node.style.cornerRadii.tl}px); risks stadium distortion.`)
    }

    for (const child of node.children) {
      auditNode(child)
    }
  }

  auditNode(root)

  // Compute Health Score: 100 base, deductions for critical failures
  let score = 100
  score -= textSquashCount * 15
  score -= overflowCount * 10
  score -= overlapCount * 10
  score = Math.max(0, Math.min(100, score))

  return {
    valid: textSquashCount === 0 && overflowCount === 0,
    healthScore: score,
    issues,
    textSquashCount,
    overlapCount,
    overflowCount,
  }
}
