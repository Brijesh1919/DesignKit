import React, { useState, useEffect } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo, GridCheckerAnalysis, GridCheckerItem } from '../../../shared/types'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const GridChecker: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [gridBase, setGridBase] = useState<number>(8)
  const [scope, setScope] = useState<'selection' | 'page'>('selection')
  const [isLoading, setIsLoading] = useState(false)
  const [analysis, setAnalysis] = useState<GridCheckerAnalysis | null>(null)

  const handleScan = () => {
    setIsLoading(true)
    sendToPlugin({
      type: 'GET_GRID_CHECKER_ANALYSIS',
      payload: { grid: gridBase, scope },
    })
  }

  useEffect(() => {
    handleScan()

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage
      if (!msg) return

      if (msg.type === 'GRID_CHECKER_ANALYSIS') {
        setIsLoading(false)
        setAnalysis(msg.payload)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [gridBase, scope])

  const handleFocus = (nodeId: string) => {
    sendToPlugin({
      type: 'FOCUS_NODE',
      payload: { nodeId },
    })
  }

  const handleFixAll = () => {
    if (!analysis || analysis.items.length === 0) return

    const fixes = analysis.items.map(item => {
      const props: Record<string, number> = {}
      for (const off of item.offProperties) {
        props[off.property] = off.rounded
      }
      return {
        nodeId: item.nodeId,
        properties: props,
      }
    })

    sendToPlugin({
      type: 'APPLY_GRID_FIXES',
      payload: { fixes },
    })

    // Re-scan after short delay
    setTimeout(handleScan, 300)
  }

  const handleFixSingle = (item: GridCheckerItem) => {
    const props: Record<string, number> = {}
    for (const off of item.offProperties) {
      props[off.property] = off.rounded
    }
    sendToPlugin({
      type: 'APPLY_GRID_FIXES',
      payload: {
        fixes: [{ nodeId: item.nodeId, properties: props }],
      },
    })
    setTimeout(handleScan, 300)
  }

  const offCount = analysis ? analysis.items.length : 0

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Layout / Grid Checker</div>
        <h1 className="tool-title">8pt Grid Checker</h1>
        <p className="tool-desc">
          Identify elements with positions, dimensions, gaps, or paddings that break your design grid, and snap them automatically.
        </p>
      </div>

      <div className="tool-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', height: '100%', overflow: 'hidden' }}>
        {/* Pinned Controls Bar */}
        <div className="card" style={{ padding: 'var(--sp-3) var(--sp-4)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
              {/* Grid Base */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)', color: 'var(--c-text-secondary)' }}>
                  Grid:
                </span>
                <div style={{ display: 'inline-flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
                  {[4, 8, 16].map(g => (
                    <button
                      key={g}
                      className={`btn btn-sm ${gridBase === g ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setGridBase(g)}
                      style={{ height: 26, padding: '0 var(--sp-2)', fontSize: 11 }}
                    >
                      {g}pt
                    </button>
                  ))}
                </div>
              </div>

              {/* Scope */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)', color: 'var(--c-text-secondary)' }}>
                  Scope:
                </span>
                <div style={{ display: 'inline-flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
                  <button
                    className={`btn btn-sm ${scope === 'selection' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setScope('selection')}
                    style={{ height: 26, padding: '0 var(--sp-2)', fontSize: 11 }}
                  >
                    Selection
                  </button>
                  <button
                    className={`btn btn-sm ${scope === 'page' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setScope('page')}
                    style={{ height: 26, padding: '0 var(--sp-2)', fontSize: 11 }}
                  >
                    Page
                  </button>
                </div>
              </div>
            </div>

            {/* Actions: Re-scan & Pinned Snap All */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleScan} disabled={isLoading} style={{ height: 28, fontSize: 12 }}>
                {isLoading ? 'Scanning...' : 'Re-scan'}
              </button>
              {offCount > 0 && (
                <button className="btn btn-primary btn-sm" onClick={handleFixAll} style={{ height: 28, fontSize: 12 }}>
                  Snap All to {gridBase}pt ({offCount})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results Header / Status Bar */}
        {analysis && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--sp-1)', flexShrink: 0 }}>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-semibold)', color: offCount > 0 ? 'var(--c-text-primary)' : 'var(--c-primary)' }}>
              {offCount === 0
                ? `🎉 Perfect: All ${analysis.totalScanned} scanned layers align with ${gridBase}pt grid`
                : `${offCount} layer${offCount !== 1 ? 's' : ''} with off-grid values (${analysis.totalScanned} scanned)`}
            </span>
            {offCount > 0 && (
              <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>
                Click layer to inspect in canvas
              </span>
            )}
          </div>
        )}

        {/* Scrollable Issues List */}
        <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="tool-scroll-list" style={{ flex: 1, padding: 0 }}>
            {isLoading ? (
              <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--c-text-tertiary)', fontSize: 'var(--fs-sm)' }}>
                Scanning canvas layers...
              </div>
            ) : analysis && offCount === 0 ? (
              <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--c-text-secondary)', fontSize: 'var(--fs-sm)' }}>
                No misalignment detected. Your layout strictly follows the {gridBase}pt spacing and sizing rhythm.
              </div>
            ) : analysis && offCount > 0 ? (
              <div>
                {analysis.items.map(item => (
                  <div
                    key={item.nodeId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--sp-2) var(--sp-4)',
                      borderBottom: '1px solid var(--c-border-subtle)',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0, marginRight: 'var(--sp-3)' }}>
                      <span
                        style={{
                          fontWeight: 'var(--fw-semibold)',
                          fontSize: 'var(--fs-xs)',
                          color: 'var(--c-text-primary)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        onClick={() => handleFocus(item.nodeId)}
                        title="Click to focus in canvas"
                      >
                        {item.nodeName} <span style={{ fontSize: 10, color: 'var(--c-primary)' }}>↗</span>
                      </span>
                      <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
                        {item.offProperties.map(p => (
                          <span
                            key={p.property}
                            style={{
                              fontSize: 10,
                              fontFamily: 'var(--font-mono)',
                              background: 'rgba(239, 68, 68, 0.08)',
                              color: '#DC2626',
                              padding: '1px 5px',
                              borderRadius: 'var(--r-sm)',
                              border: '1px solid rgba(239, 68, 68, 0.15)',
                            }}
                          >
                            {p.property}: {p.value}px → <strong>{p.rounded}px</strong>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--sp-1)', flexShrink: 0 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleFocus(item.nodeId)}
                        title="Focus in Figma"
                        style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                      >
                        Focus
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleFixSingle(item)}
                        title="Snap this element's values"
                        style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                      >
                        Snap
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GridChecker
