import type { CollectedTextNode, TextIssue } from '../../../../shared/types'
import { checkLanguageTool } from './LanguageToolChecker'
import { SpacingChecker } from './SpacingChecker'

/**
 * TextChecker interface abstraction.
 * Allows any spelling, grammar, spacing, or typography provider to be connected cleanly.
 */
export interface TextChecker {
  id: string
  name: string
  check(node: CollectedTextNode): Promise<TextIssue[]> | TextIssue[]
}

/**
 * Check whether two issues overlap in character range on the same node.
 */
function rangesOverlap(a: TextIssue, b: TextIssue): boolean {
  if (a.nodeId !== b.nodeId) return false
  return Math.max(a.start, b.start) < Math.min(a.end, b.end)
}

import { OnnxTextChecker } from './OnnxTextChecker'

/**
 * Executes checkers over a collection of text nodes:
 * 1. Always runs all local checkers first (Spacing, Spelling, Grammar, Typography) — 0ms, 100% offline.
 * 2. If enableAI is true, runs the local ONNX neural grammar engine to detect deeper contextual anomalies.
 * 3. Queries LanguageTool (with cache) if available for additional verification.
 * 4. Merges and deduplicates issues cleanly without overlap.
 */
export async function runAllCheckers(
  nodes: CollectedTextNode[],
  fallbackCheckers: TextChecker[],
  enableAI: boolean = false,
  onProgress?: (msg: string) => void
): Promise<TextIssue[]> {
  const allIssues: TextIssue[] = []

  let processedCount = 0
  for (const node of nodes) {
    if (!node.characters || !node.characters.trim()) {
      continue
    }

    processedCount++
    if (enableAI && onProgress) {
      onProgress(`Analyzing layer ${processedCount}/${nodes.length} with Local ONNX…`)
    }

    const nodeIssues: TextIssue[] = []

    // 1. Always run all local checkers first (Spacing, Spelling, Grammar, Typography)
    // Instant, 100% offline, deterministic, and immune to rate limits
    for (const checker of fallbackCheckers) {
      try {
        const issues = await checker.check(node)
        for (const issue of issues) {
          const hasOverlap = nodeIssues.some(existing => rangesOverlap(existing, issue))
          if (!hasOverlap) {
            nodeIssues.push(issue)
          }
        }
      } catch (err) {
        console.warn(`[DesignKit TextQA] Checker "${checker.name}" error on node ${node.nodeName}:`, err)
      }
    }

    // 2. Run Local ONNX Neural Checker if enabled
    if (enableAI) {
      try {
        const aiIssues = await OnnxTextChecker.check(node)
        for (const aiIssue of aiIssues) {
          const hasOverlap = nodeIssues.some(existing => rangesOverlap(existing, aiIssue))
          if (!hasOverlap) {
            nodeIssues.push(aiIssue)
          }
        }
      } catch (err) {
        console.warn(`[DesignKit TextQA] ONNX AI Checker error:`, err)
      }
    }

    // 3. Query LanguageTool (with cache) for any additional semantic / contextual issues
    try {
      const ltIssues = await checkLanguageTool(node)
      if (ltIssues && ltIssues.length > 0) {
        for (const ltIssue of ltIssues) {
          const hasOverlap = nodeIssues.some(existing => rangesOverlap(existing, ltIssue))
          if (!hasOverlap) {
            nodeIssues.push(ltIssue)
          }
        }
      }
    } catch {
      // Local checkers have already run and guaranteed issue detection
    }

    // Populate context snippet for each issue
    for (const issue of nodeIssues) {
      if (!issue.contextBefore && !issue.contextAfter) {
        const preStart = Math.max(0, issue.start - 35)
        const postEnd = Math.min(node.characters.length, issue.end + 35)
        issue.contextBefore = (preStart > 0 ? '…' : '') + node.characters.slice(preStart, issue.start)
        issue.contextAfter = node.characters.slice(issue.end, postEnd) + (postEnd < node.characters.length ? '…' : '')
      }
    }

    allIssues.push(...nodeIssues)
  }

  // Sort issues by node ID, then by start position
  allIssues.sort((a, b) => {
    if (a.nodeId !== b.nodeId) {
      return a.nodeId.localeCompare(b.nodeId)
    }
    return a.start - b.start
  })

  return allIssues
}
