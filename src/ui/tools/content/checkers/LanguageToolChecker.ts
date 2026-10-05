import type { CollectedTextNode, TextIssue, TextIssueType, TextIssueSeverity } from '../../../../shared/types'
import { isValidEnglishWord } from './dictionary'

let issueCounter = 0
function genId(prefix: string): string {
  issueCounter++
  return `issue-${prefix}-${Date.now()}-${issueCounter}`
}

interface LanguageToolReplacement {
  value: string
}

interface LanguageToolRule {
  id: string
  description: string
  issueType?: string
  category?: {
    id: string
    name: string
  }
}

interface LanguageToolMatch {
  message: string
  shortMessage?: string
  offset: number
  length: number
  replacements: LanguageToolReplacement[]
  rule?: LanguageToolRule
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[]
}

const ltCache = new Map<string, TextIssue[]>()
const MAX_CACHE_SIZE = 150

/**
 * Checks a text string against the LanguageTool public API.
 * Uses an in-memory LRU cache so repeated selections/scans are instant and immune to rate limits.
 * Returns normalized TextIssue[] or null if network is unavailable or times out.
 */
export async function checkLanguageTool(node: CollectedTextNode): Promise<TextIssue[] | null> {
  const text = node.characters.trim()
  if (!text) return []

  const cacheKey = node.characters
  if (ltCache.has(cacheKey)) {
    const cached = ltCache.get(cacheKey)!
    return cached.map(iss => ({
      ...iss,
      id: genId(iss.type.toLowerCase()),
      nodeId: node.nodeId,
      nodeName: node.nodeName,
    }))
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4000)

  try {
    const params = new URLSearchParams()
    params.append('text', node.characters)
    params.append('language', 'en-US')

    const response = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as LanguageToolResponse
    if (!data || !Array.isArray(data.matches)) {
      return null
    }

    const issues: TextIssue[] = []

    for (const match of data.matches) {
      const start = match.offset
      const end = start + match.length
      const original = node.characters.slice(start, end)
      const suggestions = match.replacements.slice(0, 5).map(r => r.value)
      const replacement = suggestions[0] || original

      const catId = match.rule?.category?.id?.toUpperCase() || ''
      const issueType = match.rule?.issueType?.toLowerCase() || ''
      const ruleId = match.rule?.id || ''

      // Ignore casing rules (e.g. UPPERCASE_SENTENCE_START) and subjective style suggestions
      if (catId === 'CASING' || catId === 'STYLE') {
        continue
      }

      // Ignore optional compound sentence comma ("... quote and we'll ...")
      if (ruleId === 'COMMA_COMPOUND_SENTENCE') {
        continue
      }

      // Ignore straight vs curly apostrophe in typography suggestions
      if (catId === 'TYPOGRAPHY' && original.includes("'")) {
        continue
      }

      let type: TextIssueType = 'GRAMMAR'
      let severity: TextIssueSeverity = 'WARNING'
      let isSafe = false

      if (catId === 'TYPOS' || issueType === 'misspelling') {
        // If word is a valid English word (including inflections like plurals -s, past tense -ed, etc.), do not flag!
        if (isValidEnglishWord(original)) {
          continue
        }
        type = 'SPELLING'
        severity = 'ERROR'
        isSafe = false
      } else if (catId === 'TYPOGRAPHY') {
        type = 'TYPOGRAPHY'
        severity = 'INFO'
      } else if (catId === 'PUNCTUATION') {
        type = 'PUNCTUATION'
        severity = 'WARNING'
        if (original.match(/^[!?,.;:]+$/)) {
          isSafe = true
        }
      } else if (catId === 'WHITESPACE') {
        type = 'SPACING'
        severity = 'WARNING'
        isSafe = true
      } else {
        type = 'GRAMMAR'
        severity = 'WARNING'
        isSafe = false
      }

      issues.push({
        id: genId(type.toLowerCase()),
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        type,
        start,
        end,
        original,
        suggestions,
        replacement,
        message: match.message,
        severity,
        isSafe,
      })
    }

    if (ltCache.size >= MAX_CACHE_SIZE) {
      const firstKey = ltCache.keys().next().value
      if (firstKey) ltCache.delete(firstKey)
    }
    ltCache.set(cacheKey, issues)

    return issues
  } catch (err) {
    clearTimeout(timeoutId)
    // Silently fall back to offline checker on network error/abort
    return null
  }
}
