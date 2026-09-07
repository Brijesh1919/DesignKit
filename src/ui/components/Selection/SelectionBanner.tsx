import React from 'react'
import type { SelectionInfo } from '../../../shared/types'

const LayersIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
    <polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
)

const AlertIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

interface SelectionBannerProps {
  selection: SelectionInfo | null
  requiresSelection?: boolean
  selectionHint?: string
}

export const SelectionBanner: React.FC<SelectionBannerProps> = ({
  selection,
  requiresSelection = false,
  selectionHint = 'Select a layer in Figma to use this tool.',
}) => {
  const hasSelection = selection && selection.count > 0

  if (hasSelection) {
    const label =
      selection.count === 1
        ? `${selection.nodeName ?? selection.types[0] ?? 'Layer'} selected`
        : `${selection.count} layers selected`

    return (
      <div className="selection-banner">
        <LayersIcon />
        <span>{label}</span>
        {selection.hasImage && (
          <span className="tag tag-accent" style={{ marginLeft: 4 }}>Image</span>
        )}
        {selection.hasFrame && (
          <span className="tag tag-accent" style={{ marginLeft: 4 }}>Frame</span>
        )}
      </div>
    )
  }

  return (
    <div className={`selection-banner${requiresSelection ? ' empty' : ' empty'}`}>
      <AlertIcon />
      <span>
        {requiresSelection
          ? selectionHint
          : 'No selection — you can still use this tool without selecting anything.'}
      </span>
    </div>
  )
}
