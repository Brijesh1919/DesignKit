import React, { useState, useEffect, useCallback } from 'react'
import type { SelectionInfo, StyleCleanupAnalysis, PluginMessage } from '../../../shared/types'
import { sendToPlugin } from '../../utils/messaging'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const StyleCleanup: React.FC<Props> = ({ onSuccess, onError }) => {
  const [scope, setScope] = useState<'page' | 'document'>('page')
  const [analysis, setAnalysis] = useState<StyleCleanupAnalysis | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)

  const requestAnalysis = useCallback(() => {
    setLoading(true)
    sendToPlugin({
      type: 'GET_STYLE_CLEANUP_ANALYSIS',
      payload: { scope },
    })
  }, [scope])

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

  const handleDeleteDuplicates = () => {
    if (!analysis || analysis.duplicateStyles.length === 0) return
    const ids = analysis.duplicateStyles.map(d => d.styleId)
    sendToPlugin({
      type: 'APPLY_DELETE_STYLES',
      payload: { styleIds: ids },
    })
    onSuccess(`Deleted ${ids.length} duplicate style${ids.length !== 1 ? 's' : ''}!`)
    setTimeout(requestAnalysis, 400)
  }

  const [activeTab, setActiveTab] = useState<'unused' | 'duplicates'>('unused')
  const totalUnused = analysis?.unusedStyles.length ?? 0
  const totalDuplicates = analysis?.duplicateStyles.length ?? 0

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Cleanup / Style Cleanup</div>
        <h1 className="tool-title">Style Cleanup & Audit</h1>
        <p className="tool-desc">
          Scan your document for unused and duplicate local paint, text, effect, and grid styles with safe deletion controls.
        </p>
      </div>

      <div className="tool-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', overflow: 'hidden' }}>
        {/* Controls Bar */}
        <div className="card" style={{ padding: 'var(--sp-2) var(--sp-3)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)', color: 'var(--c-text-secondary)' }}>
                Scope:
              </span>
              <div style={{ display: 'inline-flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
                <button
                  className={`btn btn-sm ${scope === 'page' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setScope('page')}
                  style={{ height: 26, fontSize: 11, padding: '0 var(--sp-2)' }}
                >
                  Active Page
                </button>
                <button
                  className={`btn btn-sm ${scope === 'document' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setScope('document')}
                  style={{ height: 26, fontSize: 11, padding: '0 var(--sp-2)' }}
                >
                  Entire Document
                </button>
              </div>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={requestAnalysis}
              disabled={loading}
              style={{ height: 26, fontSize: 11 }}
            >
              {loading ? 'Analyzing styles…' : 'Re-scan Styles'}
            </button>
          </div>
        </div>

        {/* Breakdown Stats */}
        {analysis && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-2)', flexShrink: 0 }}>
            <div className="card" style={{ padding: 'var(--sp-1) var(--sp-2)', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>Paint</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)' }}>{analysis.counts.unusedPaint}</div>
            </div>
            <div className="card" style={{ padding: 'var(--sp-1) var(--sp-2)', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>Text</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)' }}>{analysis.counts.unusedText}</div>
            </div>
            <div className="card" style={{ padding: 'var(--sp-1) var(--sp-2)', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>Effects</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)' }}>{analysis.counts.unusedEffect}</div>
            </div>
            <div className="card" style={{ padding: 'var(--sp-1) var(--sp-2)', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>Duplicates</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: analysis.counts.duplicates > 0 ? 'var(--c-error)' : 'var(--c-text-primary)' }}>{analysis.counts.duplicates}</div>
            </div>
          </div>
        )}

        {/* Results State */}
        {loading ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>Scanning document for unused styles…</div>
          </div>
        ) : analysis && totalUnused === 0 && totalDuplicates === 0 && analyzed ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <div className="empty-state-title">✨ All local styles are in active use!</div>
            <div className="empty-state-body">
              No unused or duplicate styles found across {scope === 'page' ? 'the current page' : 'all document pages'}.
            </div>
          </div>
        ) : analysis ? (
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Tab header */}
            <div
              className="card-header"
              style={{
                padding: 'var(--sp-2) var(--sp-3)',
                borderBottom: '1px solid var(--c-border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className={`btn btn-sm ${activeTab === 'unused' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveTab('unused')}
                  style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                >
                  Unused Styles ({totalUnused})
                </button>
                {totalDuplicates > 0 && (
                  <button
                    className={`btn btn-sm ${activeTab === 'duplicates' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('duplicates')}
                    style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                  >
                    Duplicates ({totalDuplicates})
                  </button>
                )}
              </div>

              {activeTab === 'unused' && totalUnused > 0 && (
                <div style={{ display: 'flex', gap: 4 }}>
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
                </div>
              )}
            </div>

            {/* List Body */}
            <div className="tool-scroll-list" style={{ flex: 1, padding: 0 }}>
              {activeTab === 'unused' ? (
                <div>
                  {analysis.unusedStyles.map(style => (
                    <div
                      key={style.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--sp-2) var(--sp-3)',
                        borderBottom: '1px solid var(--c-border-subtle)',
                        background: selectedIds.has(style.id) ? 'rgba(37, 99, 235, 0.04)' : 'transparent',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', cursor: 'pointer', flex: 1, minWidth: 0, marginRight: 'var(--sp-2)' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(style.id)}
                          onChange={() => toggleStyle(style.id)}
                          style={{ cursor: 'pointer', accentColor: 'var(--c-primary)' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--c-text-primary)' }}>
                            {style.name}
                          </span>
                          {style.details && (
                            <span style={{ fontSize: 10, color: 'var(--c-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                              {style.details}
                            </span>
                          )}
                        </div>
                      </label>

                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 'var(--r-sm)',
                          background: 'var(--c-bg)',
                          color: 'var(--c-text-secondary)',
                          border: '1px solid var(--c-border)',
                          flexShrink: 0,
                        }}
                      >
                        {style.type}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  {analysis.duplicateStyles.map(d => (
                    <div
                      key={d.styleId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--sp-2) var(--sp-3)',
                        borderBottom: '1px solid var(--c-border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1, marginRight: 'var(--sp-2)' }}>
                        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--c-text-primary)' }}>
                          "{d.styleName}"
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>
                          Identical to "{d.duplicateOfName}"
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 'var(--r-sm)',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#DC2626',
                          flexShrink: 0,
                        }}
                      >
                        DUPLICATE {d.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pinned Action Footer */}
            <div
              className="tool-footer"
              style={{
                padding: 'var(--sp-2) var(--sp-4)',
                flexShrink: 0,
              }}
            >
              {activeTab === 'unused' ? (
                <>
                  <span style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>
                    {selectedIds.size} style{selectedIds.size !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleDelete}
                    disabled={selectedIds.size === 0}
                    style={{ height: 30 }}
                  >
                    Delete Selected ({selectedIds.size})
                  </button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>
                    {totalDuplicates} duplicate style{totalDuplicates !== 1 ? 's' : ''} detected
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleDeleteDuplicates}
                    disabled={totalDuplicates === 0}
                    style={{ height: 30 }}
                  >
                    Delete All Duplicates ({totalDuplicates})
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default StyleCleanup
