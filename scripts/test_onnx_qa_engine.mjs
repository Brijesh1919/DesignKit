import { runAllCheckers } from '../src/ui/tools/content/checkers/TextChecker.ts'

import { SpacingChecker } from '../src/ui/tools/content/checkers/SpacingChecker.ts'
import { SpellingChecker } from '../src/ui/tools/content/checkers/SpellingChecker.ts'
import { GrammarChecker } from '../src/ui/tools/content/checkers/GrammarChecker.ts'
import { TypographyChecker } from '../src/ui/tools/content/checkers/TypographyChecker.ts'

const defaultCheckers = [SpacingChecker, SpellingChecker, GrammarChecker, TypographyChecker]

async function testAIQA() {
  console.log('Testing Text QA with and without Local ONNX AI...')

  const textFast = 'Hello , world! They is working on this produuct.'
  const nodeFast = [{ id: '1', nodeName: 'Header', characters: textFast }]
  const issuesFast = await runAllCheckers(nodeFast, defaultCheckers, false)
  console.log(`\nStandard Fast Checks count: ${issuesFast.length}`)
  for (const issue of issuesFast) {
    console.log(`- [${issue.type.toUpperCase()}] "${issue.original}" -> "${issue.replacement}" (Checker: ${issue.checkerId})`)
  }

  const textAI = 'Fast turnaround, shipped directly you with complete tracking information.'
  const nodeAI = [{ id: '2', nodeName: 'Body', characters: textAI }]
  const issuesAI = await runAllCheckers(nodeAI, defaultCheckers, true, (msg) => console.log(`Progress: ${msg}`))
  console.log(`\nDeep AI Checks count on "${textAI}": ${issuesAI.length}`)
  for (const issue of issuesAI) {
    console.log(`- [${issue.type.toUpperCase()}] "${issue.original}" -> "${issue.replacement}" (Checker: ${issue.checkerId}) - ${issue.message}`)
  }

  const homophoneText = 'Their are many reasons why you should choose us.'
  const nodeHomo = [{ id: '3', nodeName: 'Hero', characters: homophoneText }]
  const homophoneIssues = await runAllCheckers(nodeHomo, defaultCheckers, true)
  console.log(`\nDeep AI Checks count on "${homophoneText}": ${homophoneIssues.length}`)
  for (const issue of homophoneIssues) {
    console.log(`- [${issue.type.toUpperCase()}] "${issue.original}" -> "${issue.replacement}" (Checker: ${issue.checkerId}) - ${issue.message}`)
  }

  console.log('\nAI QA Engine test completed successfully!')
}

testAIQA().catch(console.error)
