import React, { useState, useEffect } from 'react'
import { CATEGORIES, findTool, type ToolCategoryId } from '../../registry/toolRegistry'

// ---- Category icons (SVG) ----
const PaletteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/>
    <circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
  </svg>
)

const TypeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/>
    <line x1="12" y1="4" x2="12" y2="20"/>
  </svg>
)

const LayoutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
  </svg>
)

const ImageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const ComponentIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
    <line x1="12" y1="22" x2="12" y2="15.5"/><line x1="22" y1="8.5" x2="12" y2="15.5"/>
    <line x1="2" y1="8.5" x2="12" y2="15.5"/>
    <line x1="2" y1="8.5" x2="12" y2="2"/><line x1="22" y1="8.5" x2="12" y2="2"/>
  </svg>
)

const AccessIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="4" r="2"/>
    <path d="m10.688 10.625-3.188 9.375M9 10H5M19 10h-4M13.312 10.625l3.188 9.375M9 10l3 2 3-2"/>
  </svg>
)

const ResponsiveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="14" height="18" rx="2"/>
    <rect x="15" y="8" width="7" height="13" rx="1.5"/>
  </svg>
)

const CleanupIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
    <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
)

const CodeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
)

const ICON_MAP: Record<string, React.FC> = {
  palette:       PaletteIcon,
  type:          TypeIcon,
  layout:        LayoutIcon,
  image:         ImageIcon,
  component:     ComponentIcon,
  accessibility: AccessIcon,
  responsive:    ResponsiveIcon,
  cleanup:       CleanupIcon,
  code:          CodeIcon,
}

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 170ms ease',
      marginLeft: 'auto',
    }}
  >
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

interface SidebarProps {
  activeToolId: string | null
  onToolSelect: (id: string) => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeToolId,
  onToolSelect,
}) => {
  // Derive category of currently active tool
  const activeCategoryId = activeToolId ? findTool(activeToolId)?.categoryId ?? null : null

  // Expanded categories state — independent from activeToolId
  const [expanded, setExpanded] = useState<Set<ToolCategoryId>>(() => {
    const init = new Set<ToolCategoryId>()
    if (activeCategoryId) {
      init.add(activeCategoryId)
    } else {
      init.add('colors') // default open category on launch
    }
    return init
  })

  // Whenever activeToolId changes, automatically expand its parent category in sidebar
  useEffect(() => {
    if (activeCategoryId) {
      setExpanded(prev => {
        if (!prev.has(activeCategoryId)) {
          const next = new Set(prev)
          next.add(activeCategoryId)
          return next
        }
        return prev
      })
    }
  }, [activeCategoryId])

  const toggleExpand = (id: ToolCategoryId) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Category click ONLY toggles expand/collapse. Does NOT change active tool or navigate!
  const handleCategoryClick = (id: ToolCategoryId) => {
    toggleExpand(id)
  }

  return (
    <nav className="sidebar" aria-label="Tool navigation">
      <div className="sidebar-scroll">
        <div className="sidebar-section-label">Tools</div>

        {CATEGORIES.map(cat => {
          const Icon = ICON_MAP[cat.iconName] ?? PaletteIcon
          const isActive = activeCategoryId === cat.id
          const isExpanded = expanded.has(cat.id)
          const implementedTools = cat.tools.filter(t => t.implemented)

          return (
            <div key={cat.id} className="sidebar-category">
              <button
                className={`sidebar-category-btn${isActive ? ' active' : ''}`}
                onClick={() => handleCategoryClick(cat.id as ToolCategoryId)}
                aria-expanded={isExpanded}
                id={`sidebar-cat-${cat.id}`}
              >
                <span className="sidebar-category-icon">
                  <Icon />
                </span>
                {cat.label}
                {implementedTools.length > 0 && (
                  <ChevronIcon open={isExpanded} />
                )}
              </button>

              {isExpanded && (
                <div className="sidebar-tool-list" role="list">
                  {cat.tools.map(tool => (
                    <button
                      key={tool.id}
                      role="listitem"
                      className={`sidebar-tool-btn${activeToolId === tool.id ? ' active' : ''}`}
                      onClick={() => onToolSelect(tool.id)}
                      id={`sidebar-tool-${tool.id}`}
                      style={!tool.implemented ? { opacity: 0.5 } : undefined}
                    >
                      <span className="sidebar-tool-dot" />
                      {tool.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
