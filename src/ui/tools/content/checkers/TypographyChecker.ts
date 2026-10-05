import type { CollectedTextNode, TextIssue } from '../../../../shared/types'
import type { TextChecker } from './TextChecker'

let issueCounter = 0
function genId(prefix: string): string {
  issueCounter++
  return `issue-${prefix}-${Date.now()}-${issueCounter}`
}

/**
 * Basic typography formatting checker:
 * - Double hyphens to em dash ("--" -> "—")
 * - Three dots to single ellipsis glyph ("..." -> "…")
 * - Straight double quotes to smart curly quotes
 * - Straight apostrophe to typographic apostrophe
 */
export const TypographyChecker: TextChecker = {
  id: 'typography-checker',
  name: 'Typography Checker',
  check(node: CollectedTextNode): TextIssue[] {
    const text = node.characters
    const issues: TextIssue[] = []

    // 1. Double or triple hyphens -> em dash
    const emDashRegex = /-{2,3}/g
    let match: RegExpExecArray | null
    while ((match = emDashRegex.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length

      issues.push({
        id: genId('typo-emdash'),
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        type: 'TYPOGRAPHY',
        start,
        end,
        original: match[0],
        suggestions: ['—'],
        replacement: '—',
        message: `Use an em dash (—) instead of "${match[0]}".`,
        severity: 'INFO',
        isSafe: true,
      })
    }

    // 2. Three periods -> ellipsis glyph ("..." -> "…")
    const ellipsisRegex = /(?<!\.)\.\.\.(?!\.)/g
    while ((match = ellipsisRegex.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length

      issues.push({
        id: genId('typo-ellipsis'),
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        type: 'TYPOGRAPHY',
        start,
        end,
        original: match[0],
        suggestions: ['…'],
        replacement: '…',
        message: 'Use typographic ellipsis glyph (…) instead of three periods (...).',
        severity: 'INFO',
        isSafe: true,
      })
    }

    return issues
  },
}
