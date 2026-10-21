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

      {/* Pinned Alignment Scope Toolbar */}
      <div style={{ padding: 'var(--sp-2) var(--sp-5)', background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)', color: 'var(--c-text-secondary)' }}>
            Scope:
          </span>
          <div style={{ display: 'inline-flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
            <button
              className={`btn btn-sm ${targetMode === 'auto' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTargetMode('auto')}
              style={{ height: 26, padding: '0 var(--sp-3)', fontSize: 11 }}
            >
              Auto
            </button>
            <button
              className={`btn btn-sm ${targetMode === 'parent' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTargetMode('parent')}
              style={{ height: 26, padding: '0 var(--sp-3)', fontSize: 11 }}
            >
              To Parent
            </button>
            <button
              className={`btn btn-sm ${targetMode === 'children' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTargetMode('children')}
              style={{ height: 26, padding: '0 var(--sp-3)', fontSize: 11 }}
            >
              Frame Children
            </button>
          </div>
        </div>

        {/* Selection indicator badge */}
        <div
          style={{
            padding: '3px 8px',
            borderRadius: 'var(--r-sm)',
            background: count > 0 ? 'rgba(37, 99, 235, 0.08)' : 'var(--c-bg)',
            border: '1px solid var(--c-border)',
            fontSize: 11,
            color: 'var(--c-text-secondary)',
          }}
        >
          {count === 0
            ? 'Select layers on canvas'
            : count === 1
            ? `1 layer: "${selection?.nodeName || 'Layer'}"`
            : `${count} layers selected`}
        </div>
      </div>

      {/* 2-Column Side-by-Side View */}
      <div className="tool-split-view">
        {/* Left Column: Horizontal Alignment */}
        <div className="tool-pane-left" style={{ width: '50%' }}>
          <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--c-border-subtle)' }}>
              <span className="card-title">Horizontal Alignment & Spacing</span>
            </div>
            <div className="card-body" style={{ flex: 1, padding: 'var(--sp-3)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 'var(--sp-2)' }}>
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
                    gap: 6,
                    textAlign: 'center',
                  }}
                  onClick={() => handleAlign(act.type)}
                  title={act.desc}
                >
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{act.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{act.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Vertical Alignment */}
        <div className="tool-pane-right">
          <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--c-border-subtle)' }}>
              <span className="card-title">Vertical Alignment & Spacing</span>
            </div>
            <div className="card-body" style={{ flex: 1, padding: 'var(--sp-3)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 'var(--sp-2)' }}>
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
                    gap: 6,
                    textAlign: 'center',
                  }}
                  onClick={() => handleAlign(act.type)}
                  title={act.desc}
                >
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{act.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{act.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AlignmentTool
