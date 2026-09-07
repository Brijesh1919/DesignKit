import React, { useState, useEffect, useCallback } from 'react'
import type { SelectionInfo, LayerRenameItem, PluginMessage } from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'
import { sendToPlugin } from '../../utils/messaging'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const LayerNaming: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [scope, setScope] = useState<'selection' | 'page'>('selection')
  const [items, setItems] = useState<LayerRenameItem[]>([])
  const [totalChecked, setTotalChecked] = useState(0)
  const [loading, setLoading] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)

  const requestAnalysis = useCallback((currentScope: 'selection' | 'page') => {
    setLoading(true)
    sendToPlugin({
      type: 'GET_LAYER_NAMING_ANALYSIS',
      payload: { scope: currentScope },
    })
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined
      if (msg?.type === 'LAYER_NAMING_ANALYSIS') {
        setItems(msg.payload.items)
        setTotalChecked(msg.payload.totalLayersChecked)
        setLoading(false)
        setAnalyzed(true)
      }
    }

    window.addEventListener('message', handleMessage)
    requestAnalysis(scope)

    return () => window.removeEventListener('message', handleMessage)
  }, [scope, requestAnalysis])

  const toggleItem = (nodeId: string) => {
    setItems(prev =>
      prev.map(item => (item.nodeId === nodeId ? { ...item, checked: !item.checked } : item))
    )
  }

  const updateSuggestedName = (nodeId: string, newName: string) => {
    setItems(prev =>
      prev.map(item => (item.nodeId === nodeId ? { ...item, suggestedName: newName } : item))
    )
  }

  const toggleAll = (checked: boolean) => {
    setItems(prev => prev.map(item => ({ ...item, checked })))
  }

  const handleApply = () => {
    const toRename = items.filter(i => i.checked && i.suggestedName.trim())
    if (toRename.length === 0) {
      onError('Select at least one layer to rename.')
      return
    }

    sendToPlugin({
      type: 'APPLY_LAYER_RENAMES',
      payload: {
        renames: toRename.map(i => ({ nodeId: i.nodeId, newName: i.suggestedName.trim() })),
      },
    })
    onSuccess(`Renamed ${toRename.length} layer${toRename.length !== 1 ? 's' : ''}!`)
    setTimeout(() => requestAnalysis(scope), 300)
  }

  const handleFocus = (nodeId: string) => {
    sendToPlugin({ type: 'FOCUS_NODE', payload: { nodeId } })
  }

  const selectedCount = items.filter(i => i.checked).length

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Components</div>
        <h1 className="tool-title">Layer Naming</h1>
        <p className="tool-description">
          Batch rename generic layers (e.g. Rectangle 12, Frame 4) with semantic, contextual names.
        </p>
      </div>

      <div className="tool-body">
        <SelectionBanner
          selection={selection}
          selectionHint="Select layers to clean generic names, or switch to Current Page."
        />

        {/* Controls bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <button
              className={`btn btn-sm ${scope === 'selection' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setScope('selection')
                requestAnalysis('selection')
              }}
            >
              Selected Layers
            </button>
            <button
              className={`btn btn-sm ${scope === 'page' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setScope('page')
                requestAnalysis('page')
              }}
            >
              Current Page
            </button>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => requestAnalysis(scope)}
            disabled={loading}
          >
            {loading ? 'Scanning…' : 'Re-scan'}
          </button>
        </div>

        {/* Status / Results */}
        {loading ? (
          <div className="empty-state">
            <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>Scanning layers…</div>
          </div>
        ) : items.length === 0 && analyzed ? (
          <div className="empty-state">
            <div className="empty-state-title">All layers cleanly named!</div>
            <div className="empty-state-body">
              {totalChecked > 0
                ? `Checked ${totalChecked} layers. No generic or auto-generated names found.`
                : 'No layers found to inspect.'}
            </div>
          </div>
        ) : items.length > 0 ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div
              className="card-header"
              style={{
                paddingBottom: 'var(--sp-3)',
                borderBottom: '1px solid var(--c-border-subtle)',
              }}
            >
              <div className="card-title">
                {items.length} Generic Layer{items.length !== 1 ? 's' : ''} Found ({totalChecked} checked)
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => toggleAll(true)}
                  style={{ fontSize: 11 }}
                >
                  Select All
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => toggleAll(false)}
                  style={{ fontSize: 11 }}
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 380, overflowY: 'auto' }}>
              {items.map((item, idx) => (
                <div
                  key={item.nodeId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-3)',
                    padding: 'var(--sp-2) var(--sp-4)',
                    borderBottom:
                      idx < items.length - 1 ? '1px solid var(--c-border-subtle)' : 'none',
                    background: item.checked ? 'var(--c-surface)' : 'var(--c-bg)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggleItem(item.nodeId)}
                    style={{ cursor: 'pointer', accentColor: 'var(--c-accent)' }}
                  />

                  <div style={{ width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--c-text-tertiary)',
                        cursor: 'pointer',
                        textDecoration: 'line-through',
                      }}
                      onClick={() => handleFocus(item.nodeId)}
                      title="Click to view in Figma"
                    >
                      {item.currentName}
                    </span>
                  </div>

                  <span style={{ fontSize: 12, color: 'var(--c-text-tertiary)' }}>→</span>

                  <div style={{ flex: 1 }}>
                    <input
                      className="input"
                      style={{ height: 28, fontSize: 12 }}
                      type="text"
                      value={item.suggestedName}
                      onChange={e => updateSuggestedName(item.nodeId, e.target.value)}
                      placeholder="Semantic Name"
                    />
                  </div>

                  <span className="tag" style={{ fontSize: 10 }}>
                    {item.nodeType}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                padding: 'var(--sp-3) var(--sp-4)',
                background: 'var(--c-surface-subtle)',
                borderTop: '1px solid var(--c-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>
                {selectedCount} layer{selectedCount !== 1 ? 's' : ''} selected
              </span>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleApply}
                disabled={selectedCount === 0}
                id="apply-layer-renames-btn"
              >
                Rename Layers ({selectedCount})
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default LayerNaming
