import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  SelectionInfo,
  TextIssue,
  CollectTextNodesResponse,
  PluginMessage,
  ReviewHighlightItem,
} from '../../../shared/types'

const toHighlightItem = (i: TextIssue): ReviewHighlightItem => ({
  nodeId: i.nodeId,
  type: i.type,
  start: i.start,
  end: i.end,
  original: i.original,
  issueId: i.id,
})
import { SelectionBanner } from '../../components/Selection/SelectionBanner'
import { sendToPlugin } from '../../utils/messaging'
import { runAllCheckers } from './checkers/TextChecker'
import { SpacingChecker } from './checkers/SpacingChecker'
import { SpellingChecker } from './checkers/SpellingChecker'
import { GrammarChecker } from './checkers/GrammarChecker'
import { TypographyChecker } from './checkers/TypographyChecker'
import { IssueManager, type IssueFilter } from './IssueManager'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

// Icons
const ScanIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const FocusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="22" y1="12" x2="18" y2="12" />
    <line x1="6" y1="12" x2="2" y2="12" />
    <line x1="12" y1="6" x2="12" y2="2" />
    <line x1="12" y1="22" x2="12" y2="18" />
  </svg>
)

const LightningIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

const EyeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const TextQA: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [scanning, setScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [scannedRootName, setScannedRootName] = useState<string | null>(null)
  const [textNodeCount, setTextNodeCount] = useState<number | null>(null)
  const [filter, setFilter] = useState<IssueFilter>('ALL')
  const [reviewMode, setReviewMode] = useState(false)
  const [focusedIssueId, setFocusedIssueId] = useState<string | null>(null)
  const [issueStateTrigger, setIssueStateTrigger] = useState(0)

  // Issue manager instance
  const issueManager = useMemo(() => new IssueManager([]), [])

  // Checkers configuration
  const checkers = useMemo(
    () => [SpacingChecker, SpellingChecker, GrammarChecker, TypographyChecker],
    []
  )

  // Request text node collection from Figma plugin sandbox
  const handleScan = useCallback(() => {
    if (!selection || selection.count === 0) return
    setScanning(true)
    setHasScanned(false)
    sendToPlugin({ type: 'COLLECT_TEXT_NODES' })
  }, [selection])

  // Handle messages received from Figma sandbox
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined
      if (!msg?.type) return

      switch (msg.type) {
        case 'COLLECTED_TEXT_NODES': {
          const { nodes, rootName } = msg.payload as CollectTextNodesResponse
          setScannedRootName(rootName ?? (selection?.nodeName || 'Selected Layer'))
          setTextNodeCount(nodes.length)

          if (nodes.length === 0) {
            issueManager.setIssues([])
            setScanning(false)
            setHasScanned(true)
            setIssueStateTrigger(v => v + 1)
            return
          }

          try {
            const detectedIssues = await runAllCheckers(nodes, checkers)
            issueManager.setIssues(detectedIssues)
            setIssueStateTrigger(v => v + 1)

            // Update Review Mode highlights if currently ON
            if (reviewMode) {
              sendToPlugin({
                type: 'TEXT_QA_SET_HIGHLIGHTS',
                payload: {
                  enabled: true,
                  items: detectedIssues.map(toHighlightItem),
                },
              })
            }
          } catch (err) {
            console.error('[DesignKit TextQA] Error checking text:', err)
            onError('Failed to check text. Please try again.')
          } finally {
            setScanning(false)
            setHasScanned(true)
          }
          break
        }

        case 'TEXT_QA_CORRECTION_APPLIED': {
          const { issueId, nodeId, success } = msg.payload
          if (success) {
            const currentIssue = issueManager
              .getActiveIssues()
              .find(i => i.id === issueId)
            if (currentIssue) {
              issueManager.applyCorrection(
                issueId,
                nodeId,
                currentIssue.start,
                currentIssue.end,
                currentIssue.replacement
              )
              setIssueStateTrigger(v => v + 1)
              onSuccess(`Corrected: "${currentIssue.original}" → "${currentIssue.replacement}"`)

              // Update highlights if review mode is on
              if (reviewMode) {
                const remaining = issueManager.getActiveIssues()
                sendToPlugin({
                  type: 'TEXT_QA_SET_HIGHLIGHTS',
                  payload: {
                    enabled: true,
                    items: remaining.map(toHighlightItem),
                  },
                })
              }
            }
          }
          break
        }

        case 'TEXT_QA_BATCH_APPLIED': {
          const { count, success } = msg.payload
          if (success) {
            const safeIssues = issueManager.getSafeIssues()
            const fixedIds = safeIssues.map(i => i.id)
            issueManager.removeBatch(fixedIds)
            setIssueStateTrigger(v => v + 1)
            onSuccess(`Applied ${count} safe fix${count !== 1 ? 'es' : ''}`)

            // Update highlights if review mode is on
            if (reviewMode) {
              const remaining = issueManager.getActiveIssues()
              sendToPlugin({
                type: 'TEXT_QA_SET_HIGHLIGHTS',
                payload: {
                  enabled: true,
                  items: remaining.map(toHighlightItem),
                },
              })
            }
          }
          break
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [selection, checkers, issueManager, reviewMode, onSuccess, onError])

  // Clean up temporary Review Mode highlights when tool unmounts
  useEffect(() => {
    return () => {
      sendToPlugin({ type: 'TEXT_QA_CLEAR_HIGHLIGHTS' })
    }
  }, [])

  // Sync Review Mode toggle
  const toggleReviewMode = useCallback(() => {
    const nextState = !reviewMode
    setReviewMode(nextState)
    const active = issueManager.getActiveIssues()
    sendToPlugin({
      type: 'TEXT_QA_SET_HIGHLIGHTS',
      payload: {
        enabled: nextState,
        items: nextState ? active.map(toHighlightItem) : [],
      },
    })
  }, [reviewMode, issueManager])

  // Focus a specific word/range in Figma and highlight card in UI
  const handleFocusIssue = useCallback((issue: TextIssue) => {
    setFocusedIssueId(issue.id)
    sendToPlugin({
      type: 'TEXT_QA_FOCUS_WORD',
      payload: {
        nodeId: issue.nodeId,
        start: issue.start,
        end: issue.end,
        original: issue.original,
        issueType: issue.type,
      },
    })
  }, [])

  // Apply single correction
  const handleCorrect = useCallback(
    (e: React.MouseEvent, issue: TextIssue) => {
      e.stopPropagation()
      sendToPlugin({
        type: 'TEXT_QA_APPLY_CORRECTION',
        payload: {
          nodeId: issue.nodeId,
          start: issue.start,
          end: issue.end,
          original: issue.original,
          replacement: issue.replacement,
          issueId: issue.id,
        },
      })
    },
    []
  )

  // Ignore single issue
  const handleIgnore = useCallback(
    (e: React.MouseEvent, issueId: string) => {
      e.stopPropagation()
      issueManager.ignoreIssue(issueId)
      setIssueStateTrigger(v => v + 1)
      if (focusedIssueId === issueId) {
        setFocusedIssueId(null)
      }
      // Update highlights if review mode is on
      if (reviewMode) {
        const remaining = issueManager.getActiveIssues().filter(i => i.id !== issueId)
        sendToPlugin({
          type: 'TEXT_QA_SET_HIGHLIGHTS',
          payload: {
            enabled: true,
            items: remaining.map(toHighlightItem),
          },
        })
      }
    },
    [issueManager, focusedIssueId, reviewMode]
  )

  // Batch fix safe issues
  const handleFixSafeIssues = useCallback(() => {
    const safeIssues = issueManager.getSafeIssues()
    if (safeIssues.length === 0) return

    const corrections = safeIssues.map(i => ({
      nodeId: i.nodeId,
      start: i.start,
      end: i.end,
      original: i.original,
      replacement: i.replacement,
      issueId: i.id,
    }))

    sendToPlugin({
      type: 'TEXT_QA_APPLY_BATCH_CORRECTIONS',
      payload: { corrections },
    })
  }, [issueManager])

  // Derive counts & filtered issues (subscribed to issueStateTrigger)
  const counts = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    issueStateTrigger
    return issueManager.getCounts()
  }, [issueManager, issueStateTrigger])

  const filteredIssues = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    issueStateTrigger
    return issueManager.getFilteredIssues(filter)
  }, [issueManager, filter, issueStateTrigger])

  const hasSelection = selection && selection.count > 0
  const activeSelectionName =
    selection?.count === 1
      ? selection.nodeName || 'Selected Layer'
      : `${selection?.count ?? 0} selected layers`

  // Helper color map for issue type badges
  const typeBadgeStyles: Record<
    string,
    { label: string; dot: string; bg: string; text: string; border: string }
  > = {
    SPELLING: {
      label: 'Spelling',
      dot: '#EF4444',
      bg: '#FEF2F2',
      text: '#DC2626',
      border: '#FECACA',
    },
    GRAMMAR: {
      label: 'Grammar',
      dot: '#8B5CF6',
      bg: '#F5F3FF',
      text: '#7C3AED',
      border: '#DDD6FE',
    },
    SPACING: {
      label: 'Spacing',
      dot: '#F59E0B',
      bg: '#FFFBEB',
      text: '#D97706',
      border: '#FDE68A',
    },
    PUNCTUATION: {
      label: 'Punctuation',
      dot: '#EA580C',
      bg: '#FFF7ED',
      text: '#C2410C',
      border: '#FED7AA',
    },
    TYPOGRAPHY: {
      label: 'Typography',
      dot: '#2563EB',
      bg: '#EFF6FF',
      text: '#1D4ED8',
      border: '#BFDBFE',
    },
  }

  return (
    <div className="tool-view">
      {/* Header */}
      <div className="tool-header">
        <div className="tool-breadcrumb">Content</div>
        <h1 className="tool-title">Text QA</h1>
        <p className="tool-description">
          Audit text for spelling mistakes, grammar issues, extra/missing spaces, and punctuation inconsistencies.
        </p>
      </div>

      {/* Body */}
      <div className="tool-body">
        <SelectionBanner
          selection={selection}
          selectionHint="Select a text layer or frame to check its content."
          requiresSelection
        />

        {/* Scan Actions & Selection Bar */}
        <div
          className="card"
          style={{
            padding: 'var(--sp-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--sp-3)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 'var(--fs-xs)',
                fontWeight: 600,
                color: 'var(--c-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Target Object
            </div>
            <div
              style={{
                fontSize: 'var(--fs-md)',
                fontWeight: 600,
                color: hasSelection ? 'var(--c-text-primary)' : 'var(--c-text-disabled)',
                marginTop: 2,
              }}
            >
              {hasSelection ? (scannedRootName || activeSelectionName) : 'No selection'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <button
              className="btn btn-primary"
              onClick={handleScan}
              disabled={!hasSelection || scanning}
              id="text-qa-scan-btn"
            >
              <ScanIcon />
              {scanning ? 'Scanning…' : hasScanned ? 'Re-scan Selection' : 'Scan Selection'}
            </button>

            {hasScanned && (
              <button
                className={`btn ${reviewMode ? 'btn-primary' : 'btn-secondary'}`}
                onClick={toggleReviewMode}
                title="Toggle visual highlights over layers with issues"
                id="text-qa-review-mode-btn"
              >
                <EyeIcon />
                Review Mode {reviewMode ? 'ON' : 'OFF'}
              </button>
            )}

            {counts.safeCount > 0 && (
              <button
                className="btn btn-secondary"
                style={{ borderColor: 'var(--c-accent-border)', color: 'var(--c-accent)' }}
                onClick={handleFixSafeIssues}
                title="Automatically fix obvious duplicate spaces and punctuation"
                id="text-qa-fix-safe-btn"
              >
                <LightningIcon />
                Fix Safe Issues ({counts.safeCount})
              </button>
            )}
          </div>
        </div>

        {/* Empty State: No selection */}
        {!hasSelection && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="empty-state-title">No selection</div>
            <div className="empty-state-body">
              Select a text layer or frame to check its content.
            </div>
          </div>
        )}

        {/* Scanning State */}
        {hasSelection && scanning && (
          <div className="empty-state">
            <div
              style={{
                width: 36,
                height: 36,
                border: '3px solid var(--c-border)',
                borderTopColor: 'var(--c-accent)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <div className="empty-state-title" style={{ marginTop: 'var(--sp-2)' }}>
              Scanning text layers…
            </div>
            <div className="empty-state-body">
              Traversing selected hierarchy and checking spelling, grammar, and spacing.
            </div>
          </div>
        )}

        {/* Empty State: Selected object has no text */}
        {hasSelection && !scanning && hasScanned && textNodeCount === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 7 4 4 20 4 20 7" />
                <line x1="9" y1="20" x2="15" y2="20" />
                <line x1="12" y1="4" x2="12" y2="20" />
              </svg>
            </div>
            <div className="empty-state-title">No text found</div>
            <div className="empty-state-body">
              Select a frame containing text to scan it.
            </div>
          </div>
        )}

        {/* Scan Completed with Zero Issues */}
        {hasSelection && !scanning && hasScanned && textNodeCount !== null && textNodeCount > 0 && counts.total === 0 && (
          <div className="empty-state">
            <div
              className="empty-state-icon"
              style={{ background: 'var(--c-success-subtle)', color: 'var(--c-success)', borderColor: 'var(--c-success-border)' }}
            >
              <CheckIcon />
            </div>
            <div className="empty-state-title" style={{ color: 'var(--c-success-text)' }}>
              ✓ No text issues found
            </div>
            <div className="empty-state-body">
              Scanned {textNodeCount} text layer{textNodeCount !== 1 ? 's' : ''} in "{scannedRootName}". All spelling, grammar, and spacing checks passed cleanly.
            </div>
          </div>
        )}

        {/* Scan Results View */}
        {hasSelection && !scanning && hasScanned && counts.total > 0 && (
          <>
            {/* Stat Pill Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: 'var(--sp-2)',
              }}
            >
              {/* Total Card */}
              <div
                className="card"
                style={{
                  padding: 'var(--sp-3)',
                  cursor: 'pointer',
                  border: filter === 'ALL' ? '1.5px solid var(--c-accent)' : '1px solid var(--c-border)',
                  background: filter === 'ALL' ? 'var(--c-accent-subtle)' : 'var(--c-surface)',
                  transition: 'border-color 150ms ease, background 150ms ease',
                }}
                onClick={() => setFilter('ALL')}
              >
                <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', fontWeight: 600 }}>Total Issues</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                  {counts.total}
                </div>
              </div>

              {/* Spelling Card */}
              <div
                className="card"
                style={{
                  padding: 'var(--sp-3)',
                  cursor: 'pointer',
                  border: filter === 'SPELLING' ? '1.5px solid #EF4444' : '1px solid var(--c-border)',
                  background: filter === 'SPELLING' ? '#FEF2F2' : 'var(--c-surface)',
                  transition: 'border-color 150ms ease, background 150ms ease',
                }}
                onClick={() => setFilter('SPELLING')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
                  <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>Spelling</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                  {counts.spelling}
                </div>
              </div>

              {/* Grammar Card */}
              <div
                className="card"
                style={{
                  padding: 'var(--sp-3)',
                  cursor: 'pointer',
                  border: filter === 'GRAMMAR' ? '1.5px solid #8B5CF6' : '1px solid var(--c-border)',
                  background: filter === 'GRAMMAR' ? '#F5F3FF' : 'var(--c-surface)',
                  transition: 'border-color 150ms ease, background 150ms ease',
                }}
                onClick={() => setFilter('GRAMMAR')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6' }} />
                  <span style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600 }}>Grammar</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                  {counts.grammar}
                </div>
              </div>

              {/* Spacing Card */}
              <div
                className="card"
                style={{
                  padding: 'var(--sp-3)',
                  cursor: 'pointer',
                  border: filter === 'SPACING' ? '1.5px solid #F59E0B' : '1px solid var(--c-border)',
                  background: filter === 'SPACING' ? '#FFFBEB' : 'var(--c-surface)',
                  transition: 'border-color 150ms ease, background 150ms ease',
                }}
                onClick={() => setFilter('SPACING')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
                  <span style={{ fontSize: 11, color: '#D97706', fontWeight: 600 }}>Spacing</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                  {counts.spacing}
                </div>
              </div>

              {/* Punctuation Card */}
              <div
                className="card"
                style={{
                  padding: 'var(--sp-3)',
                  cursor: 'pointer',
                  border: filter === 'PUNCTUATION' ? '1.5px solid #EA580C' : '1px solid var(--c-border)',
                  background: filter === 'PUNCTUATION' ? '#FFF7ED' : 'var(--c-surface)',
                  transition: 'border-color 150ms ease, background 150ms ease',
                }}
                onClick={() => setFilter('PUNCTUATION')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EA580C' }} />
                  <span style={{ fontSize: 11, color: '#C2410C', fontWeight: 600 }}>Punctuation</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                  {counts.punctuation}
                </div>
              </div>

              {/* Typography Card */}
              <div
                className="card"
                style={{
                  padding: 'var(--sp-3)',
                  cursor: 'pointer',
                  border: filter === 'TYPOGRAPHY' ? '1.5px solid #2563EB' : '1px solid var(--c-border)',
                  background: filter === 'TYPOGRAPHY' ? '#EFF6FF' : 'var(--c-surface)',
                  transition: 'border-color 150ms ease, background 150ms ease',
                }}
                onClick={() => setFilter('TYPOGRAPHY')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB' }} />
                  <span style={{ fontSize: 11, color: '#1D4ED8', fontWeight: 600 }}>Typography</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                  {counts.typography}
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="tabs">
              {(
                [
                  { id: 'ALL', label: `All (${counts.total})` },
                  { id: 'SPELLING', label: `Spelling (${counts.spelling})` },
                  { id: 'GRAMMAR', label: `Grammar (${counts.grammar})` },
                  { id: 'SPACING', label: `Spacing (${counts.spacing})` },
                  { id: 'PUNCTUATION', label: `Punctuation (${counts.punctuation})` },
                  { id: 'TYPOGRAPHY', label: `Typography (${counts.typography})` },
                ] as { id: IssueFilter; label: string }[]
              ).map(tab => (
                <button
                  key={tab.id}
                  className={`tab-btn${filter === tab.id ? ' active' : ''}`}
                  onClick={() => setFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Issue List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {filteredIssues.length === 0 ? (
                <div className="card" style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--c-text-tertiary)' }}>
                  No issues in this category.
                </div>
              ) : (
                filteredIssues.map(issue => {
                  const badge = typeBadgeStyles[issue.type] ?? typeBadgeStyles.SPACING
                  const isFocused = focusedIssueId === issue.id

                  return (
                    <div
                      key={issue.id}
                      className="card"
                      style={{
                        padding: 'var(--sp-4)',
                        border: isFocused ? '1.5px solid var(--c-accent)' : '1px solid var(--c-border)',
                        boxShadow: isFocused ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
                        cursor: 'pointer',
                        transition: 'border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
                      }}
                      onClick={() => handleFocusIssue(issue)}
                    >
                      {/* Issue Card Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 'var(--sp-2)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                          {/* Type Badge */}
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 'var(--fs-2xs)',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              padding: '2px 8px',
                              borderRadius: 'var(--r-full)',
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: badge.dot }} />
                            {badge.label}
                          </span>

                          {/* Layer Name */}
                          <span
                            style={{
                              fontSize: 'var(--fs-xs)',
                              color: 'var(--c-text-tertiary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            in <strong style={{ color: 'var(--c-text-secondary)', fontWeight: 600 }}>{issue.nodeName}</strong>
                          </span>
                        </div>

                        {/* Focus Button Indicator */}
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '0 6px', height: 24, fontSize: 11 }}
                          onClick={e => {
                            e.stopPropagation()
                            handleFocusIssue(issue)
                          }}
                          title="Focus and select this exact word in Figma"
                        >
                          <FocusIcon /> Focus Word
                        </button>
                      </div>

                      {/* Issue Explanation */}
                      <div
                        style={{
                          fontSize: 'var(--fs-sm)',
                          color: 'var(--c-text-secondary)',
                          marginBottom: 'var(--sp-2)',
                          lineHeight: 'var(--lh-normal)',
                        }}
                      >
                        {issue.message}
                      </div>

                      {/* In-context paragraph preview highlighting the specific word */}
                      {(issue.contextBefore !== undefined || issue.contextAfter !== undefined) && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--c-text-secondary)',
                            padding: 'var(--sp-2) var(--sp-3)',
                            background: 'var(--c-surface-subtle)',
                            borderRadius: 'var(--r-md)',
                            border: '1px solid var(--c-border-subtle)',
                            marginBottom: 'var(--sp-3)',
                            lineHeight: 1.5,
                            fontFamily: 'var(--font)',
                            wordBreak: 'break-word',
                          }}
                        >
                          <span style={{ color: 'var(--c-text-tertiary)' }}>{issue.contextBefore ?? ''}</span>
                          <span
                            style={{
                              background: badge.bg,
                              color: badge.text,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 'var(--r-sm)',
                              border: `1px solid ${badge.border}`,
                              margin: '0 2px',
                              display: 'inline-block',
                            }}
                          >
                            {issue.original}
                          </span>
                          <span style={{ color: 'var(--c-text-tertiary)' }}>{issue.contextAfter ?? ''}</span>
                        </div>
                      )}

                      {/* Original vs Suggestion Box */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 'var(--sp-2)',
                          padding: 'var(--sp-2) var(--sp-3)',
                          background: 'var(--c-bg)',
                          borderRadius: 'var(--r-md)',
                          border: '1px solid var(--c-border-subtle)',
                          marginBottom: 'var(--sp-3)',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--c-text-tertiary)' }}>
                            Original
                          </div>
                          <div
                            style={{
                              fontSize: 'var(--fs-sm)',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--c-error-text)',
                              marginTop: 2,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                            }}
                          >
                            "{issue.original}"
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--c-text-tertiary)' }}>
                            Possible Correction
                          </div>
                          <div
                            style={{
                              fontSize: 'var(--fs-sm)',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--c-success-text)',
                              fontWeight: 600,
                              marginTop: 2,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                            }}
                          >
                            "{issue.replacement}"
                          </div>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 'var(--sp-2)',
                        }}
                      >
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={e => handleIgnore(e, issue.id)}
                          id={`text-qa-ignore-${issue.id}`}
                        >
                          Ignore
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={e => handleCorrect(e, issue)}
                          id={`text-qa-correct-${issue.id}`}
                        >
                          <CheckIcon /> Correct
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default TextQA
