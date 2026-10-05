import type { CollectedTextNode, TextIssue } from '../../../../shared/types'
import type { TextChecker } from './TextChecker'

export interface GrammarProvider {
  check(node: CollectedTextNode): Promise<TextIssue[] | null> | (TextIssue[] | null)
}

let externalGrammarProvider: GrammarProvider | null = null

/**
 * Register an external grammar provider if connected.
 */
export function setGrammarProvider(provider: GrammarProvider | null) {
  externalGrammarProvider = provider
}

let issueCounter = 0
function genId(prefix: string): string {
  issueCounter++
  return `issue-${prefix}-${Date.now()}-${issueCounter}`
}

/**
 * High-confidence rule-based grammar checks:
 * 1. Indefinite article "a" vs "an"
 * 2. Duplicate consecutive words ("the the", "in in", etc.)
 * 3. Modal helper mistakes ("could of" -> "could have")
 * 4. Unmistakable subject-verb agreement ("they is" -> "they are")
 * 5. Sentence capitalization (lowercase letter beginning a sentence)
 */
export const GrammarChecker: TextChecker = {
  id: 'grammar-checker',
  name: 'Grammar Checker',
  async check(node: CollectedTextNode): Promise<TextIssue[]> {
    // Check external provider if registered
    if (externalGrammarProvider) {
      try {
        const externalIssues = await externalGrammarProvider.check(node)
        if (externalIssues && externalIssues.length > 0) {
          return externalIssues
        }
      } catch {
        // Fall back to rule-based engine
      }
    }

    const text = node.characters
    const issues: TextIssue[] = []

    // ---------------------------------------------------------
    // 1. Indefinite article "a" vs "an"
    // ---------------------------------------------------------
    // Words starting with vowel sound but preceded by "a"
    const aBeforeVowelRegex = /\b(a)\s+([aeio]|un(?![sn])|hour|honor|honest)\w*\b/gi
    let match: RegExpExecArray | null
    while ((match = aBeforeVowelRegex.exec(text)) !== null) {
      const full = match[0]
      const article = match[1]
      const word = full.slice(article.length).trim()
      const lowerWord = word.toLowerCase()

      // Exclude exceptions that start with 'u' or 'eu' that have consonant /j/ sound
      if (
        lowerWord.startsWith('user') ||
        lowerWord.startsWith('usage') ||
        lowerWord.startsWith('unique') ||
        lowerWord.startsWith('unit') ||
        lowerWord.startsWith('universal') ||
        lowerWord.startsWith('university') ||
        lowerWord.startsWith('useful') ||
        lowerWord.startsWith('euro') ||
        lowerWord.startsWith('one')
      ) {
        continue
      }

      const isCapitalized = article[0] === article[0].toUpperCase()
      const replacementArticle = isCapitalized ? 'An' : 'an'
      const start = match.index
      const end = start + article.length

      issues.push({
        id: genId('gram-article'),
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        type: 'GRAMMAR',
        start,
        end,
        original: article,
        suggestions: [replacementArticle],
        replacement: replacementArticle,
        message: `Use "${replacementArticle}" instead of "${article}" before vowel sounds ("${word}").`,
        severity: 'WARNING',
        isSafe: false, // Grammar requires user confirmation
      })
    }

    // Words starting with consonant sound but preceded by "an"
    const anBeforeConsonantRegex = /\b(an)\s+([b-df-hj-np-tv-z]|user|usage|unique|unit|universal|university|useful|euro|one)\w*\b/gi
    while ((match = anBeforeConsonantRegex.exec(text)) !== null) {
      const full = match[0]
      const article = match[1]
      const word = full.slice(article.length).trim()
      const lowerWord = word.toLowerCase()

      // Exclude silent 'h' words (hour, honor, honest)
      if (
        lowerWord.startsWith('hour') ||
        lowerWord.startsWith('honor') ||
        lowerWord.startsWith('honest') ||
        lowerWord.startsWith('heir')
      ) {
        continue
      }

      const isCapitalized = article[0] === article[0].toUpperCase()
      const replacementArticle = isCapitalized ? 'A' : 'a'
      const start = match.index
      const end = start + article.length

      issues.push({
        id: genId('gram-article'),
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        type: 'GRAMMAR',
        start,
        end,
        original: article,
        suggestions: [replacementArticle],
        replacement: replacementArticle,
        message: `Use "${replacementArticle}" instead of "${article}" before consonant sounds ("${word}").`,
        severity: 'WARNING',
        isSafe: false,
      })
    }

    // ---------------------------------------------------------
    // 2. Duplicate consecutive words (any word repeated twice)
    // ---------------------------------------------------------
    const repeatedWordRegex = /\b([a-zA-Z]{2,})\s+\1\b/gi
    while ((match = repeatedWordRegex.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length
      const singleWord = match[1]

      issues.push({
        id: genId('gram-repeat'),
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        type: 'GRAMMAR',
        start,
        end,
        original: match[0],
        suggestions: [singleWord],
        replacement: singleWord,
        message: `Repeated word "${singleWord}".`,
        severity: 'WARNING',
        isSafe: false,
      })
    }

    // ---------------------------------------------------------
    // 3. Modal helper phrase mistakes ("could of", "should of", "would of")
    // ---------------------------------------------------------
    const modalPhraseRegex = /\b(could|should|would|must)\s+of\b/gi
    while ((match = modalPhraseRegex.exec(text)) !== null) {
      const modal = match[1]
      const start = match.index
      const end = start + match[0].length
      const replacement = `${modal} have`

      issues.push({
        id: genId('gram-modal'),
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        type: 'GRAMMAR',
        start,
        end,
        original: match[0],
        suggestions: [replacement],
        replacement,
        message: `Did you mean "${replacement}" instead of "${match[0]}"?`,
        severity: 'WARNING',
        isSafe: false,
      })
    }

    // ---------------------------------------------------------
    // 4. Basic subject-verb agreement errors ("they is", "we is", "you is", "I are")
    // ---------------------------------------------------------
    const svAgreementPatterns: [RegExp, string, string][] = [
      [/\bthey\s+is\b/gi, 'they are', 'Use "they are" instead of "they is".'],
      [/\bwe\s+is\b/gi, 'we are', 'Use "we are" instead of "we is".'],
      [/\byou\s+is\b/gi, 'you are', 'Use "you are" instead of "you is".'],
      [/\bI\s+is\b/gi, 'I am', 'Use "I am" instead of "I is".'],
      [/\bI\s+are\b/gi, 'I am', 'Use "I am" instead of "I are".'],
    ]

    for (const [regex, replacement, message] of svAgreementPatterns) {
      while ((match = regex.exec(text)) !== null) {
        const start = match.index
        const end = start + match[0].length
        // match capitalization
        const isCap = match[0][0] === match[0][0].toUpperCase()
        const finalReplacement = isCap ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement

        issues.push({
          id: genId('gram-sv'),
          nodeId: node.nodeId,
          nodeName: node.nodeName,
          type: 'GRAMMAR',
          start,
          end,
          original: match[0],
          suggestions: [finalReplacement],
          replacement: finalReplacement,
          message,
          severity: 'WARNING',
          isSafe: false,
        })
      }
    }

    // ---------------------------------------------------------
    // 5. Sentence capitalization (starts with lowercase letter after . ! ?)
    // ---------------------------------------------------------
    const sentenceCapRegex = /(?:[.!?]\s+)([a-z])([a-zA-Z]*)\b/g
    while ((match = sentenceCapRegex.exec(text)) !== null) {
      const matchFull = match[0]
      const lowerInitial = match[1]
      const restOfWord = match[2]
      const word = lowerInitial + restOfWord

      // Don't flag if preceded by common abbreviations (e.g., i.e., etc., vs., oz., etc.)
      const textBefore = text.slice(0, match.index + 1).trim()
      if (/\b(e\.g|i\.e|etc|vs|a\.m|p\.m|al|inc|co|ltd|approx|dept|fig|no|oz|lb|dr|mr|mrs|ms)\.$/i.test(textBefore)) {
        continue
      }

      // Don't flag if part of URL or file extension
      if (/\.(com|org|net|io|co|ai|app|dev|html|js|ts|css|png|jpg|pdf)\b/i.test(textBefore + matchFull)) {
        continue
      }

      const start = match.index + (matchFull.length - word.length)
      const end = start + word.length
      const capitalized = lowerInitial.toUpperCase() + restOfWord

      issues.push({
        id: genId('gram-cap'),
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        type: 'GRAMMAR',
        start,
        end,
        original: word,
        suggestions: [capitalized],
        replacement: capitalized,
        message: `Sentence begins with lowercase letter: "${word}".`,
        severity: 'INFO',
        isSafe: false,
      })
    }

    return issues
  },
}
