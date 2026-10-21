import React, { useState, useEffect, useCallback } from 'react'
import type { SelectionInfo, LayerCleanupCandidate, PluginMessage } from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'
import { sendToPlugin } from '../../utils/messaging'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const LayerCleanup: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [scope, setScope] = useState<'selection' | 'page'>('selection')
  const [candidates, setCandidates] = useState<LayerCleanupCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)

  const requestAnalysis = useCallback((currentScope: 'selection' | 'page') => {
    setLoading(true)
    sendToPlugin({
      type: 'GET_LAYER_CLEANUP_CANDIDATES',
      payload: { scope: currentScope },
    })
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined
      if (msg?.type === 'LAYER_CLEANUP_ANALYSIS') {
        setCandidates(msg.payload.candidates)
        setLoading(false)
        setAnalyzed(true)
      }
    }

    window.addEventListener('message', handleMessage)
    requestAnalysis(scope)

    return () => window.removeEventListener('message', handleMessage)
  }, [scope, requestAnalysis])

  const toggleCandidate = (nodeId: string) => {
    setCandidates(prev =>
      prev.map(c => (c.nodeId === nodeId ? { ...c, checked: !c.checked } : c))
    )
  }

  const toggleAll = (checked: boolean) => {
    setCandidates(prev => prev.map(c => ({ ...c, checked })))
  }

  const handleApply = () => {
    const selected = candidates.filter(c => c.checked)
    if (selected.length === 0) {
      onError('Select at least one layer to clean.')
      return
    }

    sendToPlugin({
      type: 'APPLY_LAYER_CLEANUP',
      payload: { candidateIds: selected.map(c => c.nodeId) },
    })
    onSuccess(`Cleaned ${selected.length} layer${selected.length !== 1 ? 's' : ''}!`)
    setTimeout(() => requestAnalysis(scope), 300)
  }

  const handleFocus = (nodeId: string) => {
    sendToPlugin({ type: 'FOCUS_NODE', payload: { nodeId } })
  }

  const selectedCount = candidates.filter(c => c.checked).length

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Cleanup</div>
        <h1 className="tool-title">Layer Cleanup</h1>
        <p className="tool-description">
          Safely remove empty frames, empty groups, and unwrap single-child redundant wrappers without altering visual appearance.
        </p>
      </div>

      <div className="tool-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', overflow: 'hidden' }}>
        <SelectionBanner
          selection={selection}
          selectionHint="Select layers to clean, or switch to Current Page."
        />

        {/* Controls */}
        <div className="card" style={{ padding: 'var(--sp-2) var(--sp-3)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
            <div style={{ display: 'inline-flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
              <button
                className={`btn btn-sm ${scope === 'selection' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setScope('selection')
                  requestAnalysis('selection')
                }}
                style={{ height: 26, fontSize: 11, padding: '0 var(--sp-2)' }}
              >
                Selected Layers
              </button>
              <button
                className={`btn btn-sm ${scope === 'page' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setScope('page')
                  requestAnalysis('page')
                }}
                style={{ height: 26, fontSize: 11, padding: '0 var(--sp-2)' }}
              >
                Current Page
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              {candidates.length > 0 && (
                <>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => toggleAll(true)}
                    style={{ fontSize: 11, height: 26, padding: '0 6px' }}
                  >
                    Select All
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => toggleAll(false)}
                    style={{ fontSize: 11, height: 26, padding: '0 6px' }}
                  >
                    Deselect All
                  </button>
                </>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => requestAnalysis(scope)}
                disabled={loading}
                style={{ height: 26, fontSize: 11 }}
              >
                {loading ? 'Scanning…' : 'Re-scan'}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>Scanning for cleanup targets…</div>
          </div>
        ) : candidates.length === 0 && analyzed ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <div className="empty-state-title">✨ Layer structure is perfectly clean!</div>
            <div className="empty-state-body">
              No empty frames, empty groups, or redundant wrappers found.
            </div>
          </div>
        ) : candidates.length > 0 ? (
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div
              className="card-header"
              style={{
                padding: 'var(--sp-2) var(--sp-3)',
                borderBottom: '1px solid var(--c-border-subtle)',
                flexShrink: 0,
              }}
            >
              <div className="card-title" style={{ fontSize: 12 }}>
                {candidates.length} Cleanup Candidate{candidates.length !== 1 ? 's' : ''} Found
              </div>
            </div>

            <div className="tool-scroll-list" style={{ flex: 1, padding: 0 }}>
              {candidates.map((candidate) => (
                <div
                  key={candidate.nodeId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--sp-2) var(--sp-3)',
                    borderBottom: '1px solid var(--c-border-subtle)',
                    background: candidate.checked ? 'var(--c-surface)' : 'var(--c-bg)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', minWidth: 0, flex: 1, marginRight: 'var(--sp-2)' }}>
                    <input
                      type="checkbox"
                      checked={candidate.checked}
                      onChange={() => toggleCandidate(candidate.nodeId)}
                      style={{ cursor: 'pointer', accentColor: 'var(--c-primary)' }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
                        <span
                          style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-primary)', cursor: 'pointer' }}
                          onClick={() => handleFocus(candidate.nodeId)}
                          title="Click to view in Figma"
                        >
                          {candidate.nodeName} <span style={{ fontSize: 10, color: 'var(--c-primary)' }}>↗</span>
                        </span>
                        <span className="tag" style={{ fontSize: 9, padding: '1px 5px' }}>
                          {candidate.nodeType}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', marginTop: 1 }}>
                        {candidate.reason}
                      </div>
                    </div>
                  </div>

                  <span
                    className={candidate.action === 'unwrap' ? 'tag tag-accent' : 'tag tag-danger'}
                    style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', flexShrink: 0 }}
                  >
                    {candidate.action === 'unwrap' ? 'Unwrap' : 'Delete'}
                  </span>
                </div>
              ))}
            </div>

            {/* Pinned Action Footer */}
            <div
              className="tool-footer"
              style={{
                padding: 'var(--sp-2) var(--sp-4)',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>
                {selectedCount} candidate{selectedCount !== 1 ? 's' : ''} selected
              </span>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleApply}
                disabled={selectedCount === 0}
                id="apply-layer-cleanup-btn"
                style={{ height: 30 }}
              >
                Clean Selected Layers ({selectedCount})
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default LayerCleanup
