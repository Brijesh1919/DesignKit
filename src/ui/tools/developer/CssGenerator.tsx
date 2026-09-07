import React, { useState, useEffect, useCallback } from 'react'
import type { SelectionInfo, CssGeneratorData, PluginMessage } from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'
import { sendToPlugin } from '../../utils/messaging'
import { copyToClipboard } from '../../utils/clipboard'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const CssGenerator: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [data, setData] = useState<CssGeneratorData | null>(null)
  const [mode, setMode] = useState<'rules' | 'variables'>('rules')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  const requestCss = useCallback(() => {
    if (!selection || selection.count === 0) {
      setData(null)
      return
    }
    setLoading(true)
    sendToPlugin({ type: 'GET_CSS_GENERATOR_DATA' })
  }, [selection])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined
      if (msg?.type === 'CSS_GENERATOR_DATA') {
        setData(msg.payload)
        setLoading(false)
      }
    }

    window.addEventListener('message', handleMessage)
    requestCss()

    return () => window.removeEventListener('message', handleMessage)
  }, [requestCss])

  const codeToDisplay = data ? (mode === 'rules' ? data.css : data.cssVariables) : ''

  const handleCopy = async () => {
    if (!codeToDisplay) return
    const success = await copyToClipboard(codeToDisplay)
    if (success) {
      setCopied(true)
      onSuccess(mode === 'rules' ? 'CSS rules copied!' : 'CSS variables copied!')
      setTimeout(() => setCopied(false), 2000)
    } else {
      onError('Failed to copy to clipboard')
    }
  }

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Developer</div>
        <h1 className="tool-title">CSS Generator</h1>
        <p className="tool-description">
          Generate clean, deterministic CSS for dimensions, Auto Layout flexbox, backgrounds, borders, shadows, and typography.
        </p>
      </div>

      <div className="tool-body">
        <SelectionBanner
          selection={selection}
          requiresSelection
          selectionHint="Select a layer, frame, or text in Figma to generate CSS."
        />

        {selection && selection.count > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button
                className={`btn btn-sm ${mode === 'rules' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('rules')}
              >
                CSS Rules
              </button>
              <button
                className={`btn btn-sm ${mode === 'variables' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('variables')}
              >
                CSS Variables
              </button>
            </div>

            {data && (
              <span className="tag" style={{ fontSize: 11 }}>
                {data.propertiesCount} properties generated
              </span>
            )}
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>Generating CSS…</div>
          </div>
        ) : !selection || selection.count === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No layer selected</div>
            <div className="empty-state-body">
              Select any frame, component, shape, or text layer on canvas to inspect and copy CSS.
            </div>
          </div>
        ) : data ? (
          <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div
              className="card-header"
              style={{
                paddingBottom: 'var(--sp-3)',
                borderBottom: '1px solid var(--c-border-subtle)',
              }}
            >
              <div className="card-title">
                {mode === 'rules' ? `CSS — .${data.nodeName}` : 'CSS Variables — :root'}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleCopy}
                id="copy-css-btn"
              >
                {copied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy CSS
                  </>
                )}
              </button>
            </div>

            <pre
              style={{
                margin: 0,
                padding: 'var(--sp-4)',
                background: 'var(--c-surface-subtle)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                lineHeight: 1.6,
                color: 'var(--c-text-primary)',
                overflowX: 'auto',
                userSelect: 'all',
              }}
            >
              <code>{codeToDisplay}</code>
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default CssGenerator
