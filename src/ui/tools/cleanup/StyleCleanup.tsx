import React, { useState, useEffect, useCallback } from 'react'
import type { SelectionInfo, StyleCleanupAnalysis, PluginMessage } from '../../../shared/types'
import { sendToPlugin } from '../../utils/messaging'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const StyleCleanup: React.FC<Props> = ({ onSuccess, onError }) => {
  const [analysis, setAnalysis] = useState<StyleCleanupAnalysis | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)

  const requestAnalysis = useCallback(() => {
    setLoading(true)
    sendToPlugin({ type: 'GET_STYLE_CLEANUP_ANALYSIS' })
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined
      if (msg?.type === 'STYLE_CLEANUP_ANALYSIS') {
        setAnalysis(msg.payload)
        setSelectedIds(new Set(msg.payload.unusedStyles.map(s => s.id)))
        setLoading(false)
        setAnalyzed(true)
      }
    }

    window.addEventListener('message', handleMessage)
    requestAnalysis()

    return () => window.removeEventListener('message', handleMessage)
  }, [requestAnalysis])

  const toggleStyle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = (select: boolean) => {
    if (!analysis) return
    if (select) {
      setSelectedIds(new Set(analysis.unusedStyles.map(s => s.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleDelete = () => {
    if (selectedIds.size === 0) {
      onError('Select at least one unused style to delete.')
      return
    }

    sendToPlugin({
      type: 'APPLY_DELETE_STYLES',
      payload: { styleIds: Array.from(selectedIds) },
    })
    onSuccess(`Deleted ${selectedIds.size} unused style${selectedIds.size !== 1 ? 's' : ''}!`)
    setTimeout(requestAnalysis, 400)
  }

  const totalUnused = analysis?.unusedStyles.length ?? 0

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Cleanup</div>
        <h1 className="tool-title">Style Cleanup</h1>
        <p className="tool-description">
          Find unused and duplicate local paint, text, effect, and grid styles in your document.
        </p>
      </div>

      <div className="tool-body">
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={requestAnalysis}
            disabled={loading}
          >
            {loading ? 'Analyzing styles…' : 'Re-scan Document'}
          </button>
        </div>

        {/* Breakdown Stats */}
        {analysis && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-3)' }}>
            <div className="card" style={{ padding: 'var(--sp-3)' }}>
              <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Unused Paint</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                {analysis.counts.unusedPaint}
              </div>
            </div>

            <div className="card" style={{ padding: 'var(--sp-3)' }}>
              <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Unused Text</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                {analysis.counts.unusedText}
              </div>
            </div>

            <div className="card" style={{ padding: 'var(--sp-3)' }}>
              <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Unused Effects</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                {analysis.counts.unusedEffect}
              </div>
            </div>

            <div className="card" style={{ padding: 'var(--sp-3)' }}>
              <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Duplicates</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                {analysis.counts.duplicates}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="empty-state">
            <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>Scanning document styles…</div>
          </div>
        ) : analysis && totalUnused === 0 && analysis.duplicateStyles.length === 0 && analyzed ? (
          <div className="empty-state">
            <div className="empty-state-title">✨ All local styles are in use!</div>
            <div className="empty-state-body">
              No unused or duplicate styles found across your document pages.
            </div>
          </div>
        ) : (
          <>
            {/* Unused styles card */}
            {analysis && totalUnused > 0 && (
              <div className="card" style={{ overflow: 'hidden' }}>
                <div
                  className="card-header"
                  style={{
                    paddingBottom: 'var(--sp-3)',
                    borderBottom: '1px solid var(--c-border-subtle)',
                  }}
                >
                  <div className="card-title">
                    {totalUnused} Unused Style{totalUnused !== 1 ? 's' : ''} Found
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

                <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 300, overflowY: 'auto' }}>
                  {analysis.unusedStyles.map((style, idx) => {
                    const isChecked = selectedIds.has(style.id)
                    return (
                      <div
                        key={style.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--sp-2) var(--sp-4)',
                          borderBottom:
                            idx < analysis.unusedStyles.length - 1
                              ? '1px solid var(--c-border-subtle)'
                              : 'none',
                          background: isChecked ? 'var(--c-surface)' : 'var(--c-bg)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleStyle(style.id)}
                            style={{ cursor: 'pointer', accentColor: 'var(--c-accent)' }}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-primary)' }}>
                              {style.name}
                            </div>
                            {style.details && (
                              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--c-text-tertiary)' }}>
                                {style.details}
                              </div>
                            )}
                          </div>
                        </div>

                        <span className="tag" style={{ fontSize: 10 }}>
                          {style.type}
                        </span>
                      </div>
                    )
                  })}
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
                    {selectedIds.size} style{selectedIds.size !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleDelete}
                    disabled={selectedIds.size === 0}
                    id="delete-unused-styles-btn"
                  >
                    Delete Selected Styles ({selectedIds.size})
                  </button>
                </div>
              </div>
            )}

            {/* Duplicate styles warning */}
            {analysis && analysis.duplicateStyles.length > 0 && (
              <div className="card" style={{ overflow: 'hidden' }}>
                <div
                  className="card-header"
                  style={{
                    paddingBottom: 'var(--sp-3)',
                    borderBottom: '1px solid var(--c-border-subtle)',
                  }}
                >
                  <div className="card-title">
                    {analysis.duplicateStyles.length} Potential Duplicate Style{analysis.duplicateStyles.length !== 1 ? 's' : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {analysis.duplicateStyles.map((dup, idx) => (
                    <div
                      key={`${dup.styleId}-${idx}`}
                      style={{
                        padding: 'var(--sp-3) var(--sp-4)',
                        borderBottom:
                          idx < analysis.duplicateStyles.length - 1
                            ? '1px solid var(--c-border-subtle)'
                            : 'none',
                        fontSize: 12,
                        color: 'var(--c-text-secondary)',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--c-text-primary)' }}>
                        "{dup.styleName}"
                      </span>{' '}
                      has identical color/properties to{' '}
                      <span style={{ fontWeight: 600, color: 'var(--c-accent)' }}>
                        "{dup.duplicateOfName}"
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default StyleCleanup
