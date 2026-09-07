import React from 'react'
import { CATEGORIES, ALL_TOOLS } from '../registry/toolRegistry'
import type { SelectionInfo } from '../../shared/types'
import type { ToolCategoryId } from '../registry/toolRegistry'

interface Props {
  selection: SelectionInfo | null
  recentToolIds: string[]
  onToolSelect: (toolId: string) => void
}

const QuickToolCard: React.FC<{
  name: string
  desc: string
  color: string
  onClick: () => void
  id: string
}> = ({ name, desc, color, onClick, id }) => (
  <button
    id={id}
    onClick={onClick}
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      padding: 'var(--sp-4)',
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 'var(--r-xl)',
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'box-shadow 150ms ease, transform 150ms ease, border-color 150ms ease',
      boxShadow: 'var(--shadow-xs)',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = 'var(--shadow-md)'
      e.currentTarget.style.transform = 'translateY(-1px)'
      e.currentTarget.style.borderColor = 'var(--c-border-strong)'
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = 'var(--shadow-xs)'
      e.currentTarget.style.transform = ''
      e.currentTarget.style.borderColor = 'var(--c-border)'
    }}
    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
    onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
  >
    <div style={{
      width: 32,
      height: 32,
      borderRadius: 'var(--r-md)',
      background: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }} />
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-primary)' }}>{name}</div>
    <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', lineHeight: 1.4 }}>{desc}</div>
  </button>
)

const QUICK_TOOLS = [
  { toolId: 'color-palette',       name: 'Color Palette',   desc: 'Generate shade scales',       color: 'linear-gradient(135deg, #2563EB, #7C3AED)' },
  { toolId: 'color-harmony',       name: 'Color Harmony',   desc: 'Complementary & analogous',   color: 'linear-gradient(135deg, #059669, #2563EB)' },
  { toolId: 'contrast-checker',    name: 'Contrast',        desc: 'WCAG AA/AAA check',           color: 'linear-gradient(135deg, #DC2626, #D97706)' },
  { toolId: 'typography-scale',    name: 'Type Scale',      desc: 'Musical ratio scales',        color: 'linear-gradient(135deg, #7C3AED, #DB2777)' },
  { toolId: 'auto-layout-optimizer', name: 'Auto Layout',  desc: 'Optimize frames',             color: 'linear-gradient(135deg, #0891B2, #059669)' },
  { toolId: 'spacing-normalizer',  name: 'Spacing',         desc: 'Normalize to 8pt grid',      color: 'linear-gradient(135deg, #D97706, #DC2626)' },
  { toolId: 'image-color-extractor', name: 'Image Colors', desc: 'Extract dominant colors',     color: 'linear-gradient(135deg, #BE185D, #7C3AED)' },
  { toolId: 'background-remover',  name: 'BG Remover',     desc: 'Remove solid backgrounds',    color: 'linear-gradient(135deg, #1D4ED8, #0891B2)' },
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
              color={tool.color}
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
          { label: 'Categories', value: '8' },
          { label: 'No AI', value: '✓' },
          { label: 'No Backend', value: '✓' },
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
