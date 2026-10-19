import React, { useState, useEffect } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import { shouldUseWhiteText } from '../../utils/color'
import type { SelectionInfo, ExtractedColorItem } from '../../../shared/types'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const ExtractColors: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [scope, setScope] = useState<'selection' | 'page'>('selection')
  const [isLoading, setIsLoading] = useState(false)
  const [colors, setColors] = useState<ExtractedColorItem[]>([])
  const [totalLayers, setTotalLayers] = useState(0)
  const [filterQuery, setFilterQuery] = useState('')
  const [hasScanned, setHasScanned] = useState(false)

  const handleScan = () => {
    setIsLoading(true)
    sendToPlugin({
      type: 'GET_EXTRACTED_COLORS',
      payload: { scope },
    })
  }

  useEffect(() => {
    // Initial scan on mount
    handleScan()

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage
      if (!msg) return

      if (msg.type === 'EXTRACTED_COLORS_DATA') {
        setIsLoading(false)
        setHasScanned(true)
        setColors(msg.payload.colors || [])
        setTotalLayers(msg.payload.totalLayersScanned || 0)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [scope])

  const handleCopy = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex)
      onSuccess(`Copied ${hex}`)
    } catch {
      onError('Failed to copy')
    }
  }

  const handleApply = (hex: string) => {
    if (!selection || selection.count === 0) {
      onError('Please select a layer on the canvas first.')
      return
    }
    sendToPlugin({
      type: 'APPLY_COLOR_TO_SELECTION',
      payload: { hex },
    })
  }

  const handleCreateStyles = () => {
    if (colors.length === 0) {
      onError('No colors to create styles for.')
      return
    }
    sendToPlugin({
      type: 'CREATE_COLOR_STYLES',
      payload: colors.map((c, i) => ({
        name: `Color ${i + 1} (${c.hex})`,
        hex: c.hex,
        groupName: scope === 'selection' ? 'Extracted/Selection' : 'Extracted/Document',
      })),
    })
  }

  const filtered = colors.filter(c =>
    c.hex.toLowerCase().includes(filterQuery.toLowerCase()) ||
    c.sources.some(s => s.toLowerCase().includes(filterQuery.toLowerCase()))
  )

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Colors / Extract Colors</div>
        <h1 className="tool-title">Extract Colors</h1>
        <p className="tool-desc">
          Scan and extract all solid colors, fills, and strokes from selected layers or the active page.
        </p>
      </div>

      <div className="main-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', maxWidth: 680 }}>
          {/* Controls Bar */}
          <div className="card">
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--c-text-secondary)' }}>
                  Scope:
                </span>
                <div style={{ display: 'inline-flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
                  <button
                    className={`btn btn-sm ${scope === 'selection' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setScope('selection')}
                    style={{ height: 26, padding: '0 var(--sp-3)' }}
                  >
                    Selection {selection && selection.count > 0 ? `(${selection.count})` : ''}
                  </button>
                  <button
                    className={`btn btn-sm ${scope === 'page' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setScope('page')}
                    style={{ height: 26, padding: '0 var(--sp-3)' }}
                  >
                    Entire Page
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button className="btn btn-secondary btn-sm" onClick={handleScan} disabled={isLoading}>
                  {isLoading ? 'Scanning...' : 'Re-scan'}
                </button>
                {colors.length > 0 && (
                  <button className="btn btn-primary btn-sm" onClick={handleCreateStyles}>
                    Create Color Styles ({colors.length})
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Results Section */}
          {hasScanned && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="card-title">
                  Found {colors.length} Unique Color{colors.length !== 1 ? 's' : ''} across {totalLayers} layer{totalLayers !== 1 ? 's' : ''}
                </span>
                {colors.length > 5 && (
                  <input
                    className="input"
                    style={{ width: 140, height: 28, fontSize: 'var(--fs-xs)' }}
                    placeholder="Filter hex..."
                    value={filterQuery}
                    onChange={e => setFilterQuery(e.target.value)}
                  />
                )}
              </div>

              <div className="card-body" style={{ padding: 0 }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--c-text-secondary)', fontSize: 'var(--fs-sm)' }}>
                    {colors.length === 0
                      ? 'No solid fill or stroke colors found in the scanned layers.'
                      : 'No colors matching your filter.'}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--sp-3)', padding: 'var(--sp-4)' }}>
                    {filtered.map(item => {
                      const useWhite = shouldUseWhiteText(item.hex)
                      return (
                        <div
                          key={item.hex}
                          style={{
                            background: 'var(--c-surface)',
                            border: '1px solid var(--c-border)',
                            borderRadius: 'var(--r-lg)',
                            padding: 'var(--sp-3)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--sp-2)',
                            boxShadow: 'var(--shadow-xs)',
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: 52,
                              borderRadius: 'var(--r-md)',
                              background: item.hex,
                              border: '1px solid rgba(0,0,0,0.08)',
                              display: 'flex',
                              alignItems: 'flex-end',
                              justifyContent: 'space-between',
                              padding: 'var(--sp-2)',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: useWhite ? '#ffffff' : '#000000',
                                background: useWhite ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.4)',
                                padding: '2px 6px',
                                borderRadius: 'var(--r-sm)',
                              }}
                            >
                              {item.count}×
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                color: useWhite ? '#ffffff' : '#000000',
                                opacity: 0.8,
                              }}
                            >
                              {item.sources.join(', ')}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--c-text-primary)' }}>
                              {item.hex}
                            </span>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ height: 24, padding: '0 6px', fontSize: 11 }}
                                onClick={() => handleCopy(item.hex)}
                                title="Copy hex"
                              >
                                Copy
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ height: 24, padding: '0 6px', fontSize: 11 }}
                                onClick={() => handleApply(item.hex)}
                                title="Apply color to selected layer"
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ExtractColors
