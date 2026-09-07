import React, { useState, useEffect } from 'react'
import type { SelectionInfo } from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'
import { sendToPlugin } from '../../utils/messaging'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export const CreateComponent: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [componentName, setComponentName] = useState('')

  useEffect(() => {
    if (selection && selection.nodeName && selection.count === 1) {
      setComponentName(selection.nodeName)
    } else if (selection && selection.count > 1) {
      setComponentName('New Component')
    } else {
      setComponentName('')
    }
  }, [selection])

  const isAlreadyComponent =
    selection &&
    selection.count === 1 &&
    (selection.types.includes('COMPONENT') || selection.types.includes('COMPONENT_SET'))

  const hasSelection = selection && selection.count > 0

  const handleCreate = () => {
    if (!hasSelection) {
      onError('Select a layer to create a component.')
      return
    }

    if (isAlreadyComponent) {
      onError('Selected layer is already a component.')
      return
    }

    sendToPlugin({
      type: 'CREATE_COMPONENT',
      payload: { name: componentName.trim() || undefined },
    })
  }

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Components</div>
        <h1 className="tool-title">Create Component</h1>
        <p className="tool-description">
          Convert the currently selected layer or frame into a reusable, editable Figma Component.
        </p>
      </div>

      <div className="tool-body">
        <SelectionBanner
          selection={selection}
          requiresSelection
          selectionHint="Select a frame, group, or layer in Figma to create a component."
        />

        {isAlreadyComponent && (
          <div
            className="card"
            style={{
              padding: 'var(--sp-4)',
              background: 'var(--c-surface-subtle)',
              border: '1px solid var(--c-accent-border)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-3)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--r-md)',
                background: 'var(--c-accent-subtle)',
                color: 'var(--c-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
                <line x1="12" y1="22" x2="12" y2="15.5"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-primary)' }}>
                Selected layer is already a component.
              </div>
              <div style={{ fontSize: 12, color: 'var(--c-text-secondary)', marginTop: 2 }}>
                Select a different frame or layer to convert into a component.
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <div className="card-title">Component Settings</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div className="field">
              <label className="field-label">Component Name</label>
              <input
                className="input"
                type="text"
                value={componentName}
                onChange={e => setComponentName(e.target.value)}
                placeholder="e.g. Button / Primary, Card / UserProfile"
                disabled={!hasSelection || Boolean(isAlreadyComponent)}
              />
            </div>

            <div style={{ fontSize: 12, color: 'var(--c-text-tertiary)', lineHeight: 1.5 }}>
              Preserves all visual properties, Auto Layout, constraints, fills, strokes, effects, and child layers. Does not flatten or rasterize.
            </div>

            <div className="btn-row">
              <button
                className="btn btn-primary btn-full"
                onClick={handleCreate}
                disabled={!hasSelection || Boolean(isAlreadyComponent)}
                id="create-component-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
                  <line x1="12" y1="22" x2="12" y2="15.5"/><line x1="22" y1="8.5" x2="12" y2="15.5"/>
                  <line x1="2" y1="8.5" x2="12" y2="15.5"/><line x1="2" y1="8.5" x2="12" y2="2"/><line x1="22" y1="8.5" x2="12" y2="2"/>
                </svg>
                Create Component
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateComponent
