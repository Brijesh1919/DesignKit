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

      <div className="tool-body">
        <SelectionBanner
          selection={selection}
          selectionHint="Select layers to clean, or switch to Current Page."
        />

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <button
              className={`btn btn-sm ${scope === 'selection' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setScope('selection')
                requestAnalysis('selection')
              }}
            >
              Selected Layers
            </button>
            <button
              className={`btn btn-sm ${scope === 'page' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setScope('page')
                requestAnalysis('page')
              }}
            >
              Current Page
            </button>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => requestAnalysis(scope)}
            disabled={loading}
          >
            {loading ? 'Scanning…' : 'Re-scan'}
          </button>
        </div>

        {/* Results */}
        {loading ? (
          <div className="empty-state">
            <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>Scanning for cleanup targets…</div>
          </div>
        ) : candidates.length === 0 && analyzed ? (
          <div className="empty-state">
            <div className="empty-state-title">✨ Layer structure is perfectly clean!</div>
            <div className="empty-state-body">
              No empty frames, empty groups, or redundant wrappers found.
            </div>
          </div>
        ) : candidates.length > 0 ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div
              className="card-header"
              style={{
                paddingBottom: 'var(--sp-3)',
                borderBottom: '1px solid var(--c-border-subtle)',
              }}
            >
              <div className="card-title">
                {candidates.length} Cleanup Candidate{candidates.length !== 1 ? 's' : ''} Found
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => toggleAll(true)}
                  style={{ fontSize: 11 }}
                >
                  Select All
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => toggleAll(false)}
                  style={{ fontSize: 11 }}
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 380, overflowY: 'auto' }}>
              {candidates.map((candidate, idx) => (
                <div
                  key={candidate.nodeId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--sp-3) var(--sp-4)',
                    borderBottom:
                      idx < candidates.length - 1 ? '1px solid var(--c-border-subtle)' : 'none',
                    background: candidate.checked ? 'var(--c-surface)' : 'var(--c-bg)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={candidate.checked}
                      onChange={() => toggleCandidate(candidate.nodeId)}
                      style={{ cursor: 'pointer', accentColor: 'var(--c-accent)' }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                        <span
                          style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-primary)', cursor: 'pointer' }}
                          onClick={() => handleFocus(candidate.nodeId)}
                          title="Click to view in Figma"
                        >
                          {candidate.nodeName}
                        </span>
                        <span className="tag" style={{ fontSize: 10 }}>
                          {candidate.nodeType}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', marginTop: 2 }}>
                        {candidate.reason}
                      </div>
                    </div>
                  </div>

                  <span
                    className={candidate.action === 'unwrap' ? 'tag tag-accent' : 'tag tag-danger'}
                    style={{ fontSize: 10, fontWeight: 600 }}
                  >
                    {candidate.action === 'unwrap' ? 'Unwrap' : 'Delete'}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                padding: 'var(--sp-3) var(--sp-4)',
                background: 'var(--c-surface-subtle)',
                borderTop: '1px solid var(--c-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
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
