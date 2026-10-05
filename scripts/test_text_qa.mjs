// ============================================================
// Text QA Engine Unit & Integration Tests
// ============================================================

import assert from 'assert'
import { SpacingChecker } from '../src/ui/tools/content/checkers/SpacingChecker.js'
import { SpellingChecker } from '../src/ui/tools/content/checkers/SpellingChecker.js'
import { GrammarChecker } from '../src/ui/tools/content/checkers/GrammarChecker.js'
import { TypographyChecker } from '../src/ui/tools/content/checkers/TypographyChecker.js'
import { runAllCheckers } from '../src/ui/tools/content/checkers/TextChecker.js'
import { IssueManager } from '../src/ui/tools/content/IssueManager.js'

console.log('🧪 Starting Text QA test suite...\n')

// 1. Spacing Checker: Multiple spaces
{
  const node = { nodeId: '1', nodeName: 'Layer 1', characters: 'Hello  world     test', textContent: 'Hello  world     test' }
  const issues = SpacingChecker.check(node)
  assert.strictEqual(issues.length, 2, 'Should find 2 multi-space issues')
  assert.strictEqual(issues[0].original, '  ')
  assert.strictEqual(issues[0].message, 'Extra space detected.')
  assert.strictEqual(issues[0].replacement, ' ')
  assert.strictEqual(issues[0].isSafe, true)

  assert.strictEqual(issues[1].original, '     ')
  assert.strictEqual(issues[1].replacement, ' ')
  assert.strictEqual(issues[1].isSafe, true)
  console.log('✅ Spacing: Multiple consecutive spaces passed')
}

// 2. Spacing Checker: Space before punctuation
{
  const node = { nodeId: '2', nodeName: 'Layer 2', characters: 'Hello , world . How are you ?', textContent: 'Hello , world . How are you ?' }
  const issues = SpacingChecker.check(node)
  const beforePunc = issues.filter(i => i.id.includes('before-punc'))
  assert.strictEqual(beforePunc.length, 3, 'Should find 3 space-before-punctuation issues')
  assert.strictEqual(beforePunc[0].replacement, ',')
  assert.strictEqual(beforePunc[1].replacement, '.')
  assert.strictEqual(beforePunc[2].replacement, '?')
  console.log('✅ Spacing: Space before punctuation passed')
}

// 3. Spacing Checker: Missing space after punctuation
{
  const node = { nodeId: '3', nodeName: 'Layer 3', characters: 'Hello,world;again:now', textContent: 'Hello,world;again:now' }
  const issues = SpacingChecker.check(node)
  const afterPunc = issues.filter(i => i.id.includes('after-punc'))
  assert.strictEqual(afterPunc.length, 3, 'Should find 3 missing-space-after-punctuation issues')
  assert.strictEqual(afterPunc[0].replacement, ', world')
  assert.strictEqual(afterPunc[1].replacement, '; again')
  assert.strictEqual(afterPunc[2].replacement, ': now')
  console.log('✅ Spacing: Missing space after punctuation passed')
}

// 4. Spacing Checker: Protection for URLs, emails, decimals, abbreviations
{
  const node = {
    nodeId: '4',
    nodeName: 'Layer 4',
    characters: 'Visit https://example.com, contact user@test.com, version 3.14, e.g. code.ts',
    textContent: 'Visit https://example.com, contact user@test.com, version 3.14, e.g. code.ts',
  }
  const issues = SpacingChecker.check(node)
  // Ensure no false positives inside example.com, user@test.com, 3.14, e.g., code.ts
  const falsePositives = issues.filter(i =>
    i.original.includes('example.com') ||
    i.original.includes('user@test.com') ||
    i.original.includes('3.14') ||
    i.original.includes('e.g.') ||
    i.original.includes('code.ts')
  )
  assert.strictEqual(falsePositives.length, 0, 'No false positives in protected tokens')
  console.log('✅ Spacing: Protected ranges (URLs, emails, decimals, code) passed')
}

// 5. Punctuation: Repeated punctuation
{
  const node = { nodeId: '5', nodeName: 'Layer 5', characters: 'Hello!! Really?? Two dots.. and ellipsis...', textContent: 'Hello!! Really?? Two dots.. and ellipsis...' }
  const issues = SpacingChecker.check(node)
  const repeated = issues.filter(i => i.type === 'PUNCTUATION')
  assert.strictEqual(repeated.length, 3, 'Should detect !!, ??, and .. but NOT ...')
  assert.strictEqual(repeated[0].original, '!!')
  assert.strictEqual(repeated[0].replacement, '!')
  assert.strictEqual(repeated[1].original, '??')
  assert.strictEqual(repeated[1].replacement, '?')
  assert.strictEqual(repeated[2].original, '..')
  assert.strictEqual(repeated[2].replacement, '.')
  console.log('✅ Punctuation: Repeated punctuation passed')
}

// 6. Spelling Checker: Common typos and design terms
{
  const node = {
    nodeId: '6',
    nodeName: 'Layer 6',
    characters: 'Welcome to our produuct. Fix the compnent and butten.',
    textContent: 'Welcome to our produuct. Fix the compnent and butten.',
  }
  const issues = await SpellingChecker.check(node)
  assert.strictEqual(issues.length, 3, 'Should detect 3 spelling errors')
  assert.strictEqual(issues[0].original, 'produuct')
  assert.strictEqual(issues[0].replacement, 'product')
  assert.strictEqual(issues[0].isSafe, false, 'Spelling must NOT be marked safe for auto-fix')

  assert.strictEqual(issues[1].original, 'compnent')
  assert.strictEqual(issues[1].replacement, 'component')

  assert.strictEqual(issues[2].original, 'butten')
  assert.strictEqual(issues[2].replacement, 'button')
  console.log('✅ Spelling: Detection and suggestion passed')
}

