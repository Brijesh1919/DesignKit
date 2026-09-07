import React, { useState, useRef, useEffect } from 'react'
import { CATEGORIES, searchTools, type ToolDef } from '../../registry/toolRegistry'

// ---- SVG icon components ----
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

// Logo mark SVG
const LogoMark = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1L12 4V10L7 13L2 10V4L7 1Z" fill="white" fillOpacity="0.9"/>
    <path d="M7 4L10 5.73V9.27L7 11L4 9.27V5.73L7 4Z" fill="white" fillOpacity="0.4"/>
  </svg>
)

interface HeaderProps {
  onToolSelect: (toolId: string) => void
}

export const Header: React.FC<HeaderProps> = ({ onToolSelect }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ToolDef[]>([])
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.trim()) {
      setResults(searchTools(query))
      setOpen(true)
    } else {
      setResults([])
      setOpen(false)
    }
  }, [query])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (toolId: string) => {
    onToolSelect(toolId)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  // Group search results by category
  const grouped = results.reduce<Record<string, ToolDef[]>>((acc, tool) => {
    const cat = CATEGORIES.find(c => c.id === tool.categoryId)
    const label = cat?.label ?? tool.categoryId
    if (!acc[label]) acc[label] = []
    acc[label].push(tool)
    return acc
  }, {})

  return (
    <header className="header">
      {/* Logo */}
      <div className="header-logo">
        <div className="header-logo-mark">
          <LogoMark />
        </div>
        <span className="header-logo-text">DesignKit</span>
      </div>

      {/* Search */}
      <div className="header-search-wrap">
        <span className="header-search-icon">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          className="header-search"
          type="text"
          placeholder="Search tools…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (query.trim()) setOpen(true) }}
          onKeyDown={e => {
            if (e.key === 'Escape') { setQuery(''); setOpen(false) }
          }}
          aria-label="Search tools"
          id="header-search-input"
        />

        {open && (
          <div className="search-dropdown" ref={dropdownRef}>
            {results.length === 0 ? (
              <div className="search-empty">No tools found for "{query}"</div>
            ) : (
              Object.entries(grouped).map(([catLabel, tools]) => (
                <React.Fragment key={catLabel}>
                  <div className="search-result-category">{catLabel}</div>
                  {tools.map(tool => (
                    <div
                      key={tool.id}
                      className="search-result-item"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelect(tool.id)}
                      onKeyDown={e => e.key === 'Enter' && handleSelect(tool.id)}
                    >
                      <div>
                        <div className="search-result-name">
                          {tool.name}
                          {!tool.implemented && (
                            <span className="tag" style={{ marginLeft: 6, fontSize: 10 }}>
                              Soon
                            </span>
                          )}
                        </div>
                        <div className="search-result-desc">{tool.description}</div>
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              ))
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="header-actions">
        <button
          className="header-icon-btn"
          title="Settings"
          id="header-settings-btn"
          aria-label="Settings"
        >
          <SettingsIcon />
        </button>
      </div>
    </header>
  )
}
