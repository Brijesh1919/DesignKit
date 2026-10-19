import React from 'react'
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
  const handleAlign = (alignType: AlignmentType) => {
    if (!selection || selection.count === 0) {
      onError('Please select layers to align.')
      return
    }

    sendToPlugin({
      type: 'APPLY_ALIGNMENT',
      payload: { alignType },
    })
  }

  const count = selection ? selection.count : 0

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Layout / Alignment Tool</div>
        <h1 className="tool-title">Alignment & Distribution</h1>
        <p className="tool-desc">
          Precision alignment and equal-spacing distribution for single layers (relative to parent frame) or multiple layers.
        </p>
      </div>

      <div className="main-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', maxWidth: 640 }}>
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
              ? `1 layer selected — actions align relative to parent container.`
              : `${count} layers selected — actions align relative to each other.`}
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