// 7. Grammar Checker: Indefinite articles, repeated words, modal phrases
{
  const node = {
    nodeId: '7',
    nodeName: 'Layer 7',
    characters: 'This is a apple and an car. We saw the the cat. You could of called.',
    textContent: 'This is a apple and an car. We saw the the cat. You could of called.',
  }
  const issues = await GrammarChecker.check(node)
  assert.ok(issues.length >= 4, 'Should detect grammar issues')

  const article1 = issues.find(i => i.original === 'a' && i.replacement === 'an')
  assert.ok(article1, 'Should suggest "an" for "a apple"')

  const article2 = issues.find(i => i.original === 'an' && i.replacement === 'a')
  assert.ok(article2, 'Should suggest "a" for "an car"')

  const repeat = issues.find(i => i.original === 'the the')
  assert.ok(repeat, 'Should detect repeated "the the"')

  const modal = issues.find(i => i.original === 'could of')
  assert.ok(modal, 'Should suggest "could have" for "could of"')
  console.log('✅ Grammar: Rule-based checks passed')
}

// 8. Typography Checker
{
  const node = {
    nodeId: '8',
    nodeName: 'Layer 8',
    characters: 'Dash--here and wait... it is ready.',
    textContent: 'Dash--here and wait... it is ready.',
  }
  const issues = TypographyChecker.check(node)
  assert.strictEqual(issues.length, 2, 'Should detect em dash and ellipsis')
  assert.strictEqual(issues[0].replacement, '—')
  assert.strictEqual(issues[1].replacement, '…')
  console.log('✅ Typography: Em dash and ellipsis passed')
}

// 9. IssueManager: Offset adjustment when correcting text
{
  const mgr = new IssueManager([
    {
      id: 'i1',
      nodeId: 'node-A',
      nodeName: 'Text A',
      type: 'SPACING',
      start: 5,
      end: 7,
      original: '  ',
      suggestions: [' '],
      replacement: ' ',
      message: 'Extra space',
      severity: 'WARNING',
      isSafe: true,
    },
    {
      id: 'i2',
      nodeId: 'node-A',
      nodeName: 'Text A',
      type: 'SPACING',
      start: 12,
      end: 14,
      original: '  ',
      suggestions: [' '],
      replacement: ' ',
      message: 'Extra space',
      severity: 'WARNING',
      isSafe: true,
    },
  ])

  assert.strictEqual(mgr.getActiveIssues().length, 2)
  // Apply correction to i1: replacing "  " (len 2) with " " (len 1) => delta is -1
  mgr.applyCorrection('i1', 'node-A', 5, 7, ' ')

  const remaining = mgr.getActiveIssues()
  assert.strictEqual(remaining.length, 1)
  assert.strictEqual(remaining[0].id, 'i2')
  // i2 start should have shifted from 12 to 11
  assert.strictEqual(remaining[0].start, 11, 'Subsequent issue start should shift by delta (-1)')
  assert.strictEqual(remaining[0].end, 13, 'Subsequent issue end should shift by delta (-1)')
  console.log('✅ IssueManager: Coordinate shifting on correction passed')
}

// 10. Run All Checkers Runner
{
  const nodes = [
    { nodeId: 'n1', nodeName: 'Header', characters: 'Welcome  to produuct', textContent: 'Welcome  to produuct' },
  ]
  const all = await runAllCheckers(nodes, [SpacingChecker, SpellingChecker, GrammarChecker, TypographyChecker])
  assert.ok(all.length >= 2, 'Should find spacing and spelling issues across runner')
  console.log('✅ TextChecker: Unified runner passed')
}

// 11. User's exact test case: "frame of of three layer textand"
{
  const nodes = [
    { nodeId: 'u1', nodeName: 'Layer 1', characters: 'frame of of three layer textand', textContent: 'frame of of three layer textand' },
  ]
  const all = await runAllCheckers(nodes, [SpacingChecker, SpellingChecker, GrammarChecker, TypographyChecker])
  const repeatOf = all.find(i => i.original === 'of of' || (i.start === 6 && i.replacement.includes('of')))
  assert.ok(repeatOf, 'Must detect repeated word "of of"')

  const spellingTextAnd = all.find(i => i.original.toLowerCase() === 'textand')
  assert.ok(spellingTextAnd, 'Must detect misspelled word "textand"')
  console.log('✅ User test case: "frame of of three layer textand" detected both spelling and grammar!')
}

// 12. Offline fallback test: directly testing SpellingChecker and GrammarChecker on user's text
{
  const node = { nodeId: 'u2', nodeName: 'Layer 2', characters: 'frame of of three layer textand', textContent: 'frame of of three layer textand' }
  const grammarIssues = await GrammarChecker.check(node)
  const spellingIssues = await SpellingChecker.check(node)

  const repeatOf = grammarIssues.find(i => i.original === 'of of')
  assert.ok(repeatOf, 'Offline GrammarChecker must detect "of of"')

  const spellingTextAnd = spellingIssues.find(i => i.original.toLowerCase() === 'textand')
  assert.ok(spellingTextAnd, 'Offline SpellingChecker must detect "textand"')
  console.log('✅ Offline fallback: Both SpellingChecker and GrammarChecker passed')
}

console.log('\n🎉 ALL TEXT QA TESTS PASSED SUCCESSFULLY!')


