import React, { useState } from 'react'
import { CATEGORIES, ALL_TOOLS } from '../registry/toolRegistry'
import type { SelectionInfo } from '../../shared/types'

interface Props {
  selection: SelectionInfo | null
  recentToolIds: string[]
  onToolSelect: (toolId: string) => void
}

// ---- Distinct Colorful SVG Icons for Quick Access Tools ----

const ColorPaletteIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10 .93 0 1.68-.75 1.68-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.66-.44-1.13 0-.93.75-1.69 1.69-1.69h1.99c3.05 0 5.52-2.47 5.52-5.52C21.98 6.48 17.5 2 12 2z"
      stroke="#6366F1"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="13.5" cy="6.5" r="1.6" fill="#EF4444" />
    <circle cx="17.5" cy="10.5" r="1.6" fill="#F59E0B" />
    <circle cx="8.5" cy="7.5" r="1.6" fill="#10B981" />
    <circle cx="6.5" cy="12.5" r="1.6" fill="#3B82F6" />
  </svg>
)

const ColorShadesIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <rect x="2.5" y="4" width="4.5" height="16" rx="2" fill="#93C5FD" stroke="#60A5FA" strokeWidth="1.2" />
    <rect x="7" y="4" width="4.5" height="16" rx="1" fill="#3B82F6" stroke="#2563EB" strokeWidth="1.2" />
    <rect x="12" y="4" width="4.5" height="16" rx="1" fill="#1D4ED8" stroke="#1E40AF" strokeWidth="1.2" />
    <rect x="17" y="4" width="4.5" height="16" rx="2" fill="#1E3A8A" stroke="#172554" strokeWidth="1.2" />
  </svg>
)

const TypeScaleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h9M7.5 6v13" stroke="#8B5CF6" strokeWidth="2.2" />
    <path d="M14 11h7M17.5 11v8" stroke="#EC4899" strokeWidth="1.8" />
    <circle cx="17.5" cy="5" r="1.2" fill="#F59E0B" />
    <circle cx="21" cy="5" r="1.2" fill="#F59E0B" />
  </svg>
)

const BgRemoverIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4.5l5 5L7.5 21.5H3v-4.5L14.5 4.5z" stroke="#0284C7" strokeWidth="1.8" />
    <line x1="11.5" y1="7.5" x2="16.5" y2="12.5" stroke="#38BDF8" strokeWidth="1.5" />
    <path d="M19 2v4M17 4h4" stroke="#F59E0B" strokeWidth="1.6" />
    <path d="M19 12v3M17.5 13.5h3" stroke="#EC4899" strokeWidth="1.4" />
    <circle cx="4" cy="5" r="1.2" fill="#8B5CF6" />
  </svg>
)

const AutoLayoutIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3.5" stroke="#10B981" strokeWidth="1.8" />
    <rect x="6.5" y="6.5" width="4.5" height="11" rx="1.5" fill="#34D399" />
    <rect x="13" y="6.5" width="4.5" height="11" rx="1.5" fill="#059669" />
  </svg>
)

const CssGeneratorIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="7 7 2 12 7 17" stroke="#F97316" strokeWidth="2.2" />
    <polyline points="17 7 22 12 17 17" stroke="#F97316" strokeWidth="2.2" />
    <line x1="14" y1="4" x2="10" y2="20" stroke="#EC4899" strokeWidth="2" />
  </svg>
)

const TextQAIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#3B82F6" strokeWidth="1.8" />
    <polyline points="14 2 14 8 20 8" stroke="#60A5FA" strokeWidth="1.6" />
    <path d="M8 15l2.5 2.5 5-5" stroke="#10B981" strokeWidth="2.2" />
  </svg>
)

const FontReplacerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19L8.5 5L13 19M5.5 15H11.5" stroke="#6366F1" strokeWidth="2" />
    <path d="M16 9.5h6m-2.5-2.5l2.5 2.5-2.5 2.5" stroke="#EC4899" strokeWidth="1.8" />
    <path d="M22 16.5h-6m2.5 2.5l-2.5-2.5 2.5-2.5" stroke="#06B6D4" strokeWidth="1.8" />
  </svg>
)

