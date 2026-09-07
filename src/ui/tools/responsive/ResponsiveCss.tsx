import React, { useState, useEffect, useCallback } from 'react'
import type {
  SelectionInfo,
  ResponsiveCssData,
  PluginMessage,
} from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'
import { sendToPlugin } from '../../utils/messaging'
import { copyToClipboard } from '../../utils/clipboard'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const ResponsiveCss: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [data, setData] = useState<ResponsiveCssData | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const requestCss = useCallback(() => {
    setLoading(true)
    sendToPlugin({ type: 'GET_RESPONSIVE_CSS' })
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined
      if (msg?.type === 'RESPONSIVE_CSS') {
        setData(msg.payload)
        setLoading(false)
      }
    }

    window.addEventListener('message', handleMessage)
    requestCss()

    return () => window.removeEventListener('message', handleMessage)
  }, [requestCss])

  useEffect(() => {
    requestCss()
  }, [selection, requestCss])

  const handleCopy = async () => {
    if (!data || !data.css) {
      onError('No CSS generated to copy.')
      return
    }

    const success = await copyToClipboard(data.css)
    if (success) {
      setCopied(true)
      onSuccess('Copied Responsive CSS with Media Queries!')
      setTimeout(() => setCopied(false), 2000)
    } else {
      onError('Failed to copy to clipboard.')
    }
  }

  const hasFrame =
    selection &&
    selection.count > 0 &&
    (selection.hasFrame ||
      selection.types.some(t => t === 'FRAME' || t === 'COMPONENT' || t === 'GROUP' || t === 'SECTION'))

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Responsive</div>
        <h1 className="tool-title">Responsive CSS</h1>
        <p className="tool-description">
          Generate production-ready CSS rules with responsive media queries for Desktop, Tablet (768px), Mobile (390px), and Small Mobile (320px).
        </p>
      </div>

      <div className="tool-body">
        <SelectionBanner
          selection={selection}
          selectionHint="Select a frame to generate responsive layout and media query CSS."
        />

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleCopy}
              disabled={!data || !data.css || loading}
            >
              {copied ? '✓ Copied!' : 'Copy Responsive CSS'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={requestCss}
              disabled={loading}
            >
              {loading ? 'Generating…' : 'Re-generate'}
            </button>
          </div>

          {data && (
            <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>
              {data.mediaQueriesCount} Media {data.mediaQueriesCount === 1 ? 'Query' : 'Queries'} Generated
            </span>
          )}
        </div>

        {/* Code Content */}
        {loading ? (
          <div className="empty-state">
            <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>
              Generating responsive media-query CSS…
            </div>
          </div>
        ) : !data || !hasFrame ? (
          <div className="empty-state">
            <div className="empty-state-title">Select a Frame</div>
            <div className="empty-state-body">
              Select a frame on the canvas to generate responsive CSS with media query overrides.
            </div>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div
              className="card-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: 'var(--sp-2)',
                borderBottom: '1px solid var(--c-border-subtle)',
              }}
            >
              <div className="card-title">
                {data.frameName} — Responsive Rules
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleCopy}
                style={{ fontSize: 11 }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            <pre
              style={{
                margin: 0,
                padding: 'var(--sp-4)',
                fontSize: 12,
                fontFamily: 'monospace',
                lineHeight: 1.5,
                background: 'var(--c-bg-subtle, #12141a)',
                color: 'var(--c-text-primary)',
                maxHeight: 460,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {data.css}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default ResponsiveCss
