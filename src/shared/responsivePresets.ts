// ============================================================
// Central Responsive Viewport Presets for DesignKit
// ============================================================

export interface ResponsivePreset {
  id: 'desktop' | 'laptop' | 'tablet' | 'mobile' | 'small-mobile' | 'custom'
  name: string
  width: number
  height: number
  description?: string
  iconName?: string
}

export const RESPONSIVE_PRESETS: ResponsivePreset[] = [
  {
    id: 'desktop',
    name: 'Desktop',
    width: 1440,
    height: 900,
    description: 'Standard desktop monitor viewport',
  },
  {
    id: 'laptop',
    name: 'Laptop',
    width: 1280,
    height: 800,
    description: 'Compact laptop screen viewport',
  },
  {
    id: 'tablet',
    name: 'Tablet',
    width: 768,
    height: 1024,
    description: 'Portrait tablet viewport (iPad)',
  },
  {
    id: 'mobile',
    name: 'Mobile',
    width: 390,
    height: 844,
    description: 'Modern smartphone viewport (iPhone 14/15)',
  },
  {
    id: 'small-mobile',
    name: 'Small Mobile',
    width: 320,
    height: 568,
    description: 'Compact smartphone viewport (iPhone SE)',
  },
]

export function getPresetById(id: string): ResponsivePreset | undefined {
  return RESPONSIVE_PRESETS.find(p => p.id === id)
}

export function validateCustomViewport(width: number, height: number): { valid: boolean; error?: string } {
  if (isNaN(width) || width <= 0) {
    return { valid: false, error: 'Width must be a positive number greater than 0.' }
  }
  if (isNaN(height) || height <= 0) {
    return { valid: false, error: 'Height must be a positive number greater than 0.' }
  }
  if (width > 10000 || height > 10000) {
    return { valid: false, error: 'Dimensions must not exceed 10,000px.' }
  }
  return { valid: true }
}
