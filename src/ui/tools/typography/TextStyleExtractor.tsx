import React, { useState, useEffect } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo, TextStyleExtractorData } from '../../../shared/types'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const TextStyleExtractor: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [scope, setScope] = useState<'selection' | 'page'>('selection')
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<TextStyleExtractorData | null>(null)
  const [activeTab, setActiveTab] = useState<'styles' | 'unstyled'>('styles')
  const [selectedStyleId, setSelectedStyleId] = useState<string>('')

  const handleScan = () => {
    setIsLoading(true)
    sendToPlugin({
      type: 'GET_TEXT_STYLE_EXTRACTOR_DATA',
      payload: { scope },
    })
  }

  useEffect(() => {
    handleScan()

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage
      if (!msg) return

      if (msg.type === 'TEXT_STYLE_EXTRACTOR_DATA') {
        setIsLoading(false)
        setData(msg.payload)
        if (msg.payload.localStyles && msg.payload.localStyles.length > 0 && !selectedStyleId) {
          setSelectedStyleId(msg.payload.localStyles[0].id)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [scope])

  const handleFocus = (nodeId: string) => {
    sendToPlugin({
      type: 'FOCUS_NODE',
      payload: { nodeId },
    })
  }

  const handleApplyStyle = (nodeId: string) => {
    if (!selectedStyleId) {
      onError('Please select a text style to apply.')
      return
    }

    sendToPlugin({
      type: 'APPLY_STYLE_TO_TEXT',
      payload: { nodeId, styleId: selectedStyleId },
    })

    setTimeout(handleScan, 300)
  }

  const localStylesCount = data?.localStyles?.length || 0
  const unstyledCount = data?.unstyledNodes?.length || 0

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Typography / Text Style Extractor</div>
        <h1 className="tool-title">Text Style Extractor & Audit</h1>
        <p className="tool-desc">
          Audit typography consistency by inspecting local text style usage and finding raw unstyled text layers.
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
                    Selection
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

              <button className="btn btn-secondary btn-sm" onClick={handleScan} disabled={isLoading}>
                {isLoading ? 'Scanning...' : 'Re-scan'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 'var(--sp-2)', borderBottom: '1px solid var(--c-border)' }}>
            <button
              className={`btn btn-sm ${activeTab === 'styles' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('styles')}
              style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
            >
              Document Styles ({localStylesCount})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'unstyled' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('unstyled')}
              style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
            >
              Unstyled Layers ({unstyledCount})
            </button>
          </div>

          {/* Tab 1: Document Styles */}
          {activeTab === 'styles' && (
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {localStylesCount === 0 ? (
                  <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--c-text-secondary)', fontSize: 'var(--fs-sm)' }}>
                    No local text styles found in this Figma file. You can generate them with Typography Scale or Text Style Generator!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {data?.localStyles.map(st => (
                      <div
                        key={st.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--sp-3) var(--sp-4)',
                          borderBottom: '1px solid var(--c-border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-sm)', color: 'var(--c-text-primary)' }}>
                            {st.name}
                          </span>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {st.fontFamily} {st.fontWeight} • {st.fontSize}px / {st.lineHeight}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 'var(--r-full)',
                            background: st.usageCount > 0 ? 'rgba(37, 99, 235, 0.1)' : 'var(--c-bg)',
                            color: st.usageCount > 0 ? 'var(--c-accent)' : 'var(--c-text-tertiary)',
                          }}
                        >
                          {st.usageCount} layer{st.usageCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Unstyled Layers */}
          {activeTab === 'unstyled' && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="card-title">
                  {unstyledCount === 0 ? '🎉 All scanned text layers use defined text styles!' : `${unstyledCount} Unstyled Layers Found`}
                </span>
                {localStylesCount > 0 && unstyledCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                    <span style={{ fontSize: 11, color: 'var(--c-text-secondary)' }}>Target Style:</span>
                    <select
                      className="select"
                      style={{ height: 26, fontSize: 11, width: 140 }}
                      value={selectedStyleId}
                      onChange={e => setSelectedStyleId(e.target.value)}
                    >
                      {data?.localStyles.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="card-body" style={{ padding: 0 }}>
                {unstyledCount === 0 ? (
                  <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--c-text-secondary)', fontSize: 'var(--fs-sm)' }}>
                    Great job! Every single text layer conforms to a defined style.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {data?.unstyledNodes.map(node => (
                      <div
                        key={node.nodeId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--sp-3) var(--sp-4)',
                          borderBottom: '1px solid var(--c-border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 380 }}>
                          <span
                            style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-sm)', color: 'var(--c-text-primary)', cursor: 'pointer' }}
                            onClick={() => handleFocus(node.nodeId)}
                          >
                            {node.nodeName} ↗
                          </span>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-secondary)', fontStyle: 'italic' }}>
                            "{node.textSnippet}"
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                            {node.fontFamily} • {node.fontSize}px
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleFocus(node.nodeId)}
                          >
                            Focus
                          </button>
                          {localStylesCount > 0 && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleApplyStyle(node.nodeId)}
                            >
                              Link Style
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
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

export default TextStyleExtractor
