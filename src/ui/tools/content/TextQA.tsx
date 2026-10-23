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

const SparklesIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.912 5.886a2 2 0 001.202 1.202L21 12l-5.886 1.912a2 2 0 00-1.202 1.202L12 21l-1.912-5.886a2 2 0 00-1.202-1.202L3 12l5.886-1.912a2 2 0 001.202-1.202L12 3z" />
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
  const [aiMode, setAiMode] = useState(false)
  const [aiProgress, setAiProgress] = useState<string | null>(null)

  // Issue manager instance
  const issueManager = useMemo(() => new IssueManager([]), [])

  // Checkers configuration
  const checkers = useMemo(
    () => [SpacingChecker, SpellingChecker, GrammarChecker, TypographyChecker],
    []
  )

  // Standard Fast Scan
  const handleScan = useCallback(() => {
    if (!selection || selection.count === 0) return
    setAiMode(false)
    setAiProgress(null)
    setScanning(true)
    setHasScanned(false)
    sendToPlugin({ type: 'COLLECT_TEXT_NODES' })
  }, [selection])

  // Local ONNX Deep AI Scan
  const handleDeepAiScan = useCallback(() => {
    if (!selection || selection.count === 0) return
    setAiMode(true)
    setAiProgress('Initializing Local ONNX Engine…')
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
            const detectedIssues = await runAllCheckers(nodes, checkers, aiMode, (status) => setAiProgress(status))
            issueManager.setIssues(detectedIssues)
            setIssueStateTrigger(v => v + 1)

            if (aiMode) {
              onSuccess(`✨ AI Check complete: analyzed ${nodes.length} text layer${nodes.length !== 1 ? 's' : ''} with local ONNX engine`)
            }

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
            setAiProgress(null)
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

      {/* Pinned Toolbar & Actions */}
      <div style={{ padding: '8px var(--sp-5)', background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>
              Target:
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: hasSelection ? 'var(--c-text-primary)' : 'var(--c-text-disabled)' }}>
              {hasSelection ? (scannedRootName || activeSelectionName) : 'No selection'}
            </span>
            {hasSelection && textNodeCount !== null && (
              <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)', background: 'var(--c-bg)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--c-border)' }}>
                {textNodeCount} text layers
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleScan}
              disabled={!hasSelection || scanning}
              id="text-qa-scan-btn"
              style={{ height: 28, fontSize: 12 }}
            >
              <ScanIcon />
              {scanning && !aiMode ? 'Scanning…' : hasScanned ? 'Re-scan' : 'Scan Selection'}
            </button>

            <button
              className="btn btn-sm"
              onClick={handleDeepAiScan}
              disabled={!hasSelection || scanning}
              id="text-qa-ai-scan-btn"
              style={{
                height: 28,
                fontSize: 12,
                fontWeight: 600,
                background: aiMode ? 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)' : 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(124,58,237,0.14))',
                color: aiMode ? '#fff' : '#7C3AED',
                border: aiMode ? 'none' : '1px solid rgba(124,58,237,0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
              title="Run local ONNX neural model to catch deeper contextual grammar & phrasing errors"
            >
              <SparklesIcon />
              {scanning && aiMode ? (aiProgress || 'AI Checking…') : 'Deep AI Check'}
            </button>

            {hasScanned && (
              <button
                className={`btn btn-sm ${reviewMode ? 'btn-primary' : 'btn-secondary'}`}
                onClick={toggleReviewMode}
                title="Toggle visual highlights over layers with issues"
                id="text-qa-review-mode-btn"
                style={{ height: 28, fontSize: 11 }}
              >
                <EyeIcon />
                Review {reviewMode ? 'ON' : 'OFF'}
              </button>
            )}

            {counts.safeCount > 0 && (
              <button
                className="btn btn-sm btn-primary"
                style={{ background: '#059669', borderColor: '#059669', height: 28, fontSize: 12, fontWeight: 600 }}
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

        {/* Filter Pills Bar (when issues exist) */}
        {hasSelection && !scanning && hasScanned && counts.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
            {(
              [
                { id: 'ALL', label: 'All', count: counts.total, color: 'var(--c-accent)' },
                { id: 'SPELLING', label: 'Spelling', count: counts.spelling, color: '#EF4444' },
                { id: 'GRAMMAR', label: 'Grammar', count: counts.grammar, color: '#8B5CF6' },
                { id: 'SPACING', label: 'Spacing', count: counts.spacing, color: '#F59E0B' },
                { id: 'PUNCTUATION', label: 'Punctuation', count: counts.punctuation, color: '#EA580C' },
                { id: 'TYPOGRAPHY', label: 'Typography', count: counts.typography, color: '#2563EB' },
              ] as { id: IssueFilter; label: string; count: number; color: string }[]
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 9px',
                  borderRadius: 'var(--r-full)',
                  border: `1px solid ${filter === tab.id ? tab.color : 'var(--c-border)'}`,
                  background: filter === tab.id ? 'var(--c-accent-subtle)' : 'var(--c-bg)',
                  color: filter === tab.id ? 'var(--c-text-primary)' : 'var(--c-text-secondary)',
                  fontSize: 11,
                  fontWeight: filter === tab.id ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: tab.color }} />
                <span>{tab.label}</span>
                <span style={{ fontSize: 10, opacity: 0.75, fontFamily: 'var(--font-mono)' }}>({tab.count})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable Issue List Container */}
      <div style={{ flex: 1, minHeight: 0, padding: 'var(--sp-3) var(--sp-5)', overflowY: 'auto' }}>
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
              {aiMode ? (aiProgress || 'Analyzing text with Local ONNX…') : 'Scanning text layers…'}
            </div>
            <div className="empty-state-body">
              {aiMode
                ? 'Evaluating linguistic syntax, prepositions, and contextual phrasing using on-device neural model.'
                : 'Traversing selected hierarchy and checking spelling, grammar, and spacing.'}
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

                          {issue.message.startsWith('✨ AI') && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 'var(--r-full)',
                                background: 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(124,58,237,0.15))',
                                color: '#7C3AED',
                                border: '1px solid rgba(124,58,237,0.25)',
                              }}
                            >
                              ✨ ONNX AI
                            </span>
                          )}

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
