import React, { useState, useEffect, useCallback } from 'react'
import type { SelectionInfo, ColorExportData, PluginMessage } from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'
import { sendToPlugin } from '../../utils/messaging'
import { copyToClipboard } from '../../utils/clipboard'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

type ExportFormat = 'hex' | 'css' | 'scss' | 'json' | 'swift' | 'android'

export const ColorExport: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [scope, setScope] = useState<'selection' | 'page'>('selection')
  const [format, setFormat] = useState<ExportFormat>('hex')
  const [data, setData] = useState<ColorExportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const requestColors = useCallback((currentScope: 'selection' | 'page') => {
    setLoading(true)
    sendToPlugin({
      type: 'GET_COLOR_EXPORT_DATA',
      payload: { scope: currentScope },
    })
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined
      if (msg?.type === 'COLOR_EXPORT_DATA') {
        setData(msg.payload)
        setLoading(false)
      }
    }

    window.addEventListener('message', handleMessage)
    requestColors(scope)

    return () => window.removeEventListener('message', handleMessage)
  }, [scope, requestColors])

  const colors = data?.colors ?? []

  const generateExportText = (): string => {
    if (colors.length === 0) return ''

    switch (format) {
      case 'hex':
        return colors.map(c => `${c.hex} — ${c.count} use${c.count !== 1 ? 's' : ''}`).join('\n')

      case 'css':
        return `:root {\n${colors
          .map((c, i) => `  --color-${i + 1}: ${c.opacity < 1 ? c.rgba : c.hex}; /* ${c.count} uses */`)
          .join('\n')}\n}`

      case 'scss':
        return colors
          .map((c, i) => `$color-${i + 1}: ${c.opacity < 1 ? c.rgba : c.hex};`)
          .join('\n')

      case 'json': {
        const obj: Record<string, { hex: string; rgba: string; count: number; sources: string[] }> = {}
        colors.forEach((c, i) => {
          obj[`color-${i + 1}`] = {
            hex: c.hex,
            rgba: c.rgba,
            count: c.count,
            sources: c.sourceTypes,
          }
        })
        return JSON.stringify(obj, null, 2)
      }

      case 'swift':
        return `import SwiftUI\n\nextension Color {\n${colors
          .map((c, i) => `  static let color${i + 1} = Color(hex: "${c.hex.replace('#', '')}")`)
          .join('\n')}\n}`

      case 'android':
        return `<!-- Colors (${colors.length}) -->\n<resources>\n${colors
          .map((c, i) => `  <color name="color_${i + 1}">${c.hex}</color>`)
          .join('\n')}\n</resources>`

      default:
        return ''
    }
  }

  const handleCopy = async () => {
    const text = generateExportText()
    if (!text) return
    const success = await copyToClipboard(text)
    if (success) {
      setCopied(true)
      onSuccess(`Copied ${colors.length} colors (${format.toUpperCase()})`)
      setTimeout(() => setCopied(false), 2000)
    } else {
      onError('Failed to copy to clipboard')
    }
  }

  const handleCopySingle = async (hex: string) => {
    const success = await copyToClipboard(hex)
    if (success) {
      onSuccess(`Copied ${hex}`)
    } else {
      onError('Failed to copy')
    }
  }

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Developer</div>
        <h1 className="tool-title">Color Export</h1>
        <p className="tool-description">
          Extract, count, and export all unique colors and gradients in HEX, CSS, SCSS, JSON, Swift, or Android XML formats.
        </p>
      </div>

      <div className="tool-body" style={{ flex: 1, overflow: 'hidden', padding: 0 }}>
        <div className="tool-split-view" style={{ height: '100%' }}>
          {/* Left Pane: Controls, Swatches & Pinned Copy CTA */}
          <div className="tool-pane-left" style={{ width: 310, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <SelectionBanner
              selection={selection}
              selectionHint="Select frames or layers, or switch to Current Page."
            />

            {/* Scope & Format Picker Card */}
            <div className="card" style={{ padding: 'var(--sp-2) var(--sp-3)', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-secondary)' }}>Scope:</span>
                  <div style={{ display: 'inline-flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
                    <button
                      className={`btn btn-sm ${scope === 'selection' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => {
                        setScope('selection')
                        requestColors('selection')
                      }}
                      style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                    >
                      Selection
                    </button>
                    <button
                      className={`btn btn-sm ${scope === 'page' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => {
                        setScope('page')
                        requestColors('page')
                      }}
                      style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                    >
                      Page
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(['hex', 'css', 'scss', 'json', 'swift', 'android'] as ExportFormat[]).map(fmt => (
                    <button
                      key={fmt}
                      className={`btn btn-sm ${format === fmt ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setFormat(fmt)}
                      style={{ textTransform: 'uppercase', fontSize: 10, height: 24, padding: '0 6px' }}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Swatches List */}
            <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="card-header" style={{ padding: 'var(--sp-2) var(--sp-3)', flexShrink: 0 }}>
                <span className="card-title" style={{ fontSize: 12 }}>
                  {colors.length} Swatches ({data?.totalUsages ?? 0} uses)
                </span>
              </div>

              <div className="tool-scroll-list" style={{ flex: 1, padding: 'var(--sp-2)' }}>
                {loading ? (
                  <div style={{ padding: 'var(--sp-4)', textAlign: 'center', color: 'var(--c-text-tertiary)', fontSize: 12 }}>
                    Extracting colors…
                  </div>
                ) : colors.length === 0 ? (
                  <div style={{ padding: 'var(--sp-4)', textAlign: 'center', color: 'var(--c-text-tertiary)', fontSize: 12 }}>
                    No colors found in {scope}.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                    {colors.map((c, idx) => (
                      <div
                        key={`${c.hex}-${idx}`}
                        style={{
                          background: 'var(--c-surface)',
                          border: '1px solid var(--c-border)',
                          borderRadius: 'var(--r-sm)',
                          padding: '4px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                        }}
                        onClick={() => handleCopySingle(c.hex)}
                        title="Click to copy hex"
                      >
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 'var(--r-sm)',
                            background: c.hex,
                            border: '1px solid rgba(0,0,0,0.1)',
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--c-text-primary)' }}>
                            {c.hex}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--c-text-tertiary)' }}>
                            {c.count}×
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pinned Action Button */}
              {colors.length > 0 && (
                <div style={{ padding: 'var(--sp-2) var(--sp-3)', borderTop: '1px solid var(--c-border-subtle)', background: 'var(--c-surface-subtle)', flexShrink: 0 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleCopy}
                    id="copy-color-export-btn"
                    style={{ width: '100%', height: 32 }}
                  >
                    {copied ? 'Copied to Clipboard!' : `Copy All (${format.toUpperCase()})`}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Pane: Code Output Preview */}
          <div className="tool-pane-right" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                  Generated {format.toUpperCase()} Output
                </div>
              </div>

              <pre
                style={{
                  margin: 0,
                  padding: 'var(--sp-3)',
                  background: 'var(--c-surface-subtle)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: 'var(--c-text-primary)',
                  flex: 1,
                  overflow: 'auto',
                  userSelect: 'all',
                }}
              >
                <code>{generateExportText()}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ColorExport
