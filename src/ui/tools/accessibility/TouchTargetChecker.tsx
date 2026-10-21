import React, { useState, useEffect, useCallback } from 'react'
import type { SelectionInfo, TouchTargetItem, PluginMessage } from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'
import { sendToPlugin } from '../../utils/messaging'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const TouchTargetChecker: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [threshold, setThreshold] = useState(44)
  const [scope, setScope] = useState<'selection' | 'page'>('selection')
  const [items, setItems] = useState<TouchTargetItem[]>([])
  const [filter, setFilter] = useState<'all' | 'fail' | 'pass'>('all')
  const [loading, setLoading] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)

  const requestAnalysis = useCallback((thresh: number, currentScope: 'selection' | 'page') => {
    setLoading(true)
    sendToPlugin({
      type: 'GET_TOUCH_TARGET_ANALYSIS',
      payload: { threshold: thresh, scope: currentScope },
    })
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined
      if (msg?.type === 'TOUCH_TARGET_ANALYSIS') {
        setItems(msg.payload.items)
        setLoading(false)
        setAnalyzed(true)
      }
    }

    window.addEventListener('message', handleMessage)
    requestAnalysis(threshold, scope)

    return () => window.removeEventListener('message', handleMessage)
  }, [threshold, scope, requestAnalysis])

  const handleFocus = (nodeId: string) => {
    sendToPlugin({ type: 'FOCUS_NODE', payload: { nodeId } })
  }

  const passCount = items.filter(i => i.status === 'PASS').length
  const failCount = items.filter(i => i.status === 'FAIL').length

  const filteredItems = items.filter(i => {
    if (filter === 'fail') return i.status === 'FAIL'
    if (filter === 'pass') return i.status === 'PASS'
    return true
  })

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Accessibility</div>
        <h1 className="tool-title">Touch Target Checker</h1>
        <p className="tool-description">
          Audit interactive elements to ensure they meet minimum touch target standards (44×44px or 48×48px).
        </p>
      </div>

      <div className="tool-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', overflow: 'hidden' }}>
        <SelectionBanner
          selection={selection}
          selectionHint="Select frames or buttons to audit, or switch to Current Page."
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
                  requestAnalysis(threshold, 'selection')
                }}
                style={{ height: 26, fontSize: 11, padding: '0 var(--sp-2)' }}
              >
                Selected Layers
              </button>
              <button
                className={`btn btn-sm ${scope === 'page' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setScope('page')
                  requestAnalysis(threshold, 'page')
                }}
                style={{ height: 26, fontSize: 11, padding: '0 var(--sp-2)' }}
              >
                Current Page
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-tertiary)' }}>
                Target:
              </span>
              <div style={{ display: 'inline-flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
                <button
                  className={`btn btn-sm ${threshold === 44 ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setThreshold(44)}
                  style={{ height: 26, fontSize: 11, padding: '0 var(--sp-2)' }}
                >
                  44×44px (Apple/WCAG)
                </button>
                <button
                  className={`btn btn-sm ${threshold === 48 ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setThreshold(48)}
                  style={{ height: 26, fontSize: 11, padding: '0 var(--sp-2)' }}
                >
                  48×48px (Android)
                </button>
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
              <div style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>Total Interactive</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-primary)' }}>
                {items.length}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: 'var(--sp-2) var(--sp-3)',
                cursor: 'pointer',
                border: filter === 'fail' ? '1.5px solid var(--c-error)' : '1px solid var(--c-border)',
                background: filter === 'fail' ? 'rgba(239, 68, 68, 0.05)' : 'var(--c-surface)',
              }}
              onClick={() => setFilter('fail')}
            >
              <div style={{ fontSize: 10, color: 'var(--c-error)' }}>Failing (&lt;{threshold}px)</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-error)' }}>
                {failCount}
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
              <div style={{ fontSize: 10, color: 'var(--c-success)' }}>Passing</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-success)' }}>
                {passCount}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>Checking touch targets…</div>
          </div>
        ) : items.length === 0 && analyzed ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <div className="empty-state-title">No interactive elements found</div>
            <div className="empty-state-body">
              {scope === 'selection'
                ? 'No button, icon, input, or interactive targets found in selection. Try selecting frames or switch to Current Page.'
                : 'No interactive elements detected on the current page.'}
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
                {filter === 'fail'
                  ? `${failCount} Touch Target Failures`
                  : filter === 'pass'
                  ? `${passCount} Passing Elements`
                  : `All ${items.length} Elements`}
              </div>
            </div>

            <div className="tool-scroll-list" style={{ flex: 1, padding: 0 }}>
              {filteredItems.map((item, idx) => {
                const isFail = item.status === 'FAIL'
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
                    title="Click to focus node in Figma"
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-primary)' }}>
                        {item.nodeName} <span style={{ fontSize: 10, color: 'var(--c-primary)' }}>↗</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', marginTop: 1 }}>
                        Size: {item.width}×{item.height}px
                        {isFail && ` — Min ${threshold}×${threshold}px required`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                      <span
                        className={isFail ? 'tag tag-danger' : 'tag tag-success'}
                        style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px' }}
                      >
                        {item.status}
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

export default TouchTargetChecker
