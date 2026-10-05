import type { TextIssue, TextIssueType } from '../../../shared/types'

export type IssueFilter = 'ALL' | TextIssueType

export interface IssueCounts {
  total: number
  spelling: number
  grammar: number
  spacing: number
  punctuation: number
  typography: number
  safeCount: number
}

/**
 * Manages detected text issues, filters, ignore list, and coordinate adjustments
 * when text replacements occur.
 */
export class IssueManager {
  private issues: TextIssue[] = []
  private ignoredIds: Set<string> = new Set()

  constructor(initialIssues: TextIssue[] = []) {
    this.issues = [...initialIssues]
  }

  public setIssues(newIssues: TextIssue[]): void {
    this.issues = [...newIssues]
  }

  public getActiveIssues(): TextIssue[] {
    return this.issues.filter(i => !this.ignoredIds.has(i.id))
  }

  public getFilteredIssues(filter: IssueFilter): TextIssue[] {
    const active = this.getActiveIssues()
    if (filter === 'ALL') return active
    return active.filter(i => i.type === filter)
  }

  public ignoreIssue(issueId: string): void {
    this.ignoredIds.add(issueId)
  }

  public clearIgnored(): void {
    this.ignoredIds.clear()
  }

  /**
   * Remove a corrected issue and update offsets of subsequent issues on the same node.
   */
  public applyCorrection(
    issueId: string,
    nodeId: string,
    start: number,
    end: number,
    replacement: string
  ): void {
    const delta = replacement.length - (end - start)

    // Remove the corrected issue
    this.issues = this.issues.filter(i => i.id !== issueId)

    // Shift coordinates of any following issues on the same text node
    if (delta !== 0) {
      for (const issue of this.issues) {
        if (issue.nodeId === nodeId && issue.start >= end) {
          issue.start += delta
          issue.end += delta
        }
      }
    }
  }

  /**
   * Remove a batch of issues that were safely fixed.
   */
  public removeBatch(issueIds: string[]): void {
    const idSet = new Set(issueIds)
    this.issues = this.issues.filter(i => !idSet.has(i.id))
  }

  public getSafeIssues(): TextIssue[] {
    return this.getActiveIssues().filter(i => i.isSafe === true)
  }

  public getCounts(): IssueCounts {
    const active = this.getActiveIssues()
    let spelling = 0
    let grammar = 0
    let spacing = 0
    let punctuation = 0
    let typography = 0
    let safeCount = 0

    for (const issue of active) {
      if (issue.isSafe) safeCount++
      switch (issue.type) {
        case 'SPELLING':
          spelling++
          break
        case 'GRAMMAR':
          grammar++
          break
        case 'SPACING':
          spacing++
          break
        case 'PUNCTUATION':
          punctuation++
          break
        case 'TYPOGRAPHY':
          typography++
          break
      }
    }

    return {
      total: active.length,
      spelling,
      grammar,
      spacing,
      punctuation,
      typography,
      safeCount,
    }
  }
}
