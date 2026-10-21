import React, { useState, useEffect, useCallback } from 'react'
import type { SelectionInfo, TextSizeItem, PluginMessage } from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'
import { sendToPlugin } from '../../utils/messaging'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const TextSizeChecker: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [minSize, setMinSize] = useState(12)
  const [scope, setScope] = useState<'selection' | 'page'>('selection')
  const [items, setItems] = useState<TextSizeItem[]>([])
  const [filter, setFilter] = useState<'all' | 'warning' | 'pass'>('all')
  const [loading, setLoading] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)

  const requestAnalysis = useCallback((minimum: number, currentScope: 'selection' | 'page') => {
    setLoading(true)
    sendToPlugin({
      type: 'GET_TEXT_SIZE_ANALYSIS',
      payload: { minSize: minimum, scope: currentScope },
    })
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined
      if (msg?.type === 'TEXT_SIZE_ANALYSIS') {
        setItems(msg.payload.items)
        setLoading(false)
        setAnalyzed(true)
      }
    }

    window.addEventListener('message', handleMessage)
    requestAnalysis(minSize, scope)

    return () => window.removeEventListener('message', handleMessage)
  }, [minSize, scope, requestAnalysis])

  const handleFocus = (nodeId: string) => {
    sendToPlugin({ type: 'FOCUS_NODE', payload: { nodeId } })
  }

  const passCount = items.filter(i => i.status === 'PASS').length
  const warningCount = items.filter(i => i.status === 'WARNING').length

  const filteredItems = items.filter(i => {
    if (filter === 'warning') return i.status === 'WARNING'
    if (filter === 'pass') return i.status === 'PASS'
    return true
  })

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Accessibility</div>
        <h1 className="tool-title">Text Size Checker</h1>
        <p className="tool-description">
          Audit font sizes across text layers to prevent unreadable, inaccessible micro-typography.
        </p>
      </div>

      <div className="tool-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', overflow: 'hidden' }}>
        <SelectionBanner
          selection={selection}
          selectionHint="Select text layers or frames to audit, or switch to Current Page."
        />

        {/* Controls */}
        <div
          className="card"
          style={{
            padding: 'var(--sp-2) var(--sp-3)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
              <button
                className={`btn btn-sm ${scope === 'selection' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setScope('selection')
                  requestAnalysis(minSize, 'selection')
                }}
                style={{ height: 26, fontSize: 11, padding: '0 var(--sp-2)' }}
              >
                Selected Layers
              </button>
              <button
                className={`btn btn-sm ${scope === 'page' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setScope('page')
                  requestAnalysis(minSize, 'page')
                }}
                style={{ height: 26, fontSize: 11, padding: '0 var(--sp-2)' }}
              >
                Current Page
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-tertiary)' }}>
                Min Size:
              </span>
              <div style={{ display: 'inline-flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
                {[10, 12, 14, 16].map(sz => (
                  <button
                    key={sz}
                    className={`btn btn-sm ${minSize === sz ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setMinSize(sz)}
                    style={{ height: 26, fontSize: 11, padding: '0 var(--sp-2)' }}
                  >
                    {sz}px
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stat summaries */}
        {items.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-2)', flexShrink: 0 }}>
            <div
              className="card"
              style={{
                padding: 'var(--sp-2) var(--sp-3)',
                cursor: 'pointer',
                border: filter === 'all' ? '1.5px solid var(--c-primary)' : '1px solid var(--c-border)',
                background: filter === 'all' ? 'rgba(37, 99, 235, 0.04)' : 'var(--c-surface)',
              }}
              onClick={() => setFilter('all')}
            >
              <div style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>Total Text Layers</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-primary)' }}>
                {items.length}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: 'var(--sp-2) var(--sp-3)',
                cursor: 'pointer',
                border: filter === 'warning' ? '1.5px solid var(--c-warning)' : '1px solid var(--c-border)',
                background: filter === 'warning' ? 'rgba(245, 158, 11, 0.05)' : 'var(--c-surface)',
              }}
              onClick={() => setFilter('warning')}
            >
              <div style={{ fontSize: 10, color: 'var(--c-warning)' }}>Under {minSize}px</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-warning)' }}>
                {warningCount}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: 'var(--sp-2) var(--sp-3)',
                cursor: 'pointer',
                border: filter === 'pass' ? '1.5px solid var(--c-success)' : '1px solid var(--c-border)',
                background: filter === 'pass' ? 'rgba(16, 185, 129, 0.05)' : 'var(--c-surface)',
              }}
              onClick={() => setFilter('pass')}
            >
              <div style={{ fontSize: 10, color: 'var(--c-success)' }}>Passing ({minSize}px+)</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-success)' }}>
                {passCount}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>Auditing text sizes…</div>
          </div>
        ) : items.length === 0 && analyzed ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <div className="empty-state-title">No text layers found</div>
            <div className="empty-state-body">
              {scope === 'selection'
                ? 'No text layers found in current selection. Try selecting a frame or switch to Current Page.'
                : 'No text layers found on the current page.'}
            </div>
          </div>
        ) : items.length > 0 ? (
          <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div
              className="card-header"
              style={{
                padding: 'var(--sp-2) var(--sp-3)',
                borderBottom: '1px solid var(--c-border-subtle)',
                flexShrink: 0,
              }}
            >
              <div className="card-title" style={{ fontSize: 12 }}>
                {filter === 'warning'
                  ? `${warningCount} Text Layers Below ${minSize}px`
                  : filter === 'pass'
                  ? `${passCount} Passing Text Layers`
                  : `All ${items.length} Text Layers`}
              </div>
            </div>

            <div className="tool-scroll-list" style={{ flex: 1, padding: 0 }}>
              {filteredItems.map((item, idx) => {
                const isWarning = item.status === 'WARNING'
                return (
                  <div
                    key={item.nodeId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--sp-2) var(--sp-3)',
                      borderBottom: '1px solid var(--c-border-subtle)',
                      cursor: 'pointer',
                      transition: 'background 120ms ease',
                    }}
                    onClick={() => handleFocus(item.nodeId)}
                    title="Click to focus text in Figma"
                  >
                    <div style={{ minWidth: 0, flex: 1, paddingRight: 'var(--sp-3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-primary)' }}>
                          {item.nodeName} <span style={{ fontSize: 10, color: 'var(--c-primary)' }}>↗</span>
                        </span>
                        <span className="tag" style={{ fontSize: 9, padding: '1px 5px' }}>
                          {item.fontWeight}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--c-text-secondary)',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        "{item.textSnippet}"
                      </div>
                      {isWarning && (
                        <div style={{ fontSize: 10, color: 'var(--c-warning)', marginTop: 1, fontWeight: 500 }}>
                          Below {minSize}px ({item.fontSize}px)
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexShrink: 0 }}>
                      <span
                        className={isWarning ? 'tag tag-warning' : 'tag tag-success'}
                        style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px' }}
                      >
                        {item.fontSize}px
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default TextSizeChecker

