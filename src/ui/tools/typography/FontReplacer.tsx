import React, { useState, useEffect, useMemo, useRef } from 'react'
import { sendToPlugin } from '../../utils/messaging'
import type { SelectionInfo, DetectedFontsData, DetectedFontItem } from '../../../shared/types'

interface Props {
  selection: SelectionInfo | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export interface FontMetadata {
  family: string
  category: 'sans-serif' | 'serif' | 'display' | 'monospace'
  styleDescription: string
  previewPhrase: string
}

export const POPULAR_FONT_METADATA: FontMetadata[] = [
  { family: 'Inter', category: 'sans-serif', styleDescription: 'Modern Neo-Grotesque', previewPhrase: 'Sphinx of black quartz, judge my vow' },
  { family: 'Poppins', category: 'sans-serif', styleDescription: 'Geometric & Friendly', previewPhrase: 'Pack my box with five dozen liquor jugs' },
  { family: 'Roboto', category: 'sans-serif', styleDescription: 'Mechanical & Neutral', previewPhrase: 'The quick brown fox jumps over the lazy dog' },
  { family: 'Plus Jakarta Sans', category: 'sans-serif', styleDescription: 'Premium Clean Geometric', previewPhrase: 'Contemporary typography for high-end UI' },
  { family: 'Montserrat', category: 'sans-serif', styleDescription: 'Wide Geometric Modern', previewPhrase: 'Urban architectural signage inspiration' },
  { family: 'Playfair Display', category: 'serif', styleDescription: 'High-Contrast Editorial', previewPhrase: 'Elegance & classic transitional serif' },
  { family: 'Outfit', category: 'sans-serif', styleDescription: 'Branded Tech Geometric', previewPhrase: 'Futuristic clean aesthetic & balance' },
  { family: 'Space Grotesk', category: 'display', styleDescription: 'Quirky Tech Monospace-look', previewPhrase: 'Raw digital aesthetic with eccentric glyphs' },
  { family: 'Geist', category: 'sans-serif', styleDescription: 'Swiss Developer Sans', previewPhrase: 'Engineered for clarity, code & interfaces' },
  { family: 'Manrope', category: 'sans-serif', styleDescription: 'Modern Semi-Rounded', previewPhrase: 'Legible cross-platform modern sans' },
  { family: 'Open Sans', category: 'sans-serif', styleDescription: 'Friendly Humanist', previewPhrase: 'Highly optimized for mobile & desktop interfaces' },
  { family: 'Lato', category: 'sans-serif', styleDescription: 'Warm Corporate Sans', previewPhrase: 'Harmonious proportion & sleek curves' },
  { family: 'DM Sans', category: 'sans-serif', styleDescription: 'Geometric Low-Contrast', previewPhrase: 'Distinctive lowercase letters & precision' },
  { family: 'Nunito', category: 'sans-serif', styleDescription: 'Soft Rounded Friendly', previewPhrase: 'Playful curves with excellent readability' },
  { family: 'Raleway', category: 'sans-serif', styleDescription: 'Elegant Headings', previewPhrase: 'Signature crossing W and geometric elegance' },
  { family: 'Work Sans', category: 'sans-serif', styleDescription: 'Early Grotesque Utility', previewPhrase: 'Optimized for screen typography & density' },
  { family: 'Rubik', category: 'sans-serif', styleDescription: 'Slightly Rounded Boxy', previewPhrase: 'Compact rounded sans for banners & UI' },
  { family: 'Oswald', category: 'display', styleDescription: 'Condensed Gothic Headline', previewPhrase: 'IMPACTFUL CONDENSED DISPLAY TITLES' },
  { family: 'Syne', category: 'display', styleDescription: 'Avant-Garde Expressive', previewPhrase: 'Experimental brutalist art direction' },
  { family: 'Georgia', category: 'serif', styleDescription: 'Classic Warm Screen Serif', previewPhrase: 'Traditional reading experience with elegance' },
  { family: 'Times New Roman', category: 'serif', styleDescription: 'Formal Editorial Serif', previewPhrase: 'The definitive standard for editorial texts' },
  { family: 'Arial', category: 'sans-serif', styleDescription: 'Universal Standard Sans', previewPhrase: 'Universally supported neo-grotesque type' },
  { family: 'Helvetica Neue', category: 'sans-serif', styleDescription: 'Iconic Swiss Grotesque', previewPhrase: 'The world standard for neutral modernism' },
  { family: 'SF Pro Display', category: 'sans-serif', styleDescription: 'Apple Native Typography', previewPhrase: 'Precision engineered for Apple ecosystems' },
  { family: 'Courier New', category: 'monospace', styleDescription: 'Classic Monospaced', previewPhrase: 'Fixed-width typewriter coding font' },
]

export const POPULAR_FONTS = POPULAR_FONT_METADATA.map(m => m.family)
const POPULAR_META_MAP = new Map<string, FontMetadata>(POPULAR_FONT_METADATA.map(m => [m.family.toLowerCase(), m]))

const FONT_WEIGHTS = [
  'Thin',
  'ExtraLight',
  'Light',
  'Regular',
  'Medium',
  'SemiBold',
  'Bold',
  'ExtraBold',
  'Black',
]

// Dynamic webfont injector
const loadedWebFontLinks = new Set<string>()
function ensureWebFont(family: string) {
  if (!family || loadedWebFontLinks.has(family)) return
  loadedWebFontLinks.add(family)

  const systemFonts = ['Arial', 'Helvetica', 'Helvetica Neue', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'Segoe UI']
  if (systemFonts.includes(family)) return

  try {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family.trim().replace(/ /g, '+'))}:wght@400;600;700&display=swap`
    document.head.appendChild(link)
  } catch (_) {}
}

// -------------------------------------------------------------
// Visual Font Picker Component with live styled typography preview
// -------------------------------------------------------------
interface VisualFontPickerProps {
  value: string
  onChange: (family: string) => void
  availableFamilies: string[]
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

const VisualFontPicker: React.FC<VisualFontPickerProps> = ({
  value,
  onChange,
  availableFamilies,
  isOpen,
  onToggle,
  onClose,
}) => {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | 'popular' | 'sans-serif' | 'serif' | 'display'>('all')
  const pickerRef = useRef<HTMLDivElement>(null)

  // Ensure current font is styled
  useEffect(() => {
    ensureWebFont(value)
  }, [value])

  // Handle outside click & escape
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Aggregate and filter fonts
  const displayFonts = useMemo(() => {
    const query = search.trim().toLowerCase()

    // Combine popular list and available Figma fonts
    const combinedSet = new Set<string>(POPULAR_FONTS)
    for (const f of availableFamilies) {
      combinedSet.add(f)
    }
    const allList = Array.from(combinedSet)

    return allList.filter(fn => {
      const meta = POPULAR_META_MAP.get(fn.toLowerCase())
      // Category filter
      if (activeCategory === 'popular' && !POPULAR_FONTS.includes(fn)) return false
      if (activeCategory === 'sans-serif' && meta?.category !== 'sans-serif') return false
      if (activeCategory === 'serif' && meta?.category !== 'serif') return false
      if (activeCategory === 'display' && meta?.category !== 'display') return false

      // Search query
      if (query) {
        const matchesName = fn.toLowerCase().includes(query)
        const matchesMeta = meta && (meta.category.includes(query) || meta.styleDescription.toLowerCase().includes(query))
        return matchesName || matchesMeta
      }
      return true
    })
  }, [search, activeCategory, availableFamilies])

  const currentMeta = POPULAR_META_MAP.get(value.toLowerCase())

  return (
    <div ref={pickerRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      {/* Trigger Button with live typography preview */}
      <button
        type="button"
        onClick={onToggle}
        className="btn btn-secondary"
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
          width: '100%',
          background: 'var(--c-bg)',
          border: isOpen ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
          textAlign: 'left',
          boxShadow: isOpen ? '0 0 0 2px rgba(37, 99, 235, 0.15)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
          <span
            style={{
              fontFamily: `"${value}", -apple-system, sans-serif`,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--c-text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            {value}
          </span>

          {currentMeta && (
            <span
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                padding: '1px 5px',
                borderRadius: 'var(--r-sm)',
                background: 'rgba(37, 99, 235, 0.08)',
                color: 'var(--c-accent)',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {currentMeta.category === 'sans-serif' ? 'Sans' : currentMeta.category === 'serif' ? 'Serif' : currentMeta.category}
            </span>
          )}

          <span
            style={{
              fontFamily: `"${value}", -apple-system, sans-serif`,
              fontSize: 12,
              color: 'var(--c-text-tertiary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Aa Bb Gg 123
          </span>
        </div>

        <span style={{ fontSize: 9, color: 'var(--c-text-tertiary)', marginLeft: 6, flexShrink: 0 }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Visual Dropdown Popover */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '100%',
            minWidth: 340,
            maxWidth: 440,
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-md)',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.22), 0 4px 8px rgba(0, 0, 0, 0.1)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Popover Header with Search */}
          <div style={{ padding: 'var(--sp-2)', borderBottom: '1px solid var(--c-border)', background: 'var(--c-bg)' }}>
            <input
              autoFocus
              className="input"
              style={{ height: 30, fontSize: 12, width: '100%' }}
              placeholder="Search fonts by name, style, or category…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: 4, marginTop: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {(['all', 'popular', 'sans-serif', 'serif', 'display'] as const).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 12,
                    border: 'none',
                    cursor: 'pointer',
                    background: activeCategory === cat ? 'var(--c-accent)' : 'var(--c-surface)',
                    color: activeCategory === cat ? '#fff' : 'var(--c-text-secondary)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat === 'all' ? 'All' : cat === 'popular' ? '🌟 Popular' : cat === 'sans-serif' ? 'Sans-Serif' : cat === 'serif' ? 'Serif' : 'Display'}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Font Quick Pick if not matching */}
          {search.trim() && !displayFonts.some(f => f.toLowerCase() === search.trim().toLowerCase()) && (
            <div
              onClick={() => {
                onChange(search.trim())
                onClose()
              }}
              style={{
                padding: '8px 12px',
                background: 'rgba(37, 99, 235, 0.05)',
                borderBottom: '1px solid var(--c-border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--c-text-primary)' }}>
                Use custom font: <strong>"{search.trim()}"</strong>
              </span>
              <span style={{ fontSize: 11, color: 'var(--c-accent)', fontWeight: 600 }}>Select ↵</span>
            </div>
          )}

          {/* Visual Font List */}
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {displayFonts.length === 0 ? (
              <div style={{ padding: 'var(--sp-4)', textAlign: 'center', fontSize: 12, color: 'var(--c-text-tertiary)' }}>
                No fonts found matching "{search}"
              </div>
            ) : (
              displayFonts.map(fn => {
                const isSelected = fn.toLowerCase() === value.toLowerCase()
                const meta = POPULAR_META_MAP.get(fn.toLowerCase())

                return (
                  <div
                    key={fn}
                    onClick={() => {
                      onChange(fn)
                      onClose()
                    }}
                    onMouseEnter={() => ensureWebFont(fn)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--c-border-subtle)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--c-accent)' : '3px solid transparent',
                      transition: 'background 0.12s ease',
                    }}
                  >
                    {/* Top Row: Font Family Name styled in its typeface */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontFamily: `"${fn}", -apple-system, sans-serif`,
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--c-text-primary)',
                          }}
                        >
                          {fn}
                        </span>

                        {meta && (
                          <span
                            style={{
                              fontSize: 10,
                              color: 'var(--c-text-tertiary)',
                              background: 'var(--c-bg)',
                              padding: '1px 5px',
                              borderRadius: 3,
                              border: '1px solid var(--c-border)',
                            }}
                          >
                            {meta.styleDescription}
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <span style={{ color: 'var(--c-accent)', fontWeight: 700, fontSize: 13 }}>✓</span>
                      )}
                    </div>

                    {/* Bottom Row: Typography Specimen Preview */}
                    <div
                      style={{
                        fontFamily: `"${fn}", -apple-system, sans-serif`,
                        fontSize: 12,
                        color: 'var(--c-text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {meta?.previewPhrase || 'The quick brown fox jumps over the lazy dog • 12345'}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// Main FontReplacer Tool Component
// -------------------------------------------------------------
export const FontReplacer: React.FC<Props> = ({ selection, onSuccess, onError }) => {
  const [scope, setScope] = useState<'selection' | 'page'>('selection')
  const [data, setData] = useState<DetectedFontsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [replacingKey, setReplacingKey] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Active visual font picker key: null | 'GLOBAL' | itemKey
  const [activePickerKey, setActivePickerKey] = useState<string | null>(null)

  // Available fonts dynamically fetched from Figma
  const [availableFamilies, setAvailableFamilies] = useState<string[]>([])
  const [familyStylesMap, setFamilyStylesMap] = useState<Record<string, string[]>>({})

  // Custom text input mode toggles: key -> boolean
  const [customMode, setCustomMode] = useState<Record<string, boolean>>({})
  const [globalCustomMode, setGlobalCustomMode] = useState(false)

  // State for batch replacing individual font groups: key -> { targetFamily, targetStyle }
  const [targets, setTargets] = useState<Record<string, { family: string; style: string }>>({})

  // Global "Replace All" state
  const [globalTargetFamily, setGlobalTargetFamily] = useState('Inter')
  const [globalTargetStyle, setGlobalTargetStyle] = useState('PRESERVE')
  const [showGlobalReplace, setShowGlobalReplace] = useState(false)

  const handleScan = () => {
    setLoading(true)
    sendToPlugin({
      type: 'GET_DETECTED_FONTS',
      payload: { scope },
    })
  }

  // Request all available fonts on mount
  useEffect(() => {
    sendToPlugin({ type: 'GET_AVAILABLE_FONTS' })
  }, [])

  useEffect(() => {
    handleScan()

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage
      if (!msg) return

      if (msg.type === 'AVAILABLE_FONTS_DATA') {
        if (msg.payload.families?.length) {
          setAvailableFamilies(msg.payload.families)
        }
        if (msg.payload.familyStylesMap) {
          setFamilyStylesMap(msg.payload.familyStylesMap)
        }
      }

      if (msg.type === 'DETECTED_FONTS_DATA') {
        setData(msg.payload)
        setLoading(false)
        setReplacingKey(null)

        if (msg.payload.availableFamilies?.length) {
          setAvailableFamilies(msg.payload.availableFamilies)
        }
        if (msg.payload.familyStylesMap) {
          setFamilyStylesMap(msg.payload.familyStylesMap)
        }

        // Initialize targets mapping with matching styles
        const initialTargets: Record<string, { family: string; style: string }> = {}
        for (const f of msg.payload.fonts || []) {
          const key = `${f.family}:::${f.style}`
          initialTargets[key] = {
            family: f.family,
            style: f.style,
          }
          ensureWebFont(f.family)
        }
        setTargets(initialTargets)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [scope])

  // Re-scan when selection changes if in selection scope
  useEffect(() => {
    if (scope === 'selection') {
      handleScan()
    }
  }, [selection])

  const handleSelectNodes = (nodeIds: string[]) => {
    sendToPlugin({
      type: 'SELECT_FONT_NODES',
      payload: { nodeIds },
    })
  }

  const handleReplaceSingle = (item: DetectedFontItem) => {
    const key = `${item.family}:::${item.style}`
    const target = targets[key] || { family: item.family, style: item.style || 'Regular' }

    if (!target.family.trim()) {
      onError('Please specify a target font family.')
      return
    }

    setReplacingKey(key)
    sendToPlugin({
      type: 'REPLACE_FONT',
      payload: {
        sourceFamily: item.family,
        sourceStyle: item.style,
        targetFamily: target.family.trim(),
        targetStyle: target.style,
        nodeIds: item.nodeIds,
        scope,
      },
    })
  }

  const handleReplaceAll = () => {
    if (!globalTargetFamily.trim()) {
      onError('Please specify a target font family.')
      return
    }

    setReplacingKey('ALL')
    if (!data || data.fonts.length === 0) return

    const allNodeIds = Array.from(new Set(data.fonts.flatMap(f => f.nodeIds)))

    sendToPlugin({
      type: 'REPLACE_FONT',
      payload: {
        sourceFamily: '', // empty matches all detected font families
        targetFamily: globalTargetFamily.trim(),
        targetStyle: globalTargetStyle,
        nodeIds: allNodeIds,
        scope,
      },
    })
  }

  const updateTargetFamily = (key: string, family: string) => {
    ensureWebFont(family)
    setTargets(prev => {
      const currentTarget = prev[key] || { style: 'Regular', family }
      const availableStyles = familyStylesMap[family]
      let newStyle = currentTarget.style
      if (availableStyles && availableStyles.length > 0 && !availableStyles.includes(newStyle)) {
        newStyle = availableStyles.includes('Regular') ? 'Regular' : availableStyles[0]
      }
      return {
        ...prev,
        [key]: {
          family,
          style: newStyle,
        },
      }
    })
  }

  const updateTargetStyle = (key: string, style: string) => {
    setTargets(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { family: 'Inter' }),
        style,
      },
    }))
  }

  // Helper to get available styles/weights for a given font family
  const getStylesForFamily = (family: string): string[] => {
    const styles = familyStylesMap[family]
    if (styles && styles.length > 0) {
      return styles
    }
    return FONT_WEIGHTS
  }

  const filteredDetectedFonts = data?.fonts.filter(f =>
    f.family.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.style.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.sampleText.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const totalFontsCount = data?.fonts.length || 0

  return (
    <div className="tool-view">
      <div className="tool-header">
        <div className="tool-breadcrumb">Typography / Font Replacer</div>
        <h1 className="tool-title">Font Replacer & Visual Switcher</h1>
        <p className="tool-desc">
          Detect all font families and weights, inspect live visual font styles, and replace fonts across selection or the entire page.
        </p>
      </div>

      <div className="main-scroll" style={{ paddingBottom: 100 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', maxWidth: 720 }}>
          {/* Controls Bar */}
          <div className="card">
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--c-text-secondary)' }}>
                  Scan Scope:
                </span>
                <div style={{ display: 'inline-flex', background: 'var(--c-bg)', padding: 2, borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
                  <button
                    className={`btn btn-sm ${scope === 'selection' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setScope('selection')}
                    style={{ height: 26, padding: '0 var(--sp-3)' }}
                  >
                    Selection {selection && selection.count > 0 ? `(${selection.count})` : ''}
                  </button>
                  <button
                    className={`btn btn-sm ${scope === 'page' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setScope('page')}
                    style={{ height: 26, padding: '0 var(--sp-3)' }}
                  >
                    Entire Page
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleScan}
                  disabled={loading}
                >
                  {loading ? 'Scanning…' : 'Re-scan'}
                </button>
                {totalFontsCount > 0 && (
                  <button
                    className={`btn btn-sm ${showGlobalReplace ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShowGlobalReplace(!showGlobalReplace)}
                  >
                    {showGlobalReplace ? 'Close Bulk Re-skin' : '⚡ Bulk Re-skin'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bulk Re-skin Card */}
          {showGlobalReplace && (
            <div className="card" style={{ border: '1px solid var(--c-accent)', background: 'rgba(37, 99, 235, 0.03)', overflow: 'visible' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="card-title">Bulk Rebrand: Replace ALL Fonts in {scope === 'selection' ? 'Selection' : 'Page'}</span>
                <span style={{ fontSize: 11, color: 'var(--c-accent)', fontWeight: 600 }}>Visual Batch Switcher</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', overflow: 'visible' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-secondary)' }}>
                  Preview and swap all {data?.totalTextNodes} text layers across {data?.uniqueFamiliesCount} font families to your chosen replacement font.
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 140px auto', gap: 'var(--sp-2)', alignItems: 'center' }}>
                  {/* Visual Font Picker with Custom Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    {globalCustomMode ? (
                      <input
                        className="input"
                        style={{ height: 32, fontSize: 12, flex: 1 }}
                        value={globalTargetFamily}
                        onChange={e => {
                          setGlobalTargetFamily(e.target.value)
                          ensureWebFont(e.target.value)
                        }}
                        placeholder="Type font family (e.g. Poppins)"
                      />
                    ) : (
                      <VisualFontPicker
                        value={globalTargetFamily}
                        onChange={fn => {
                          setGlobalTargetFamily(fn)
                          ensureWebFont(fn)
                        }}
                        availableFamilies={availableFamilies}
                        isOpen={activePickerKey === 'GLOBAL'}
                        onToggle={() => setActivePickerKey(activePickerKey === 'GLOBAL' ? null : 'GLOBAL')}
                        onClose={() => setActivePickerKey(null)}
                      />
                    )}

                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '0 6px', height: 32, fontSize: 11 }}
                      onClick={() => setGlobalCustomMode(!globalCustomMode)}
                      title={globalCustomMode ? 'Choose from visual font gallery' : 'Type custom font name'}
                    >
                      {globalCustomMode ? '📋 List' : '✏️ Type'}
                    </button>
                  </div>

                  {/* Weight Selector */}
                  <select
                    className="select"
                    style={{ height: 32, fontSize: 12 }}
                    value={globalTargetStyle}
                    onChange={e => setGlobalTargetStyle(e.target.value)}
                  >
                    <option value="PRESERVE">✨ Preserve Weights</option>
                    {getStylesForFamily(globalTargetFamily).map(w => (
                      <option key={`bulk-w-${w}`} value={w}>{w}</option>
                    ))}
                  </select>

                  <button
                    className="btn btn-primary"
                    style={{ height: 32, minWidth: 100 }}
                    onClick={handleReplaceAll}
                    disabled={replacingKey === 'ALL'}
                  >
                    {replacingKey === 'ALL' ? 'Updating…' : 'Replace All'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          {data && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
              <div className="card" style={{ padding: 'var(--sp-3)' }}>
                <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Total Text Layers</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                  {data.totalTextNodes}
                </div>
              </div>

              <div className="card" style={{ padding: 'var(--sp-3)' }}>
                <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Font Families</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                  {data.uniqueFamiliesCount}
                </div>
              </div>

              <div className="card" style={{ padding: 'var(--sp-3)' }}>
                <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>Font Styles / Weights</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-primary)', marginTop: 2 }}>
                  {data.fonts.length}
                </div>
              </div>
            </div>
          )}

          {/* Results List */}
          {loading ? (
            <div className="empty-state">
              <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>Scanning text layers for typography fonts…</div>
            </div>
          ) : totalFontsCount === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No Text Layers Found</div>
              <div className="empty-state-body">
                {scope === 'selection'
                  ? 'Select a frame, group, or text layer on the canvas to detect its fonts.'
                  : 'No text layers found on the active page.'}
              </div>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'visible' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <span className="card-title">
                    {totalFontsCount} Detected Font Group{totalFontsCount !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)', background: 'var(--c-bg)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--c-border)' }}>
                    Visual Typography Preview Enabled
                  </span>
                </div>

                {totalFontsCount > 3 && (
                  <input
                    className="input"
                    style={{ width: 150, height: 26, fontSize: 11 }}
                    placeholder="Filter detected layers…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    title="Filter detected text layers by name or text"
                  />
                )}
              </div>

              <div className="card-body" style={{ padding: 0, overflow: 'visible' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {filteredDetectedFonts.map(item => {
                    const key = `${item.family}:::${item.style}`
                    const target = targets[key] || { family: item.family, style: item.style }
                    const isBusy = replacingKey === key
                    const isCustom = !!customMode[key]
                    const stylesForTarget = getStylesForFamily(target.family)
                    const isPickerOpen = activePickerKey === key

                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--sp-2)',
                          padding: 'var(--sp-3) var(--sp-4)',
                          borderBottom: '1px solid var(--c-border-subtle)',
                          position: 'relative',
                        }}
                      >
                        {/* Top Row: Current Font Info with live typography styling */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                            <span
                              style={{
                                fontFamily: `"${item.family}", -apple-system, sans-serif`,
                                fontWeight: 700,
                                fontSize: 15,
                                color: 'var(--c-text-primary)',
                              }}
                            >
                              {item.family}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                background: 'rgba(37, 99, 235, 0.08)',
                                color: 'var(--c-accent)',
                                padding: '1px 6px',
                                borderRadius: 'var(--r-sm)',
                              }}
                            >
                              {item.style}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>
                              • {item.count} layer{item.count !== 1 ? 's' : ''}
                            </span>
                          </div>

                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ height: 24, fontSize: 11 }}
                            onClick={() => handleSelectNodes(item.nodeIds)}
                            title="Select all text layers using this font"
                          >
                            Select in Canvas ↗
                          </button>
                        </div>

                        {/* Sample Text Snippet styled in the layer's actual font */}
                        {item.sampleText && (
                          <div
                            style={{
                              fontFamily: `"${item.family}", -apple-system, sans-serif`,
                              fontSize: 12,
                              color: 'var(--c-text-secondary)',
                              paddingLeft: 'var(--sp-1)',
                            }}
                          >
                            "{item.sampleText}"
                          </div>
                        )}

                        {/* Replacement Controls Row */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(200px, 1fr) 110px auto',
                            gap: 'var(--sp-2)',
                            alignItems: 'center',
                            background: 'var(--c-bg)',
                            padding: 'var(--sp-2)',
                            borderRadius: 'var(--r-md)',
                            border: '1px solid var(--c-border)',
                            position: 'relative',
                          }}
                        >
                          {/* Visual Font Picker with custom typing toggle */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                            {isCustom ? (
                              <input
                                className="input"
                                style={{ height: 32, fontSize: 12, flex: 1 }}
                                value={target.family}
                                onChange={e => {
                                  updateTargetFamily(key, e.target.value)
                                  ensureWebFont(e.target.value)
                                }}
                                placeholder="Type font name (e.g. Poppins)"
                              />
                            ) : (
                              <VisualFontPicker
                                value={target.family}
                                onChange={fn => {
                                  updateTargetFamily(key, fn)
                                  ensureWebFont(fn)
                                }}
                                availableFamilies={availableFamilies}
                                isOpen={isPickerOpen}
                                onToggle={() => setActivePickerKey(isPickerOpen ? null : key)}
                                onClose={() => setActivePickerKey(null)}
                              />
                            )}

                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '0 6px', height: 32, fontSize: 11 }}
                              onClick={() => setCustomMode(prev => ({ ...prev, [key]: !isCustom }))}
                              title={isCustom ? 'Pick from visual font gallery' : 'Type custom font name'}
                            >
                              {isCustom ? '📋 List' : '✏️ Type'}
                            </button>
                          </div>

                          {/* Target Weight / Style Selector */}
                          <select
                            className="select"
                            style={{ height: 32, fontSize: 12 }}
                            value={target.style}
                            onChange={e => updateTargetStyle(key, e.target.value)}
                          >
                            {stylesForTarget.map(w => (
                              <option key={`${key}-w-${w}`} value={w}>{w}</option>
                            ))}
                            {!stylesForTarget.includes(target.style) && (
                              <option value={target.style}>{target.style}</option>
                            )}
                          </select>

                          {/* Replace Button */}
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ height: 32, minWidth: 90 }}
                            onClick={() => handleReplaceSingle(item)}
                            disabled={isBusy}
                          >
                            {isBusy ? 'Replacing…' : 'Replace Font'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FontReplacer
