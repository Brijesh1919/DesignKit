import type { CollectedTextNode, TextIssue } from '../../../../shared/types'
import type { TextChecker } from './TextChecker'
import { TextQAModel } from '../../../../ai/text/TextQAModel'

let issueIdCounter = 0
function genAiId(): string {
  issueIdCounter++
  return `issue-ai-${Date.now()}-${issueIdCounter}`
}

export class OnnxTextCheckerClass implements TextChecker {
  public id = 'onnx-text-ai'
  public name = 'Local ONNX Neural Checker'

  public async check(node: CollectedTextNode): Promise<TextIssue[]> {
    const text = node.characters
    if (!text || !text.trim()) return []

    const model = TextQAModel.getInstance()
    // Ensure initialized
    await model.initialize()

    const anomalies = await model.analyze(text)
    const issues: TextIssue[] = []

    for (const anom of anomalies) {
      issues.push({
        id: genAiId(),
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        type: anom.type,
        start: anom.start,
        end: anom.end,
        original: anom.original,
        replacement: anom.replacement,
        suggestions: anom.suggestions,
        message: `✨ AI: ${anom.explanation}`,
        severity: 'WARNING',
        isSafe: false,
      })
    }

    return issues
  }
}

export const OnnxTextChecker = new OnnxTextCheckerClass()
