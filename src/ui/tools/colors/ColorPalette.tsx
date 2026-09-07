import React, { useState, useId } from 'react'
import {
  generatePalette,
  isValidHex,
  normalizeHex,
  shouldUseWhiteText,
  type PaletteShade,
} from '../../utils/color'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo } from '../../../shared/types'
import { SelectionBanner } from '../../components/Selection/SelectionBanner'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

// ---- Per-entry state ----
interface PaletteEntry {
  id: string
  inputValue: string
  groupName: string
  palette: PaletteShade[]
  generated: boolean
  copiedShade: string | null
}

let _nextId = 1
function newEntry(hex = '#2563EB', name = 'Primary'): PaletteEntry {
  return {
    id: String(_nextId++),
    inputValue: hex,
    groupName: name,
    palette: [],
    generated: false,
    copiedShade: null,
  }
}

const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
)

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

// ---- Single palette row (input + generated strip) ----
interface PaletteRowProps {
  entry: PaletteEntry
  index: number
  isOnly: boolean
  selection: SelectionInfo | null
  onChange: (id: string, patch: Partial<PaletteEntry>) => void
  onRemove: (id: string) => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

const PaletteRow: React.FC<PaletteRowProps> = ({
  entry,
  index,
  isOnly,
  selection,
  onChange,
  onRemove,
  onSuccess,
  onError,
}) => {
  const resolvedHex = isValidHex(normalizeHex(entry.inputValue))
    ? normalizeHex(entry.inputValue)
    : '#2563EB'

  const handleInputChange = (val: string) => {
    onChange(entry.id, { inputValue: val })
  }

  const handleGenerate = () => {
    const hex = normalizeHex(entry.inputValue)
    if (!isValidHex(hex)) {
      onError(`Entry ${index + 1}: enter a valid hex color (e.g. #2563EB)`)
      return
    }
    onChange(entry.id, {
      palette: generatePalette(hex),
      generated: true,
    })
  }

  const handleCopy = async (hex: string, shade: string) => {
    try {
      await navigator.clipboard.writeText(hex)
      onChange(entry.id, { copiedShade: shade })
      setTimeout(() => onChange(entry.id, { copiedShade: null }), 1500)
      onSuccess(`Copied ${hex}`)
    } catch {
      onError('Failed to copy to clipboard')
    }
  }

  const handleCopyAll = () => {
    const text = entry.palette.map(p => `${p.shade}: ${p.hex}`).join('\n')
    navigator.clipboard.writeText(text)
    onSuccess(`Copied all shades for ${entry.groupName || `Color ${index + 1}`}`)
  }

  const handleCreateStyles = () => {
    if (entry.palette.length === 0) return
    sendToPlugin({
      type: 'CREATE_COLOR_STYLES',
      payload: entry.palette.map(p => ({
        name: p.shade,
        hex: p.hex,
        groupName: entry.groupName || `Color/${index + 1}`,
      })),
    })
  }

  const handleApply = (hex: string) => {
    if (!selection || selection.count === 0) {
      onError('Select a layer in Figma first.')
      return
    }
    sendToPlugin({ type: 'APPLY_COLOR_TO_SELECTION', payload: { hex } })
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Row header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2)',
          padding: 'var(--sp-3) var(--sp-4)',
          background: 'var(--c-surface-subtle)',
          borderBottom: '1px solid var(--c-border-subtle)',
        }}
      >
        {/* Color + index indicator */}
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 'var(--r-md)',
            background: resolvedHex,
            border: '1px solid rgba(0,0,0,0.1)',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-secondary)' }}>
          Color {index + 1}
        </span>
        {entry.generated && (
          <span className="tag tag-accent" style={{ fontSize: 10 }}>Generated</span>
        )}
        {!isOnly && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'auto', color: 'var(--c-text-tertiary)', padding: '2px 6px' }}
            onClick={() => onRemove(entry.id)}
            title="Remove this color"
            aria-label={`Remove color ${index + 1}`}
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding: 'var(--sp-3) var(--sp-4)', display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Base Color</label>
          <div className="color-field">
            <div
              className="color-field-swatch"
              style={{ background: resolvedHex }}
            >
              <input
                type="color"
                value={resolvedHex}
                onChange={e => handleInputChange(e.target.value)}
              />
            </div>
            <input
              className="color-field-input"
              type="text"
              value={entry.inputValue}
              onChange={e => handleInputChange(e.target.value)}
              placeholder="#2563EB"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Group Name</label>
          <input
            className="input"
            type="text"
            value={entry.groupName}
            onChange={e => onChange(entry.id, { groupName: e.target.value })}
            placeholder="e.g. Primary, Brand, Blue"
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ flexShrink: 0, marginBottom: 0 }}
          onClick={handleGenerate}
          id={`color-palette-generate-${entry.id}`}
        >
          Generate
        </button>
      </div>

      {/* Generated palette strip */}
      {entry.generated && entry.palette.length > 0 && (
        <div style={{ padding: '0 var(--sp-4) var(--sp-4)' }}>
          {/* Shade strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(11, 1fr)',
              gap: '3px',
              marginBottom: 'var(--sp-3)',
            }}
          >
            {entry.palette.map(p => {
              const useWhite = shouldUseWhiteText(p.hex)
              const isCopied = entry.copiedShade === p.shade
              return (
                <div key={p.shade} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    style={{
                      height: 44,
                      background: p.hex,
                      borderRadius: 'var(--r-sm)',
                      border: '1px solid rgba(0,0,0,0.06)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 100ms ease',
                    }}
                    title={`${p.shade}: ${p.hex} — click to copy`}
                    onClick={() => handleCopy(p.hex, p.shade)}
                    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.93)' }}
                    onMouseUp={e => { e.currentTarget.style.transform = '' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = '' }}
                  >
                    {isCopied && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke={useWhite ? '#fff' : '#000'} strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--c-text-secondary)' }}>
                      {p.shade}
                    </div>
                    <div
                      style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--c-text-tertiary)', cursor: 'pointer' }}
                      onClick={() => handleCopy(p.hex, p.shade)}
                    >
                      {p.hex.toUpperCase()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div className="btn-row">
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCreateStyles}
              id={`color-palette-create-styles-${entry.id}`}
            >
              Create Styles
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleCopyAll}
              id={`color-palette-copy-all-${entry.id}`}
            >
              <CopyIcon /> Copy All
            </button>
            {selection && selection.count > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleApply(entry.palette[5]?.hex ?? entry.palette[0]?.hex)}
                id={`color-palette-apply-${entry.id}`}
              >
                Apply 500
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Main tool ----
export const ColorPalette: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [entries, setEntries] = useState<PaletteEntry[]>([newEntry()])

  const updateEntry = (id: string, patch: Partial<PaletteEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  const removeEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const addEntry = () => {
    const DEFAULT_COLORS = [
      '#2563EB', '#10B981', '#F59E0B', '#EF4444',
      '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
    ]
    const nextColor = DEFAULT_COLORS[entries.length % DEFAULT_COLORS.length]
    const DEFAULT_NAMES = ['Primary', 'Success', 'Warning', 'Danger', 'Purple', 'Pink', 'Cyan', 'Lime']
    const nextName = DEFAULT_NAMES[entries.length % DEFAULT_NAMES.length]
    setEntries(prev => [...prev, newEntry(nextColor, nextName)])
  }

  const handleGenerateAll = () => {
    let hadError = false
    setEntries(prev => prev.map(entry => {
      const hex = normalizeHex(entry.inputValue)
      if (!isValidHex(hex)) {
        hadError = true
        return entry
      }
      return { ...entry, palette: generatePalette(hex), generated: true }
    }))
    if (hadError) onError('One or more entries have invalid hex colors — skipped.')
    else onSuccess('All palettes generated!')
  }

  const handleCreateAllStyles = () => {
    const generated = entries.filter(e => e.generated && e.palette.length > 0)
    if (generated.length === 0) {
      onError('Generate at least one palette first.')
      return
    }
    const allStyles = generated.flatMap(e =>
      e.palette.map(p => ({
        name: p.shade,
        hex: p.hex,
        groupName: e.groupName || 'Color',
      }))
    )
    sendToPlugin({ type: 'CREATE_COLOR_STYLES', payload: allStyles })
    onSuccess(`Creating styles for ${generated.length} palette${generated.length !== 1 ? 's' : ''}…`)
  }

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Colors</div>
        <h1 className="tool-title">Color Palette</h1>
        <p className="tool-description">
          Generate complete 50–950 shade scales from one or more base colors.
        </p>
      </div>

      <div className="tool-body">
        <SelectionBanner selection={selection} />

        {/* Global actions */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={handleGenerateAll}
            id="color-palette-generate-all-btn"
            style={{ flex: 1 }}
          >
            Generate All Palettes
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleCreateAllStyles}
            id="color-palette-create-all-styles-btn"
          >
            Create All Styles
          </button>
        </div>

        {/* Palette entries */}
        {entries.map((entry, index) => (
          <PaletteRow
            key={entry.id}
            entry={entry}
            index={index}
            isOnly={entries.length === 1}
            selection={selection}
            onChange={updateEntry}
            onRemove={removeEntry}
            onSuccess={onSuccess}
            onError={onError}
          />
        ))}

        {/* Add color button */}
        <button
          className="btn btn-secondary btn-full"
          onClick={addEntry}
          id="color-palette-add-color-btn"
          style={{ borderStyle: 'dashed', borderWidth: 1.5 }}
          disabled={entries.length >= 8}
        >
          <PlusIcon /> Add Another Color {entries.length >= 8 ? '(max 8)' : ''}
        </button>
      </div>
    </div>
  )
}

export default ColorPalette