const QuickToolCard: React.FC<{
  name: string
  desc: string
  icon: React.ReactNode
  onClick: () => void
  id: string
}> = ({ name, desc, icon, onClick, id }) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <button
      id={id}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 'var(--sp-4)',
        background: 'var(--c-surface)',
        border: `1px solid ${isHovered ? 'var(--c-accent)' : 'var(--c-border)'}`,
        borderRadius: 'var(--r-xl)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 150ms ease',
        boxShadow: isHovered ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        transform: isHovered ? 'translateY(-2px)' : 'none',
      }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
      onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--r-lg, 8px)',
          background: isHovered ? 'var(--c-surface-hover, #F1F5F9)' : 'var(--c-bg, #F8FAFC)',
          border: `1px solid ${isHovered ? 'var(--c-border-strong, #CBD5E1)' : 'var(--c-border, #E2E8F0)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 150ms ease',
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-primary)' }}>{name}</div>
      <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', lineHeight: 1.4 }}>{desc}</div>
    </button>
  )
}

const QUICK_TOOLS = [
  // --- Row 1 ---
  {
    toolId: 'color-palette',
    name: 'Color Palette',
    desc: 'Generate shade scales',
    icon: <ColorPaletteIcon />,
  },
  {
    toolId: 'color-shades',
    name: 'Color Shades',
    desc: 'Fine-tune tint & shade',
    icon: <ColorShadesIcon />,
  },
  {
    toolId: 'typography-scale',
    name: 'Type Scale',
    desc: 'Musical ratio scales',
    icon: <TypeScaleIcon />,
  },
  {
    toolId: 'background-remover',
    name: 'BG Remover',
    desc: 'Studio AI cutout (1024px)',
    icon: <BgRemoverIcon />,
  },
  // --- Row 2 ---
  {
    toolId: 'auto-layout-optimizer',
    name: 'Auto Layout',
    desc: 'Optimize frames',
    icon: <AutoLayoutIcon />,
  },
  {
    toolId: 'css-generator',
    name: 'CSS Generator',
    desc: 'Export CSS from layers',
    icon: <CssGeneratorIcon />,
  },
  {
    toolId: 'text-qa',
    name: 'Text QA',
    desc: 'Spelling & grammar audit',
    icon: <TextQAIcon />,
  },
  {
    toolId: 'font-replacer',
    name: 'Font Replacer',
    desc: 'Batch replace font styles',
    icon: <FontReplacerIcon />,
  },
]

export const Dashboard: React.FC<Props> = ({ selection, recentToolIds, onToolSelect }) => {
  const hasSelection = selection && selection.count > 0

  return (
    <div style={{ padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', overflow: 'auto', flex: 1 }}>
      {/* Welcome */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)' }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--r-xl)',
            background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
          }}>
            <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L12 4V10L7 13L2 10V4L7 1Z" fill="white" fillOpacity="0.9"/>
              <path d="M7 4L10 5.73V9.27L7 11L4 9.27V5.73L7 4Z" fill="white" fillOpacity="0.4"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--c-text-primary)', lineHeight: 1.2 }}>
              DesignKit
            </h1>
            <p style={{ fontSize: 12, color: 'var(--c-text-tertiary)', marginTop: 2 }}>
              All-in-one local design utility toolkit
            </p>
          </div>
        </div>

        {/* Selection status */}
        {hasSelection ? (
          <div style={{
            padding: 'var(--sp-2) var(--sp-3)',
            background: 'var(--c-accent-subtle)',
            border: '1px solid var(--c-accent-border)',
            borderRadius: 'var(--r-lg)',
            fontSize: 12,
            color: 'var(--c-accent)',
            fontWeight: 500,
          }}>
            {selection!.count === 1
              ? `"${selection!.nodeName ?? 'Layer'}" selected`
              : `${selection!.count} layers selected`}
          </div>
        ) : (
          <div style={{
            padding: 'var(--sp-2) var(--sp-3)',
            background: 'var(--c-bg)',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-lg)',
            fontSize: 12,
            color: 'var(--c-text-tertiary)',
          }}>
            No selection — select a layer in Figma to unlock layer-aware tools
          </div>
        )}
      </div>

      {/* Quick access grid */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 'var(--sp-3)' }}>
          Quick Access
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-3)' }}>
          {QUICK_TOOLS.map(tool => (
            <QuickToolCard
              key={tool.toolId}
              id={`dashboard-quick-${tool.toolId}`}
              name={tool.name}
              desc={tool.desc}
              icon={tool.icon}
              onClick={() => onToolSelect(tool.toolId)}
            />
          ))}
        </div>
      </div>

      {/* Recent tools */}
      {recentToolIds.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 'var(--sp-3)' }}>
            Recently Used
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recentToolIds.slice(0, 4).map(id => {
              const tool = CATEGORIES.flatMap(c => c.tools).find(t => t.id === id)
              if (!tool) return null
              const cat = CATEGORIES.find(c => c.id === tool.categoryId)
              return (
                <button
                  key={id}
                  onClick={() => onToolSelect(id)}
                  id={`dashboard-recent-${id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-3)',
                    padding: 'var(--sp-2) var(--sp-3)',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--r-md)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 120ms ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-accent)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-primary)' }}>{tool.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>{cat?.label}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{
        padding: 'var(--sp-4)',
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-xl)',
        display: 'flex',
        gap: 'var(--sp-6)',
      }}>
        {[
          { label: 'Tools Ready', value: String(ALL_TOOLS.filter(t => t.implemented).length) },
          { label: 'Categories', value: String(CATEGORIES.length) },
          { label: 'Studio AI', value: '✓' },
          { label: 'Offline Ready', value: '✓' },
        ].map(stat => (
          <div key={stat.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-accent)', letterSpacing: '-0.5px' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Dashboard
