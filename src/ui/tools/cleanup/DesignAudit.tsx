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

      <div className="tool-body">
        <SelectionBanner
          selection={selection}
          selectionHint="Select layers or frames to audit, or switch to Current Page."
        />

        {/* Scope bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <button
              className={`btn btn-sm ${scope === 'selection' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setScope('selection')
                requestAudit('selection')
              }}
            >
              Selected Layers
            </button>
            <button
              className={`btn btn-sm ${scope === 'page' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setScope('page')
                requestAudit('page')
              }}
            >
              Current Page
            </button>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => requestAudit(scope)}
            disabled={loading}
          >
            {loading ? 'Auditing…' : 'Re-audit'}
          </button>
        </div>

        {/* Category Summary Cards */}
        {report && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-3)' }}>
            <div
              className="card"
              style={{
                padding: 'var(--sp-3)',
                cursor: 'pointer',
                border: activeCategory === 'all' ? '1.5px solid var(--c-accent)' : '1px solid var(--c-border)',
              }}
              onClick={() => setActiveCategory('all')}
            >
              <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Total Issues</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                {report.totalIssues}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: 'var(--sp-3)',
                cursor: 'pointer',
                border: activeCategory === 'naming' ? '1.5px solid var(--c-accent)' : '1px solid var(--c-border)',
              }}
              onClick={() => setActiveCategory('naming')}
            >
              <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Naming</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                {report.counts.Naming}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: 'var(--sp-3)',
                cursor: 'pointer',
                border: activeCategory === 'structure' ? '1.5px solid var(--c-accent)' : '1px solid var(--c-border)',
              }}
              onClick={() => setActiveCategory('structure')}
            >
              <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Structure</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                {report.counts.Structure}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: 'var(--sp-3)',
                cursor: 'pointer',
                border: activeCategory === 'styles' ? '1.5px solid var(--c-accent)' : '1px solid var(--c-border)',
              }}
              onClick={() => setActiveCategory('styles')}
            >
              <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Styles</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                {report.counts.Styles}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="empty-state">
            <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>Running design audit…</div>
          </div>
        ) : report && report.totalIssues === 0 && analyzed ? (
          <div className="empty-state">
            <div className="empty-state-title">✨ Zero issues detected!</div>
            <div className="empty-state-body">
              Your layers adhere to clean naming, tidy structure, and healthy style tokens.
            </div>
          </div>
        ) : filteredIssues.length > 0 ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div
              className="card-header"
              style={{
                paddingBottom: 'var(--sp-3)',
                borderBottom: '1px solid var(--c-border-subtle)',
              }}
            >
              <div className="card-title">
                {activeCategory === 'all'
                  ? `All Issues (${report?.totalIssues})`
                  : `${activeCategory.toUpperCase()} Issues (${filteredIssues.length})`}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 380, overflowY: 'auto' }}>
              {filteredIssues.map((issue, idx) => {
                const isCrit = issue.severity === 'Critical'
                const isWarn = issue.severity === 'Warning'
                return (
                  <div
                    key={issue.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--sp-3) var(--sp-4)',
                      borderBottom:
                        idx < filteredIssues.length - 1 ? '1px solid var(--c-border-subtle)' : 'none',
                      cursor: 'pointer',
                      transition: 'background 120ms ease',
                    }}
                    onClick={() => handleFocus(issue.nodeId)}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--c-sidebar-item-hover)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                    title="Click to focus in Figma"
                  >
                    <div style={{ minWidth: 0, flex: 1, paddingRight: 'var(--sp-3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-primary)' }}>
                          {issue.message}
                        </span>
                        <span className="tag" style={{ fontSize: 10 }}>
                          {issue.category}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--c-text-tertiary)', marginTop: 2 }}>
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
                        style={{ fontSize: 10, fontWeight: 600 }}
                      >
                        {issue.severity}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--c-text-tertiary)' }}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
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
