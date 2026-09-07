import React from 'react'

interface Props {
  toolName: string
  category: string
}

export const ComingSoon: React.FC<Props> = ({ toolName, category }) => (
  <div className="tool-view">
    <div className="tool-header">
      <div className="tool-breadcrumb">{category}</div>
      <h1 className="tool-title">{toolName}</h1>
    </div>
    <div className="empty-state" style={{ flex: 1 }}>
      <div className="empty-state-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      </div>
      <div className="empty-state-title">Coming Soon</div>
      <div className="empty-state-body">
        <strong>{toolName}</strong> is planned for a future release. The architecture is already in place — adding new tools only requires creating one new component file.
      </div>
    </div>
  </div>
)

export default ComingSoon
