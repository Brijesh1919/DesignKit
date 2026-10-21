import React, { useState, useEffect, useCallback } from 'react'
import type { SelectionInfo, DesignAuditReport, DesignAuditIssue, PluginMessage } from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'
import { sendToPlugin } from '../../utils/messaging'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const DesignAudit: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [scope, setScope] = useState<'selection' | 'page'>('selection')
  const [report, setReport] = useState<DesignAuditReport | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)

  const requestAudit = useCallback((currentScope: 'selection' | 'page') => {
    setLoading(true)
    sendToPlugin({
      type: 'GET_DESIGN_AUDIT',
      payload: { scope: currentScope },
    })
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined
      if (msg?.type === 'DESIGN_AUDIT_REPORT') {
        setReport(msg.payload)
        setLoading(false)
        setAnalyzed(true)
      }
    }

    window.addEventListener('message', handleMessage)
    requestAudit(scope)

    return () => window.removeEventListener('message', handleMessage)
  }, [scope, requestAudit])

  const handleFocus = (nodeId: string) => {
    sendToPlugin({ type: 'FOCUS_NODE', payload: { nodeId } })
  }

  const issues = report?.issues ?? []
  const filteredIssues = issues.filter(issue => {
    if (activeCategory === 'all') return true
    return issue.category.toLowerCase() === activeCategory.toLowerCase()
  })

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Cleanup</div>
        <h1 className="tool-title">Design Audit</h1>
        <p className="tool-description">
          Deterministic design-quality audit to inspect layer naming, nesting depth, empty wrappers, hidden layers, and styling consistency.
        </p>
      </div>

      <div className="tool-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', overflow: 'hidden' }}>
        <SelectionBanner
          selection={selection}
          selectionHint="Select layers or frames to audit, or switch to Current Page."
        />

        {/* Scope bar */}
        <div className="card" style={{ padding: 'var(--sp-2) var(--sp-3)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
            <div style={{ display: 'inline-flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
              <button
                className={`btn btn-sm ${scope === 'selection' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setScope('selection')
                  requestAudit('selection')
                }}
                style={{ height: 26, fontSize: 11, padding: '0 var(--sp-2)' }}
              >
                Selected Layers
              </button>
              <button
                className={`btn btn-sm ${scope === 'page' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setScope('page')
                  requestAudit('page')
                }}
                style={{ height: 26, fontSize: 11, padding: '0 var(--sp-2)' }}
              >
                Current Page
              </button>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => requestAudit(scope)}
              disabled={loading}
              style={{ height: 26, fontSize: 11 }}
            >
              {loading ? 'Auditing…' : 'Re-audit'}
            </button>
          </div>
        </div>

        {/* Category Summary Cards */}
        {report && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-2)', flexShrink: 0 }}>
            <div
              className="card"
              style={{
                padding: 'var(--sp-2) var(--sp-3)',
                cursor: 'pointer',
                border: activeCategory === 'all' ? '1.5px solid var(--c-primary)' : '1px solid var(--c-border)',
                background: activeCategory === 'all' ? 'rgba(37, 99, 235, 0.04)' : 'var(--c-surface)',
              }}
              onClick={() => setActiveCategory('all')}
            >
              <div style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>Total Issues</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-primary)' }}>
                {report.totalIssues}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: 'var(--sp-2) var(--sp-3)',
                cursor: 'pointer',
                border: activeCategory === 'naming' ? '1.5px solid var(--c-primary)' : '1px solid var(--c-border)',
                background: activeCategory === 'naming' ? 'rgba(37, 99, 235, 0.04)' : 'var(--c-surface)',
              }}
              onClick={() => setActiveCategory('naming')}
            >
              <div style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>Naming</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-primary)' }}>
                {report.counts.Naming}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: 'var(--sp-2) var(--sp-3)',
                cursor: 'pointer',
                border: activeCategory === 'structure' ? '1.5px solid var(--c-primary)' : '1px solid var(--c-border)',
                background: activeCategory === 'structure' ? 'rgba(37, 99, 235, 0.04)' : 'var(--c-surface)',
              }}
              onClick={() => setActiveCategory('structure')}
            >
              <div style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>Structure</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-primary)' }}>
                {report.counts.Structure}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: 'var(--sp-2) var(--sp-3)',
                cursor: 'pointer',
                border: activeCategory === 'styles' ? '1.5px solid var(--c-primary)' : '1px solid var(--c-border)',
                background: activeCategory === 'styles' ? 'rgba(37, 99, 235, 0.04)' : 'var(--c-surface)',
              }}
              onClick={() => setActiveCategory('styles')}
            >
              <div style={{ fontSize: 10, color: 'var(--c-text-tertiary)' }}>Styles</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-primary)' }}>
                {report.counts.Styles}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>Running design audit…</div>
          </div>
        ) : report && report.totalIssues === 0 && analyzed ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <div className="empty-state-title">✨ Zero issues detected!</div>
            <div className="empty-state-body">
              Your layers adhere to clean naming, tidy structure, and healthy style tokens.
            </div>
          </div>
        ) : filteredIssues.length > 0 ? (
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
                {activeCategory === 'all'
                  ? `All Issues (${report?.totalIssues})`
                  : `${activeCategory.toUpperCase()} Issues (${filteredIssues.length})`}
              </div>
            </div>

            <div className="tool-scroll-list" style={{ flex: 1, padding: 0 }}>
              {filteredIssues.map((issue) => {
                const isCrit = issue.severity === 'Critical'
                const isWarn = issue.severity === 'Warning'
                return (
                  <div
                    key={issue.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--sp-2) var(--sp-3)',
                      borderBottom: '1px solid var(--c-border-subtle)',
                      cursor: 'pointer',
                      transition: 'background 120ms ease',
                    }}
                    onClick={() => handleFocus(issue.nodeId)}
                    title="Click to focus in Figma"
                  >
                    <div style={{ minWidth: 0, flex: 1, paddingRight: 'var(--sp-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-primary)' }}>
                          {issue.message} <span style={{ fontSize: 10, color: 'var(--c-primary)' }}>↗</span>
                        </span>
                        <span className="tag" style={{ fontSize: 9, padding: '1px 5px' }}>
                          {issue.category}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', marginTop: 1 }}>
                        Layer: <span style={{ color: 'var(--c-text-secondary)', fontWeight: 500 }}>"{issue.nodeName}"</span>
                        {issue.details ? ` — ${issue.details}` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexShrink: 0 }}>
                      <span
                        className={
                          isCrit
                            ? 'tag tag-danger'
                            : isWarn
                            ? 'tag tag-warning'
                            : 'tag tag-accent'
                        }
                        style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px' }}
                      >
                        {issue.severity}
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

export default DesignAudit

