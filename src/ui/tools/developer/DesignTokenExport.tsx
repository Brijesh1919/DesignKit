import React, { useState, useEffect, useCallback } from 'react'
import type { SelectionInfo, DesignTokensData, PluginMessage } from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'
import { sendToPlugin } from '../../utils/messaging'
import { copyToClipboard } from '../../utils/clipboard'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const DesignTokenExport: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [scope, setScope] = useState<'selection' | 'page'>('selection')
  const [data, setData] = useState<DesignTokensData | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const requestTokens = useCallback((currentScope: 'selection' | 'page') => {
    setLoading(true)
    sendToPlugin({
      type: 'GET_DESIGN_TOKENS_DATA',
      payload: { scope: currentScope },
    })
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined
      if (msg?.type === 'DESIGN_TOKENS_DATA') {
        setData(msg.payload)
        setLoading(false)
      }
    }

    window.addEventListener('message', handleMessage)
    requestTokens(scope)

    return () => window.removeEventListener('message', handleMessage)
  }, [scope, requestTokens])

  const handleCopy = async () => {
    if (!data?.json) return
    const success = await copyToClipboard(data.json)
    if (success) {
      setCopied(true)
      onSuccess('Design tokens JSON copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } else {
      onError('Failed to copy to clipboard')
    }
  }

  const handleDownload = () => {
    if (!data?.json) return
    try {
      const blob = new Blob([data.json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'design-tokens.json'
      a.click()
      URL.revokeObjectURL(url)
      onSuccess('Downloaded design-tokens.json')
    } catch {
      onError('Failed to download file')
    }
  }

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Developer</div>
        <h1 className="tool-title">Design Token Export</h1>
        <p className="tool-description">
          Export design tokens (Colors, Typography, Spacing, Radius, Shadows) as standard W3C Design Tokens JSON.
        </p>
      </div>

      <div className="tool-body">
        <SelectionBanner
          selection={selection}
          selectionHint="Select layers to extract tokens, or switch to Current Page."
        />

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <button
              className={`btn btn-sm ${scope === 'selection' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setScope('selection')
                requestTokens('selection')
              }}
            >
              Selected Layers
            </button>
            <button
              className={`btn btn-sm ${scope === 'page' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setScope('page')
                requestTokens('page')
              }}
            >
              Current Page
            </button>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => requestTokens(scope)}
            disabled={loading}
          >
            {loading ? 'Extracting…' : 'Re-extract'}
          </button>
        </div>

        {/* Token Counts */}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--sp-2)' }}>
            <div className="card" style={{ padding: 'var(--sp-2) var(--sp-3)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>Colors</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-accent)' }}>{data.counts.colors}</div>
            </div>
            <div className="card" style={{ padding: 'var(--sp-2) var(--sp-3)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>Type</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-primary)' }}>{data.counts.typography}</div>
            </div>
            <div className="card" style={{ padding: 'var(--sp-2) var(--sp-3)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>Spacing</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-primary)' }}>{data.counts.spacing}</div>
            </div>
            <div className="card" style={{ padding: 'var(--sp-2) var(--sp-3)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>Radius</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-primary)' }}>{data.counts.radius}</div>
            </div>
            <div className="card" style={{ padding: 'var(--sp-2) var(--sp-3)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>Shadows</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-primary)' }}>{data.counts.shadows}</div>
            </div>
          </div>
        )}

        {/* JSON Preview */}
        {loading ? (
          <div className="empty-state">
            <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>Extracting design tokens…</div>
          </div>
        ) : data ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div
              className="card-header"
              style={{
                paddingBottom: 'var(--sp-3)',
                borderBottom: '1px solid var(--c-border-subtle)',
              }}
            >
              <div className="card-title">Tokens JSON</div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopy}
                  id="copy-tokens-json-btn"
                >
                  {copied ? 'Copied!' : 'Copy JSON'}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleDownload}
                  id="download-tokens-json-btn"
                >
                  Download .json
                </button>
              </div>
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
                maxHeight: 320,
                overflow: 'auto',
                userSelect: 'all',
              }}
            >
              <code>{data.json}</code>
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default DesignTokenExport
