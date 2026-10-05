import { GrammarChecker } from '../src/ui/tools/content/checkers/GrammarChecker.ts'
import { TypographyChecker } from '../src/ui/tools/content/checkers/TypographyChecker.ts'
import { SpacingChecker } from '../src/ui/tools/content/checkers/SpacingChecker.ts'
import { SpellingChecker } from '../src/ui/tools/content/checkers/SpellingChecker.ts'
import { checkLanguageTool } from '../src/ui/tools/content/checkers/LanguageToolChecker.ts'
import { runAllCheckers } from '../src/ui/tools/content/checkers/TextChecker.ts'

const validCopyList = [
  'Drinkware & Ice Cooler for every occasion',
  'Our drinkware & Ice Cooler line',
  "Request a quote and we'll share our full range of styles, colors & finishes.",
  'MADE FOR THE MOMENTS THAT MATTER',
  'DESIGNED FOR EVERY OCCASION',
  'EMPLOYEE GIFTS',
  'CLIENT GIFTS',
  'EVENTS & TRADE SHOWS',
  'TEAM & GROUP ORDERS',
  'Onboarding kits, anniversaries, and holiday gifting.',
  'Premium thank you gifts for valued clients and top accounts.',
  'High visibility branded giveaways that keep your company top of mind.',
  'Consistent branding across teams, departments, and large scale orders.',
  'A streamlined process designed to make custom corporate drinkware',
  'Your dedicated representative collects your artwork and walks you through the available options.',
  "We'll send an art proof for your approval before anything goes to production.",
  'Fast turnaround, shipped directly you with complete tracking information.',
  '18oz Pelican Ridge™ Mug',
  '26oz Pelican Pacific™ Water Bottle',
  '40oz Pelican Porter Dual Lid Tumbler',
  'CONTACT NAME *',
  'CONTACT PHONE',
  'COMPANY NAME *',
  'BUSINESS EMAIL *',
  'PRODUCT INTEREST *(You can select multiple products)',
  'ESTIMATED QUANTITY *',
  'Water Bottles',
  'Tumblers',
  'MESSAGE (Optional)'
]

const realTyposList = [
  'CORRPORATE',
  'diffferent',
  'recuognition',
  'produuct',
  'textand',
  'compnent',
  'They is working',
  'could of been',
  'hello   world',
  'Hello , world',
  'Hello,world',
  'Hello!!',
  'Hello--world',
  'Hello...'
]

const checkers = [SpacingChecker, SpellingChecker, GrammarChecker, TypographyChecker]

async function runTests() {
  console.log('=== TEST 1: Valid Copy (Should have 0 false positive issues) ===')
  let falsePositiveCount = 0
  for (const text of validCopyList) {
    const node = { nodeId: 'test', nodeName: 'Text', characters: text, fontSize: 16, fontFamily: 'Inter' }
    const issues = await runAllCheckers([node], checkers)
    if (issues.length > 0) {
      console.log(`❌ FALSE POSITIVE on "${text}":`)
      for (const iss of issues) {
        console.log(`   [${iss.type}] "${iss.original}" -> "${iss.replacement}" (${iss.message})`)
      }
      falsePositiveCount += issues.length
    } else {
      console.log(`✅ Clean: "${text}"`)
    }
  }

  console.log(`\nTotal False Positives: ${falsePositiveCount}`)

  console.log('\n=== TEST 2: Genuine Errors (Must be caught accurately) ===')
  let caughtCount = 0
  for (const text of realTyposList) {
    const node = { nodeId: 'test', nodeName: 'Text', characters: text, fontSize: 16, fontFamily: 'Inter' }
    const issues = await runAllCheckers([node], checkers)
    if (issues.length > 0) {
      console.log(`✅ Caught on "${text}":`)
      for (const iss of issues) {
        console.log(`   [${iss.type}] "${iss.original}" -> "${iss.replacement}"`)
      }
      caughtCount++
    } else {
      console.log(`❌ MISSED genuine error in "${text}"`)
    }
  }

  console.log(`\nCaught ${caughtCount} / ${realTyposList.length} genuine errors.`)
}

runTests()
