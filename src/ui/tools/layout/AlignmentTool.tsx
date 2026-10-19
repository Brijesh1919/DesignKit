import React, { useState } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo, AlignmentType } from '../../../shared/types'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

interface ActionBtn {
  type: AlignmentType
  title: string
  desc: string
  icon: string
}

const HORIZONTAL_ACTIONS: ActionBtn[] = [
  { type: 'LEFT', title: 'Align Left', desc: 'Align layers to leftmost edge', icon: '⫷' },
  { type: 'CENTER', title: 'Align Center', desc: 'Align centers horizontally', icon: '⫿' },
  { type: 'RIGHT', title: 'Align Right', desc: 'Align layers to rightmost edge', icon: '⫸' },
  { type: 'DISTRIBUTE_HORIZONTALLY', title: 'Distribute H', desc: 'Distribute centers evenly', icon: '⋯' },
  { type: 'SPACE_EVENLY_HORIZONTAL', title: 'Equal Gaps H', desc: 'Equalize horizontal gaps', icon: '⇔' },
]

const VERTICAL_ACTIONS: ActionBtn[] = [
  { type: 'TOP', title: 'Align Top', desc: 'Align layers to top edge', icon: '⫶' },
  { type: 'MIDDLE', title: 'Align Middle', desc: 'Align centers vertically', icon: '⫺' },
  { type: 'BOTTOM', title: 'Align Bottom', desc: 'Align layers to bottom edge', icon: '⫵' },
  { type: 'DISTRIBUTE_VERTICALLY', title: 'Distribute V', desc: 'Distribute centers evenly', icon: '⋮' },
  { type: 'SPACE_EVENLY_VERTICAL', title: 'Equal Gaps V', desc: 'Equalize vertical gaps', icon: '⇕' },
]

export const AlignmentTool: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [targetMode, setTargetMode] = useState<'auto' | 'parent' | 'children'>('auto')

  const handleAlign = (alignType: AlignmentType) => {
    if (!selection || selection.count === 0) {
      onError('Please select layers to align.')
      return
    }

    sendToPlugin({
      type: 'APPLY_ALIGNMENT',
      payload: { alignType, targetMode },
    })
  }

  const count = selection ? selection.count : 0

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Layout / Alignment Tool</div>
        <h1 className="tool-title">Alignment & Distribution</h1>
        <p className="tool-desc">
          Precision alignment and equal-spacing distribution for single layers, parent frames, and multiple selected layers.
        </p>
      </div>

      <div className="main-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', maxWidth: 660 }}>
          {/* Target Mode Segmented Switch */}
          <div className="card">
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--c-text-primary)' }}>
                  Alignment Scope:
                </span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-tertiary)' }}>
                  {targetMode === 'auto'
                    ? count === 1
                      ? 'Auto: Align relative to parent container or children'
                      : 'Auto: Align selection relative to each other'
                    : targetMode === 'parent'
                    ? 'Align layers to parent frame bounds'
                    : 'Align children inside selected frame'}
                </span>
              </div>

              <div style={{ display: 'inline-flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
                <button
                  className={`btn btn-sm ${targetMode === 'auto' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTargetMode('auto')}
                  style={{ height: 26, padding: '0 var(--sp-3)' }}
                >
                  Auto
                </button>
                <button
                  className={`btn btn-sm ${targetMode === 'parent' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTargetMode('parent')}
                  style={{ height: 26, padding: '0 var(--sp-3)' }}
                >
                  To Parent
                </button>
                <button
                  className={`btn btn-sm ${targetMode === 'children' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTargetMode('children')}
                  style={{ height: 26, padding: '0 var(--sp-3)' }}
                >
                  Frame Children
                </button>
              </div>
            </div>
          </div>

          {/* Selection indicator */}
          <div
            style={{
              padding: 'var(--sp-2) var(--sp-3)',
              borderRadius: 'var(--r-md)',
              background: count > 0 ? 'rgba(37, 99, 235, 0.08)' : 'var(--c-bg)',
              border: '1px solid var(--c-border)',
              fontSize: 'var(--fs-xs)',
              color: 'var(--c-text-secondary)',
            }}
          >
            {count === 0
              ? 'Select 1 or more layers on the canvas to use alignment tools.'
              : count === 1
              ? `1 layer selected ("${selection?.nodeName || 'Layer'}")`
              : `${count} layers selected.`}
          </div>

          {/* Horizontal Alignment */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Horizontal Alignment & Spacing</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 'var(--sp-2)' }}>
                {HORIZONTAL_ACTIONS.map(act => (
                  <button
                    key={act.type}
                    className="btn btn-secondary"
                    style={{
                      height: 'auto',
                      padding: 'var(--sp-3) var(--sp-2)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      textAlign: 'center',
                    }}
                    onClick={() => handleAlign(act.type)}
                    title={act.desc}
                  >
                    <span style={{ fontSize: 20, lineHeight: 1 }}>{act.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{act.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Vertical Alignment */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Vertical Alignment & Spacing</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 'var(--sp-2)' }}>
                {VERTICAL_ACTIONS.map(act => (
                  <button
                    key={act.type}
                    className="btn btn-secondary"
                    style={{
                      height: 'auto',
                      padding: 'var(--sp-3) var(--sp-2)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      textAlign: 'center',
                    }}
                    onClick={() => handleAlign(act.type)}
                    title={act.desc}
                  >
                    <span style={{ fontSize: 20, lineHeight: 1 }}>{act.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{act.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AlignmentTool
