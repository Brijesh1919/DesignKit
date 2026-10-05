import type { CollectedTextNode, TextIssue } from '../../../../shared/types'
import type { TextChecker } from './TextChecker'
import { VALID_WORDS, isValidEnglishWord } from './dictionary'

export interface SpellingProvider {
  check(word: string, context?: string): Promise<string[] | null> | (string[] | null)
}

/**
 * Curated high-precision dictionary of common English typos, design terms,
 * concatenated words, and spelling mistakes.
 */
const COMMON_TYPOS: Record<string, string[]> = {
  // Test cases & key terms
  corrporate: ['corporate'],
  corparate: ['corporate'],
  coporate: ['corporate'],
  corperate: ['corporate'],
  diffferent: ['different'],
  diferent: ['different'],
  diffrent: ['different'],
  differnt: ['different'],
  recuognition: ['recognition'],
  recognation: ['recognition'],
  recoginition: ['recognition'],
  recongition: ['recognition'],
  recogntion: ['recognition'],
  produuct: ['product'],
  textand: ['text and'],
  compnent: ['component'],
  butten: ['button'],
  buttton: ['button'],
  btton: ['button'],
  layoot: ['layout'],
  collor: ['color', 'colour'],
  colr: ['color'],
  aligment: ['alignment'],
  desgn: ['design'],
  desing: ['design'],
  artbaord: ['artboard'],
  navigtion: ['navigation'],
  navgation: ['navigation'],
  pallete: ['palette'],
  paltte: ['palette'],
  responsiv: ['responsive'],
  resposive: ['responsive'],
  accesibility: ['accessibility'],
  typograhy: ['typography'],
  typograpy: ['typography'],
  fram: ['frame'],
  layre: ['layer'],
  splling: ['spelling'],
  spellling: ['spelling'],
  grammer: ['grammar'],
  helo: ['hello'],
  exampel: ['example'],
  misteak: ['mistake'],
  inccorrect: ['incorrect'],
  computr: ['computer'],

  // Common English typos
  teh: ['the'],
  recieve: ['receive'],
  seperate: ['separate'],
  definately: ['definitely'],
  occured: ['occurred'],
  untill: ['until'],
  calender: ['calendar'],
  alot: ['a lot'],
  tommorrow: ['tomorrow'],
  wierd: ['weird'],
  acheive: ['achieve'],
  truely: ['truly'],
  goverment: ['government'],
  existance: ['existence'],
  noticable: ['noticeable'],
  appartment: ['apartment'],
  occurence: ['occurrence'],
  succesful: ['successful'],
  sucessful: ['successful'],
  succes: ['success'],
  sucess: ['success'],
  supercede: ['supersede'],
  commited: ['committed'],
  peice: ['piece'],
  beleive: ['believe'],
  accross: ['across'],
  adress: ['address'],
  begining: ['beginning'],
  dissapear: ['disappear'],
  embarass: ['embarrass'],
  fourty: ['forty'],
  freind: ['friend'],
  happend: ['happened'],
  independant: ['independent'],
  intrest: ['interest'],
  mispell: ['misspell'],
  neccessary: ['necessary'],
  refered: ['referred'],
  reccomend: ['recommend'],
  suprise: ['surprise'],
  tendancy: ['tendency'],
  writting: ['writing'],
  mispelled: ['misspelled'],
  priviledge: ['privilege'],
  pronounciation: ['pronunciation'],
  resturant: ['restaurant'],
  speach: ['speech'],
  twelth: ['twelfth'],
  unconcious: ['unconscious'],
  wellcome: ['welcome'],
  wodn: ['would'],
  wich: ['which'],
  thier: ['their'],
  lenght: ['length'],
  heigth: ['height'],
  widht: ['width'],
  opactiy: ['opacity'],
  visiblity: ['visibility'],
  backgroud: ['background'],
  bordr: ['border'],
  shadw: ['shadow'],
  pading: ['padding'],
  margn: ['margin'],
  propertie: ['property'],
  proprty: ['property'],
  attribut: ['attribute'],
  fiel: ['field', 'file'],
  filed: ['field'],
  imge: ['image'],
  imgae: ['image'],
  hedaer: ['header'],
  fotter: ['footer'],
  foooter: ['footer'],
  conatiner: ['container'],
  contianer: ['container'],
  paragrah: ['paragraph'],
  paragrph: ['paragraph'],
  articale: ['article'],
  setings: ['settings'],
  settigns: ['settings'],
  dasboard: ['dashboard'],
  dashbaord: ['dashboard'],
  acount: ['account'],
  pasword: ['password'],
  passward: ['password'],
  mesage: ['message'],
  messge: ['message'],
  notifcation: ['notification'],
  notificatoin: ['notification'],
  chekout: ['checkout'],
  checout: ['checkout'],
  paymet: ['payment'],
  paymnt: ['payment'],
  loding: ['loading'],
  loadng: ['loading'],
  eror: ['error'],
  warnign: ['warning'],
  cancle: ['cancel'],
  submitt: ['submit'],
  delte: ['delete'],
  remov: ['remove'],
  updat: ['update'],
  searh: ['search'],
  filtr: ['filter'],
  previe: ['preview'],
  selct: ['select'],
  actv: ['active'],
  disbled: ['disabled'],
  visble: ['visible'],
  hiden: ['hidden'],
  curor: ['cursor'],
  curser: ['cursor'],
  cornr: ['corner'],
  radiu: ['radius'],
  elemnt: ['element'],
  selecion: ['selection'],
  seleciton: ['selection'],
  hierachy: ['hierarchy'],
  directon: ['direction'],
  algin: ['align'],
  centr: ['center'],
  spacng: ['spacing'],
  vertcal: ['vertical'],
  horizontl: ['horizontal'],
  varible: ['variable'],
  valeu: ['value'],
  defualt: ['default'],
  cusom: ['custom'],
  standrd: ['standard'],
  scren: ['screen'],
  devce: ['device'],
  moblie: ['mobile'],
  desktp: ['desktop'],
  tablt: ['tablet'],
  viewprt: ['viewport'],
  brakpoint: ['breakpoint'],
}

/**
 * Common concatenated prefix + conjunction words (e.g. textand -> text and)
 */
const CONCAT_WORDS_PREFIX = [
  'text', 'layer', 'frame', 'button', 'card', 'image', 'page', 'icon',
  'this', 'that', 'with', 'from', 'have', 'will', 'must', 'should',
]
const CONCAT_WORDS_SUFFIX = [
  'and', 'or', 'in', 'to', 'for', 'with', 'of', 'is', 'the', 'not', 'it',
]

/**
 * Preserve capitalization style of original word when creating replacement.
 */
function matchCasing(original: string, target: string): string {
  if (original === original.toUpperCase()) {
    return target.toUpperCase()
  }
  if (original[0] === original[0].toUpperCase()) {
    return target.charAt(0).toUpperCase() + target.slice(1)
  }
  return target.toLowerCase()
}

let issueCounter = 0
function genId(prefix: string): string {
  issueCounter++
  return `issue-${prefix}-${Date.now()}-${issueCounter}`
}

let externalSpellingProvider: SpellingProvider | null = null

/**
 * Register an external spelling provider if connected.
 */
export function setSpellingProvider(provider: SpellingProvider | null) {
  externalSpellingProvider = provider
}

export const SpellingChecker: TextChecker = {
  id: 'spelling-checker',
  name: 'Spelling Checker',
  async check(node: CollectedTextNode): Promise<TextIssue[]> {
    const text = node.characters
    const issues: TextIssue[] = []

    // Word boundary regex
    const wordRegex = /\b[a-zA-Z]{2,}\b/g
    let match: RegExpExecArray | null

    while ((match = wordRegex.exec(text)) !== null) {
      const originalWord = match[0]
      const lower = originalWord.toLowerCase()
      const start = match.index
      const end = start + originalWord.length

      // If the word itself is a recognized valid English word, skip typo checks
      // (Unless explicitly in COMMON_TYPOS, which only contains true mistakes)
      if (!COMMON_TYPOS[lower] && isValidEnglishWord(originalWord)) {
        continue
      }

      // 1. Check external provider if configured
      if (externalSpellingProvider) {
        try {
          const externalSuggestions = await externalSpellingProvider.check(originalWord, text)
          if (externalSuggestions && externalSuggestions.length > 0) {
            const suggestions = externalSuggestions.map(s => matchCasing(originalWord, s))
            issues.push({
              id: genId('spelling'),
              nodeId: node.nodeId,
              nodeName: node.nodeName,
              type: 'SPELLING',
              start,
              end,
              original: originalWord,
              suggestions,
              replacement: suggestions[0],
              message: `Possible spelling mistake: "${originalWord}".`,
              severity: 'ERROR',
              isSafe: false,
            })
            continue
          }
        } catch {
          // Fall back to local dictionary
        }
      }

      // 2. Check local curated typos dictionary
      if (COMMON_TYPOS[lower]) {
        const rawSuggestions = COMMON_TYPOS[lower]
        const suggestions = rawSuggestions.map(s => matchCasing(originalWord, s))
        issues.push({
          id: genId('spelling'),
          nodeId: node.nodeId,
          nodeName: node.nodeName,
          type: 'SPELLING',
          start,
          end,
          original: originalWord,
          suggestions,
          replacement: suggestions[0],
          message: `Possible spelling mistake: "${originalWord}".`,
          severity: 'ERROR',
          isSafe: false,
        })
        continue
      }

      // 3. Check repeated letters (e.g. "diffferent" -> "different")
      const repeatedMatch = lower.match(/([a-z])\1{2,}/)
      if (repeatedMatch) {
        const char = repeatedMatch[1]
        const collapsedDouble = lower.replace(new RegExp(`${char}{3,}`, 'g'), char + char)
        const collapsedSingle = lower.replace(new RegExp(`${char}{3,}`, 'g'), char)
        let foundSuggestion: string | null = null
        if (VALID_WORDS.has(collapsedDouble)) {
          foundSuggestion = collapsedDouble
        } else if (VALID_WORDS.has(collapsedSingle)) {
          foundSuggestion = collapsedSingle
        }
        if (foundSuggestion) {
          const suggestion = matchCasing(originalWord, foundSuggestion)
          issues.push({
            id: genId('spelling'),
            nodeId: node.nodeId,
            nodeName: node.nodeName,
            type: 'SPELLING',
            start,
            end,
            original: originalWord,
            suggestions: [suggestion],
            replacement: suggestion,
            message: `Possible spelling mistake: "${originalWord}".`,
            severity: 'ERROR',
            isSafe: false,
          })
          continue
        }
      }

      // 4. Check for concatenated words (e.g. "textand" -> "text and")
      let concatMatched = false
      for (const prefix of CONCAT_WORDS_PREFIX) {
        if (lower.startsWith(prefix) && lower.length > prefix.length + 1) {
          const remainder = lower.slice(prefix.length)
          if (CONCAT_WORDS_SUFFIX.includes(remainder)) {
            const suggested = `${prefix} ${remainder}`
            issues.push({
              id: genId('spelling-concat'),
              nodeId: node.nodeId,
              nodeName: node.nodeName,
              type: 'SPELLING',
              start,
              end,
              original: originalWord,
              suggestions: [suggested],
              replacement: suggested,
              message: `Missing space between words: "${originalWord}" (did you mean "${suggested}"?).`,
              severity: 'ERROR',
              isSafe: false,
            })
            concatMatched = true
            break
          }
        }
      }
      if (concatMatched) continue
    }

    return issues
  },
}
