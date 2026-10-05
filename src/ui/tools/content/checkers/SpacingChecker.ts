import type { CollectedTextNode, TextIssue } from '../../../../shared/types'
import type { TextChecker } from './TextChecker'

/**
 * Find ranges in text that should be protected from punctuation/spacing checks:
 * - URLs (http://, https://, www.)
 * - Email addresses
 * - Numbers with decimals or commas (3.14, 1,000)
 * - Abbreviations (e.g., i.e., etc., vs., a.m., p.m.)
 * - File extensions (.js, .html, etc.)
 */
function getProtectedRanges(text: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = []

  const patterns = [
    // URLs
    /https?:\/\/[^\s<>'"]+/gi,
    /www\.[^\s<>'"]+/gi,
    // Emails
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    // Numbers with commas/dots (e.g. 1,000, 3.14, $19.99)
    /\$?\d+([.,]\d+)+%?/g,
    // Version numbers (e.g. v1.0.0, 2.4.1)
    /v?\d+\.\d+(\.\d+)?/gi,
    // Common abbreviations
    /\b(e\.g\.|i\.e\.|etc\.|vs\.|a\.m\.|p\.m\.|al\.)/gi,
    // Common file extensions
    /\b\w+\.(js|ts|tsx|jsx|html|css|json|png|jpg|jpeg|svg|pdf|md)\b/gi,
    // Trademark, copyright, registered, degree symbols with surrounding space
    /[™®©°]\s*|\s*[™®©°]/g,
  ]

  for (const regex of patterns) {
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      ranges.push({
        start: match.index,
        end: match.index + match[0].length,
      })
    }
  }

  return ranges
}

function isInsideRange(pos: number, endPos: number, ranges: { start: number; end: number }[]): boolean {
  return ranges.some(r => (pos >= r.start && pos < r.end) || (endPos > r.start && endPos <= r.end))
}

let issueCounter = 0
function genId(prefix: string): string {
  issueCounter++
  return `issue-${prefix}-${Date.now()}-${issueCounter}`
}

export const SpacingChecker: TextChecker = {
  id: 'spacing-checker',
  name: 'Spacing & Punctuation Checker',
  check(node: CollectedTextNode): TextIssue[] {
    const text = node.characters
    const issues: TextIssue[] = []
    const protectedRanges = getProtectedRanges(text)

    // ---------------------------------------------------------
    // A & B: Multiple consecutive spaces
    // ---------------------------------------------------------
    const multiSpaceRegex = /[^\S\r\n]{2,}/g
    let match: RegExpExecArray | null
    while ((match = multiSpaceRegex.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length
      if (!isInsideRange(start, end, protectedRanges)) {
        const count = match[0].length
        issues.push({
          id: genId('spc-multi'),
          nodeId: node.nodeId,
          nodeName: node.nodeName,
          type: 'SPACING',
          start,
          end,
          original: match[0],
          suggestions: [' '],
          replacement: ' ',
          message: count === 2 ? 'Extra space detected.' : `${count} consecutive spaces detected.`,
          severity: 'WARNING',
          isSafe: true,
        })
      }
    }

    // ---------------------------------------------------------
    // C: Space before punctuation (" ,", " .", " !", " ?", " ;", " :")
    // ---------------------------------------------------------
    const spaceBeforePunc = /[^\S\r\n]+([,.;:?!])/g
    while ((match = spaceBeforePunc.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length
      const punc = match[1]
      if (!isInsideRange(start, end, protectedRanges)) {
        issues.push({
          id: genId('spc-before-punc'),
          nodeId: node.nodeId,
          nodeName: node.nodeName,
          type: 'SPACING',
          start,
          end,
          original: match[0],
          suggestions: [punc],
          replacement: punc,
          message: `Unexpected space before punctuation "${punc}".`,
          severity: 'WARNING',
          isSafe: true,
        })
      }
    }

    // ---------------------------------------------------------
    // D: Missing space after punctuation where clearly detectable
    // Example: "Hello,world" -> ",world"
    // ---------------------------------------------------------
    const missingSpaceAfter = /([,;:])([a-zA-Z]+)/g
    while ((match = missingSpaceAfter.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length
      const punc = match[1]
      const word = match[2]
      if (!isInsideRange(start, end, protectedRanges)) {
        issues.push({
          id: genId('spc-after-punc'),
          nodeId: node.nodeId,
          nodeName: node.nodeName,
          type: 'SPACING',
          start,
          end,
          original: match[0],
          suggestions: [`${punc} ${word}`],
          replacement: `${punc} ${word}`,
          message: `Missing space after "${punc}".`,
          severity: 'WARNING',
          isSafe: true,
        })
      }
    }

    // ---------------------------------------------------------
    // E: Repeated punctuation
    // Examples: "Hello!!" -> "!", "Really??" -> "?", "Hello.." -> "."
    // Ellipsis ("..." or "....") is preserved and not flagged as an error.
    // ---------------------------------------------------------
    // 1. Repeated exclamation marks (!!+)
    const repeatedExclamation = /!{2,}/g
    while ((match = repeatedExclamation.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length
      if (!isInsideRange(start, end, protectedRanges)) {
        issues.push({
          id: genId('punc-exclamation'),
          nodeId: node.nodeId,
          nodeName: node.nodeName,
          type: 'PUNCTUATION',
          start,
          end,
          original: match[0],
          suggestions: ['!'],
          replacement: '!',
          message: `Repeated punctuation "${match[0]}".`,
          severity: 'WARNING',
          isSafe: true,
        })
      }
    }

    // 2. Repeated question marks (??+)
    const repeatedQuestion = /\?{2,}/g
    while ((match = repeatedQuestion.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length
      if (!isInsideRange(start, end, protectedRanges)) {
        issues.push({
          id: genId('punc-question'),
          nodeId: node.nodeId,
          nodeName: node.nodeName,
          type: 'PUNCTUATION',
          start,
          end,
          original: match[0],
          suggestions: ['?'],
          replacement: '?',
          message: `Repeated punctuation "${match[0]}".`,
          severity: 'WARNING',
          isSafe: true,
        })
      }
    }

    // 3. Exactly two consecutive dots ("..") not part of ellipsis ("...")
    // Match two dots that are neither preceded nor followed by a dot
    const twoDots = /(?<!\.)\.\.(?!\.)/g
    while ((match = twoDots.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length
      if (!isInsideRange(start, end, protectedRanges)) {
        issues.push({
          id: genId('punc-twodots'),
          nodeId: node.nodeId,
          nodeName: node.nodeName,
          type: 'PUNCTUATION',
          start,
          end,
          original: match[0],
          suggestions: ['.'],
          replacement: '.',
          message: `Repeated punctuation "${match[0]}". Did you mean "." or an ellipsis "..."?`,
          severity: 'WARNING',
          isSafe: true,
        })
      }
    }

    // 4. Repeated commas (,,+)
    const repeatedCommas = /,{2,}/g
    while ((match = repeatedCommas.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length
      if (!isInsideRange(start, end, protectedRanges)) {
        issues.push({
          id: genId('punc-commas'),
          nodeId: node.nodeId,
          nodeName: node.nodeName,
          type: 'PUNCTUATION',
          start,
          end,
          original: match[0],
          suggestions: [','],
          replacement: ',',
          message: `Repeated punctuation "${match[0]}".`,
          severity: 'WARNING',
          isSafe: true,
        })
      }
    }



    // ---------------------------------------------------------
    // G: Excessive consecutive line breaks (3 or more newlines)
    // ---------------------------------------------------------
    const excessiveLineBreaks = /\n{3,}/g
    while ((match = excessiveLineBreaks.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length
      issues.push({
        id: genId('spc-linebreaks'),
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        type: 'SPACING',
        start,
        end,
        original: match[0],
        suggestions: ['\\n\\n'],
        replacement: '\n\n',
        message: 'Excessive consecutive line breaks detected.',
        severity: 'INFO',
        isSafe: true,
      })
    }

    return issues
  },
}
