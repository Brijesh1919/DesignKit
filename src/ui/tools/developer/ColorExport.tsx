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

      <div className="tool-body">
        <SelectionBanner
          selection={selection}
          selectionHint="Select frames or layers to extract colors, or switch to Current Page."
        />

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <button
              className={`btn btn-sm ${scope === 'selection' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setScope('selection')
                requestColors('selection')
              }}
            >
              Selected Layers
            </button>
            <button
              className={`btn btn-sm ${scope === 'page' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setScope('page')
                requestColors('page')
              }}
            >
              Current Page
            </button>
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
            {(['hex', 'css', 'scss', 'json', 'swift', 'android'] as ExportFormat[]).map(fmt => (
              <button
                key={fmt}
                className={`btn btn-sm ${format === fmt ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFormat(fmt)}
                style={{ textTransform: 'uppercase', fontSize: 10 }}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-3)' }}>
            <div className="card" style={{ padding: 'var(--sp-3)' }}>
              <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Unique Colors</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                {data.totalUnique}
              </div>
            </div>
            <div className="card" style={{ padding: 'var(--sp-3)' }}>
              <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Total Color Usages</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-accent)', marginTop: 2 }}>
                {data.totalUsages}
              </div>
            </div>
          </div>
        )}

        {/* Color preview grid / code preview */}
        {loading ? (
          <div className="empty-state">
            <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>Extracting colors…</div>
          </div>
        ) : colors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No colors found</div>
            <div className="empty-state-body">
              Select layers with fills, strokes, or text to extract colors.
            </div>
          </div>
        ) : (
          <>
            {/* Color Swatch Strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: 'var(--sp-2)',
              }}
            >
              {colors.map((c, idx) => (
                <div
                  key={`${c.hex}-${idx}`}
                  style={{
                    background: 'var(--c-surface)',
                    border: '1px solid var(--c-border)',
                    borderRadius: 'var(--r-md)',
                    padding: 'var(--sp-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-2)',
                    cursor: 'pointer',
                    transition: 'transform 100ms ease, box-shadow 100ms ease',
                  }}
                  onClick={() => handleCopySingle(c.hex)}
                  title="Click to copy hex"
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 'var(--r-sm)',
                      background: c.hex,
                      border: '1px solid rgba(0,0,0,0.1)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--c-text-primary)' }}>
                      {c.hex}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--c-text-tertiary)' }}>
                      {c.count} use{c.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Code Output Card */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div
                className="card-header"
                style={{
                  paddingBottom: 'var(--sp-3)',
                  borderBottom: '1px solid var(--c-border-subtle)',
                }}
              >
                <div className="card-title">
                  Export — {format.toUpperCase()} ({colors.length} colors)
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopy}
                  id="copy-color-export-btn"
                >
                  {copied ? 'Copied!' : 'Copy All'}
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
                  maxHeight: 220,
                  overflow: 'auto',
                  userSelect: 'all',
                }}
              >
                <code>{generateExportText()}</code>
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ColorExport
