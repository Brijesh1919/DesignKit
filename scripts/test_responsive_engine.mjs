// ============================================================
// scripts/test_responsive_engine.mjs
// DesignKit Responsive Engine — Multi-Screen Real-World Test Suite
// ============================================================

import assert from 'assert'

// ---- Figma Mock Environment ----

class MockNode {
  constructor(type, name, w = 100, h = 100) {
    this.id = 'node_' + Math.random().toString(36).substring(2, 9)
    this._type = type
    this.name = name
    this.width = Math.round(w)
    this.height = Math.round(h)
    this._x = 0
    this._y = 0
    this._visible = true
    this.locked = false
    this.children = []
    this.parent = null
    this.layoutMode = 'NONE'
    this.primaryAxisSizingMode = 'AUTO'
    this.counterAxisSizingMode = 'AUTO'
    this.primaryAxisAlignItems = 'MIN'
    this.counterAxisAlignItems = 'MIN'
    this.paddingLeft = 0
    this.paddingRight = 0
    this.paddingTop = 0
    this.paddingBottom = 0
    this.itemSpacing = 0
    this.layoutAlign = 'INHERIT'
    this.layoutGrow = 0
    this.fills = []
    this.strokes = []
    this.characters = ''
    this.fontSize = 16
    this.fontName = { family: 'Inter', style: 'Regular' }
    this.textAlignHorizontal = 'LEFT'
    this.textAlignVertical = 'TOP'
    this.clipsContent = false
    this._pluginData = new Map()
    this.isLockedInstanceChild = false
    this._destroyedSublayer = false
  }

  get type() {
    if (this._destroyedSublayer) {
      throw new Error(`in get_type: The node (instance sublayer or table cell) with id "${this.id}" does not exist`)
    }
    return this._type
  }
  set type(val) {
    this._type = val
  }

  get visible() {
    if (this._destroyedSublayer) {
      throw new Error(`in get_visible: The node (instance sublayer or table cell) with id "${this.id}" does not exist`)
    }
    return this._visible
  }
  set visible(val) {
    if (this._destroyedSublayer) {
      throw new Error(`in set_visible: The node (instance sublayer or table cell) with id "${this.id}" does not exist`)
    }
    this._visible = val
  }

  get x() { return this._x }
  set x(val) {
    if (this._destroyedSublayer) {
      throw new Error(`in set_x: The node (instance sublayer or table cell) with id "${this.id}" does not exist`)
    }
    if (this.isLockedInstanceChild) {
      throw new Error('in set_x: This property cannot be overridden in an instance: relative-transform')
    }
    this._x = Math.round(val)
  }

  get y() { return this._y }
  set y(val) {
    if (this._destroyedSublayer) {
      throw new Error(`in set_y: The node (instance sublayer or table cell) with id "${this.id}" does not exist`)
    }
    if (this.isLockedInstanceChild) {
      throw new Error('in set_y: This property cannot be overridden in an instance: relative-transform')
    }
    this._y = Math.round(val)
  }

  get layoutSizingHorizontal() {
    if (this._layoutSizingHorizontal !== undefined) return this._layoutSizingHorizontal
    if (this.layoutMode === 'HORIZONTAL') {
      return this.primaryAxisSizingMode === 'AUTO' ? 'HUG' : 'FIXED'
    } else if (this.layoutMode === 'VERTICAL') {
      return this.counterAxisSizingMode === 'AUTO' ? 'HUG' : 'FIXED'
    }
    return 'FIXED'
  }
  set layoutSizingHorizontal(val) {
    this._layoutSizingHorizontal = val
    if (this.layoutMode === 'HORIZONTAL') {
      this.primaryAxisSizingMode = (val === 'HUG') ? 'AUTO' : 'FIXED'
    } else if (this.layoutMode === 'VERTICAL') {
      this.counterAxisSizingMode = (val === 'HUG') ? 'AUTO' : 'FIXED'
    }
  }

  get layoutSizingVertical() {
    if (this._layoutSizingVertical !== undefined) return this._layoutSizingVertical
    if (this.layoutMode === 'VERTICAL') {
      return this.primaryAxisSizingMode === 'AUTO' ? 'HUG' : 'FIXED'
    } else if (this.layoutMode === 'HORIZONTAL') {
      return this.counterAxisSizingMode === 'AUTO' ? 'HUG' : 'FIXED'
    }
    return 'FIXED'
  }
  set layoutSizingVertical(val) {
    this._layoutSizingVertical = val
    if (this.layoutMode === 'VERTICAL') {
      this.primaryAxisSizingMode = (val === 'HUG') ? 'AUTO' : 'FIXED'
    } else if (this.layoutMode === 'HORIZONTAL') {
      this.counterAxisSizingMode = (val === 'HUG') ? 'AUTO' : 'FIXED'
    }
  }

  detachInstance() {
    this.type = 'FRAME'
    for (const c of this.children) {
      c.isLockedInstanceChild = false
    }
    return this
  }

  resize(w, h) {
    this.width = Math.max(1, Math.round(w))
    this.height = Math.max(1, Math.round(h))
  }

  appendChild(child) {
    if (child.parent && child.parent !== this) {
      child.parent.children = child.parent.children.filter(c => c !== child)
    }
    child.parent = this
    this.children.push(child)
  }

  insertChild(index, child) {
    if (child.parent && child.parent !== this) {
      child.parent.children = child.parent.children.filter(c => c !== child)
    }
    child.parent = this
    const safeIdx = Math.max(0, Math.min(index, this.children.length))
    this.children.splice(safeIdx, 0, child)
  }

  remove() {
    if (this.parent) {
      this.parent.children = this.parent.children.filter(c => c !== this)
      this.parent = null
    }
  }

  getPluginData(k) {
    return this._pluginData.get(k) || ''
  }

  setPluginData(k, v) {
    this._pluginData.set(k, String(v))
  }

  getRangeFontName(start, end) {
    return this.fontName
  }

  clone() {
    const copy = new MockNode(this.type, this.name, this.width, this.height)
    copy.x = this.x
    copy.y = this.y
    copy.visible = this.visible
    copy.locked = this.locked
    copy.layoutMode = this.layoutMode
    copy.primaryAxisSizingMode = this.primaryAxisSizingMode
    copy.counterAxisSizingMode = this.counterAxisSizingMode
    copy.primaryAxisAlignItems = this.primaryAxisAlignItems
    copy.counterAxisAlignItems = this.counterAxisAlignItems
    copy.paddingLeft = this.paddingLeft
    copy.paddingRight = this.paddingRight
    copy.paddingTop = this.paddingTop
    copy.paddingBottom = this.paddingBottom
    copy.itemSpacing = this.itemSpacing
    copy.characters = this.characters
    copy.fontSize = this.fontSize
    copy.fontName = { ...this.fontName }
    copy.textAlignHorizontal = this.textAlignHorizontal
    copy.textAlignVertical = this.textAlignVertical
    copy.fills = JSON.parse(JSON.stringify(this.fills || []))
    copy.strokes = JSON.parse(JSON.stringify(this.strokes || []))
    copy.clipsContent = this.clipsContent
    for (const [k, v] of this._pluginData.entries()) {
      copy._pluginData.set(k, v)
    }
    for (const child of this.children) {
      copy.appendChild(child.clone())
    }
    return copy
  }
}

globalThis.figma = {
  createFrame() {
    return new MockNode('FRAME', 'Frame', 100, 100)
  },
  createText() {
    return new MockNode('TEXT', 'Text', 100, 20)
  },
  createRectangle() {
    return new MockNode('RECTANGLE', 'Rectangle', 100, 100)
  },
  async loadFontAsync(fn) {
    return true
  },
}

// Helpers to build fixtures
function createText(name, characters, fontSize = 16, w = 200, h = 24, x = 0, y = 0) {
  const t = new MockNode('TEXT', name, w, h)
  t.characters = characters
  t.fontSize = fontSize
  t.x = x
  t.y = y
  return t
}

function createButton(name, label, w = 140, h = 44, x = 0, y = 0) {
  const b = new MockNode('FRAME', name, w, h)
  b.x = x
  b.y = y
  b.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.5, b: 0.9 }, visible: true }]
  const t = createText(name + ' Label', label, 14, w - 20, 20, 10, 12)
  b.appendChild(t)
  return b
}

function createImage(name, w = 200, h = 200, x = 0, y = 0) {
  const img = new MockNode('RECTANGLE', name, w, h)
  img.fills = [{ type: 'IMAGE', visible: true }]
  img.x = x
  img.y = y
  return img
}

function createCard(name, title, subtitle, w = 320, h = 240, x = 0, y = 0) {
  const card = new MockNode('FRAME', name, w, h)
  card.x = x
  card.y = y
  card.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: true }]
  const t = createText(name + ' Title', title, 18, w - 40, 24, 20, 20)
  const s = createText(name + ' Subtitle', subtitle, 14, w - 40, 48, 20, 54)
  const btn = createButton(name + ' Button', 'Learn More', 120, 36, 20, 120)
  card.appendChild(t)
  card.appendChild(s)
  card.appendChild(btn)
  return card
}

// ---- Import responsiveEngine ----
const { applyResponsiveEngine, detectScreenArchetype } = await import('../src/plugin/figma/responsiveEngine.ts')

console.log('🧪 Running Universal Responsive Engine — Multi-Screen Verification Suite...\n')

let passed = 0
let failed = 0

async function testCase(name, fn) {
  try {
    process.stdout.write(`• ${name}... `)
    await fn()
    console.log('✅ PASS')
    passed++
  } catch (err) {
    console.log('❌ FAIL')
    console.error(err)
    failed++
  }
}

// ----------------------------------------------------
// TEST 1: SaaS Dashboard (Screen 1 & 6)
// ----------------------------------------------------
await testCase('Screen 1 & 6: SaaS Dashboard (sidebar + 2x2 metric cards + chart + feed)', async () => {
  const root = new MockNode('FRAME', 'Analytics Dashboard', 1440, 900)

  // Sidebar (vertical strip on left)
  const sidebar = new MockNode('FRAME', 'Dashboard Sidebar', 240, 900)
  sidebar.x = 0
  sidebar.y = 0
  sidebar.appendChild(createText('Brand Logo', 'ACME SaaS', 20, 180, 28, 20, 24))
  sidebar.appendChild(createText('Nav 1', 'Overview', 14, 180, 20, 20, 80))
  sidebar.appendChild(createText('Nav 2', 'Analytics', 14, 180, 20, 20, 120))
  sidebar.appendChild(createText('Nav 3', 'Customers', 14, 180, 20, 20, 160))
  sidebar.appendChild(createText('Nav 4', 'Settings', 14, 180, 20, 20, 200))
  root.appendChild(sidebar)

  // Main content container
  const main = new MockNode('FRAME', 'Main Content Area', 1200, 900)
  main.x = 240
  main.y = 0

  // Metrics section (4 cards in a row on desktop)
  const metricsSection = new MockNode('FRAME', 'Metrics Section', 1140, 140)
  metricsSection.x = 30
  metricsSection.y = 30
  const stats = [
    { title: 'Total Revenue', value: '$45,200', change: '+18%' },
    { title: 'Active Users', value: '1,280', change: '+12%' },
    { title: 'Conversions', value: '3.4%', change: '+0.8%' },
    { title: 'Bounce Rate', value: '24.5%', change: '-3.2%' },
  ]
  stats.forEach((s, idx) => {
    const c = new MockNode('FRAME', `Metric Card ${idx + 1}`, 260, 120)
    c.x = idx * 280
    c.y = 0
    c.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: true }]
    c.appendChild(createText('Label', s.title, 13, 220, 18, 16, 16))
    c.appendChild(createText('Stat Value', s.value, 24, 220, 32, 16, 40))
    c.appendChild(createText('Trend', s.change, 12, 220, 16, 16, 80))
    metricsSection.appendChild(c)
  })
  main.appendChild(metricsSection)

  // Chart section
  const chartSection = new MockNode('FRAME', 'Revenue Chart Section', 1140, 340)
  chartSection.x = 30
  chartSection.y = 200
  chartSection.appendChild(createText('Chart Title', 'Revenue Growth', 18, 400, 24, 20, 20))
  chartSection.appendChild(createImage('Chart Canvas', 1100, 260, 20, 60))
  main.appendChild(chartSection)

  // Activity Feed
  const feedSection = new MockNode('FRAME', 'Recent Activity Feed', 1140, 280)
  feedSection.x = 30
  feedSection.y = 570
  feedSection.appendChild(createText('Feed Title', 'Recent Orders', 18, 400, 24, 20, 20))
  for (let i = 0; i < 4; i++) {
    const row = new MockNode('FRAME', `Feed Row ${i + 1}`, 1100, 48)
    row.x = 20
    row.y = 60 + i * 52
    row.appendChild(createText('User', `Customer #${i + 101}`, 14, 200, 20, 10, 14))
    row.appendChild(createText('Amount', `$${(i + 1) * 120}.00`, 14, 120, 20, 800, 14))
    feedSection.appendChild(row)
  }
  main.appendChild(feedSection)
  root.appendChild(main)

  const log = []
  await applyResponsiveEngine(root, 'mobile', log)

  assert.strictEqual(root.width, 390, 'Root width must be 390px')
  assert.ok(root.height <= 1800, `Dashboard height must be compact (<= 1800px), got ${root.height}px`)
  assert.ok(root.height >= 600, `Dashboard height must be realistic (>= 600px), got ${root.height}px`)
})

// ----------------------------------------------------
// TEST 2: Marketing Feature Landing Page (Screen 2)
// ----------------------------------------------------
await testCase('Screen 2: Feature Landing Page (no ghost spaces between cards and CTA)', async () => {
  const root = new MockNode('FRAME', 'Marketing Landing Page', 1440, 2200)

  // Header
  const header = new MockNode('FRAME', 'Header Section', 1440, 80)
  header.x = 0; header.y = 0
  header.appendChild(createText('Brand', 'BrandApp', 22, 160, 28, 40, 26))
  for (let i = 0; i < 4; i++) {
    header.appendChild(createText(`Link ${i}`, `Feature ${i + 1}`, 14, 90, 20, 400 + i * 110, 30))
  }
  header.appendChild(createButton('Header CTA', 'Get Started', 130, 40, 1270, 20))
  root.appendChild(header)

  // Hero
  const hero = new MockNode('FRAME', 'Hero Section', 1440, 480)
  hero.x = 0; hero.y = 80
  hero.appendChild(createText('Hero Title', 'Build products with supernatural speed', 52, 700, 120, 80, 80))
  hero.appendChild(createText('Hero Subtitle', 'The complete platform for high-velocity teams.', 18, 600, 50, 80, 220))
  hero.appendChild(createButton('Hero CTA', 'Start Free Trial', 160, 48, 80, 290))
  hero.appendChild(createImage('Hero Illustration', 500, 340, 860, 70))
  root.appendChild(hero)

  // 6 Feature Cards (3x2 grid on desktop)
  const cardsSec = new MockNode('FRAME', 'Feature Cards Section', 1440, 680)
  cardsSec.x = 0; cardsSec.y = 560
  cardsSec.appendChild(createText('Section Title', 'Everything You Need', 36, 600, 44, 420, 40))
  for (let i = 0; i < 6; i++) {
    const c = createCard(`Feature Card ${i + 1}`, `Feature ${i + 1}`, 'High performance and scalable architecture.', 360, 220)
    c.x = 80 + (i % 3) * 440
    c.y = 120 + Math.floor(i / 3) * 260
    cardsSec.appendChild(c)
  }
  root.appendChild(cardsSec)

  // Circle Graphic Section
  const graphicSec = new MockNode('FRAME', 'Visual Showcase Section', 1440, 400)
  graphicSec.x = 0; graphicSec.y = 1240
  graphicSec.appendChild(createImage('Circle Graphic', 320, 320, 560, 40))
  root.appendChild(graphicSec)

  // Black CTA Banner
  const ctaSec = new MockNode('FRAME', 'CTA Banner Section', 1440, 240)
  ctaSec.x = 0; ctaSec.y = 1640
  ctaSec.fills = [{ type: 'SOLID', color: { r: 0.05, g: 0.05, b: 0.05 }, visible: true }]
  ctaSec.appendChild(createText('CTA Title', 'Ready to supercharge your workflow?', 32, 800, 40, 320, 60))
  ctaSec.appendChild(createButton('CTA Button', 'Get Started Now', 180, 48, 630, 130))
  root.appendChild(ctaSec)

  const log = []
  await applyResponsiveEngine(root, 'mobile', log)

  assert.strictEqual(root.width, 390, 'Mobile width is 390px')
  // Check that sections are stacked cleanly without huge ghost gaps
  const topKids = root.children.filter(c => c.visible !== false).sort((a, b) => a.y - b.y)
  for (let i = 1; i < topKids.length; i++) {
    const prev = topKids[i - 1]
    const cur = topKids[i]
    const gap = cur.y - (prev.y + prev.height)
    assert.ok(gap <= 32, `Gap between "${prev.name}" and "${cur.name}" should be <= 32px, got ${gap}px`)
  }
})

// ----------------------------------------------------
// TEST 3: Settings / Checkout Form (Screen 3)
// ----------------------------------------------------
await testCase('Screen 3: Settings Form (compact wrapping, no elongated ribbon)', async () => {
  const root = new MockNode('FRAME', 'Account Settings Form', 1024, 768)

  const formSection = new MockNode('FRAME', 'Form Container', 720, 600)
  formSection.x = 152; formSection.y = 60
  formSection.appendChild(createText('Form Heading', 'Profile & Billing Settings', 28, 600, 36, 40, 30))

  const fields = ['First Name', 'Last Name', 'Email Address', 'Company Name', 'Street Address', 'Postal Code']
  fields.forEach((f, idx) => {
    const col = idx % 2
    const row = Math.floor(idx / 2)
    const fieldFrame = new MockNode('FRAME', `Field ${f}`, 300, 72)
    fieldFrame.x = 40 + col * 320
    fieldFrame.y = 90 + row * 84
    fieldFrame.appendChild(createText('Label', f, 14, 280, 20, 0, 0))
    const input = new MockNode('FRAME', 'Input Box', 280, 44)
    input.x = 0; input.y = 26
    input.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 }, visible: true }]
    input.appendChild(createText('Placeholder', `Enter your ${f.toLowerCase()}`, 13, 260, 18, 12, 13))
    fieldFrame.appendChild(input)
    formSection.appendChild(fieldFrame)
  })

  formSection.appendChild(createButton('Save Button', 'Save Changes', 160, 44, 40, 380))
  root.appendChild(formSection)

  const log = []
  await applyResponsiveEngine(root, 'mobile', log)

  assert.strictEqual(root.width, 390)
  assert.ok(root.height <= 1100, `Form page height must be compact (<= 1100px), got ${root.height}px`)
})

// ----------------------------------------------------
// TEST 4: Modal Dialog (Screen 4)
// ----------------------------------------------------
await testCase('Screen 4: Modal Dialog (remains compact card, no full-page elongation)', async () => {
  const root = new MockNode('FRAME', 'Sign In Modal Dialog', 480, 520)
  root.appendChild(createText('Close Icon', '✕', 20, 24, 24, 420, 24))
  root.appendChild(createText('Title', 'Welcome Back', 26, 380, 34, 40, 50))
  root.appendChild(createText('Subtitle', 'Sign in to access your account', 14, 380, 20, 40, 90))

  const emailField = new MockNode('FRAME', 'Email Field', 400, 68)
  emailField.x = 40; emailField.y = 130
  emailField.appendChild(createText('Email Label', 'Email Address', 13, 380, 18, 0, 0))
  const emailInput = new MockNode('FRAME', 'Email Input', 400, 42)
  emailInput.x = 0; emailInput.y = 22
  emailField.appendChild(emailInput)
  root.appendChild(emailField)

  const passField = new MockNode('FRAME', 'Password Field', 400, 68)
  passField.x = 40; passField.y = 215
  passField.appendChild(createText('Password Label', 'Password', 13, 380, 18, 0, 0))
  const passInput = new MockNode('FRAME', 'Password Input', 400, 42)
  passInput.x = 0; passInput.y = 22
  passField.appendChild(passInput)
  root.appendChild(passField)

  root.appendChild(createButton('Login Button', 'Sign In', 400, 46, 40, 310))

  const archetype = detectScreenArchetype(root, root.width, root.height)
  assert.strictEqual(archetype, 'MODAL_DIALOG', 'Must detect MODAL_DIALOG archetype')

  const log = []
  await applyResponsiveEngine(root, 'mobile', log)

  assert.strictEqual(root.width, 390)
  assert.ok(root.height <= 700, `Modal page must not elongate (<= 700px), got ${root.height}px`)
})

// ----------------------------------------------------
// TEST 5: Editorial Photo Gallery (Screen 5)
// ----------------------------------------------------
await testCase('Screen 5: Photo Gallery (2-column photo grid, CTA flush below)', async () => {
  const root = new MockNode('FRAME', 'Editorial Photography Portfolio', 1440, 1800)

  const header = new MockNode('FRAME', 'Portfolio Header', 1440, 80)
  header.appendChild(createText('Brand', 'STUDIO VOGUE', 22, 200, 28, 60, 26))
  root.appendChild(header)

  const intro = new MockNode('FRAME', 'Intro Section', 1440, 180)
  intro.x = 0; intro.y = 80
  intro.appendChild(createText('Heading', 'Selected Works 2026', 44, 800, 54, 60, 40))
  root.appendChild(intro)

  // 6 Photos in a gallery (3x2 on desktop)
  const gallery = new MockNode('FRAME', 'Gallery Section', 1440, 800)
  gallery.x = 0; gallery.y = 260
  for (let i = 0; i < 6; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const img = createImage(`Photo ${i + 1}`, 400, 360, 60 + col * 440, row * 390)
    gallery.appendChild(img)
  }
  root.appendChild(gallery)

  // Orange CTA banner
  const orangeCta = new MockNode('FRAME', 'Orange CTA Banner', 1440, 260)
  orangeCta.x = 0; orangeCta.y = 1080
  orangeCta.fills = [{ type: 'SOLID', color: { r: 1, g: 0.4, b: 0.1 }, visible: true }]
  orangeCta.appendChild(createText('CTA Title', 'Let’s Create Something Iconic Together', 36, 800, 46, 60, 60))
  orangeCta.appendChild(createButton('Hire Button', 'Start a Project', 180, 48, 60, 140))
  root.appendChild(orangeCta)

  const log = []
  await applyResponsiveEngine(root, 'mobile', log)

  assert.strictEqual(root.width, 390)
  assert.ok(root.height <= 2200, `Gallery page height must be compact (<= 2200px), got ${root.height}px`)

  // Verify orange CTA is positioned tightly below gallery
  const galleryNode = root.children.find(c => c.name.includes('Gallery'))
  const ctaNode = root.children.find(c => c.name.includes('Orange CTA'))
  if (galleryNode && ctaNode) {
    const gap = ctaNode.y - (galleryNode.y + galleryNode.height)
    assert.ok(gap <= 32, `CTA banner gap below gallery must be <= 32px, got ${gap}px`)
  }
})

// ----------------------------------------------------
// TEST 6: E-Commerce Storefront (Screen 7)
// ----------------------------------------------------
await testCase('Screen 7: E-Commerce Storefront (2-column product grid)', async () => {
  const root = new MockNode('FRAME', 'Sneaker Storefront', 1440, 1600)

  const header = new MockNode('FRAME', 'Store Header', 1440, 72)
  header.appendChild(createText('Brand', 'KICKS SHOP', 22, 180, 28, 40, 22))
  header.appendChild(createText('Cart', '🛒 Cart (2)', 15, 100, 20, 1300, 26))
  root.appendChild(header)

  // Products grid (3x2 on desktop)
  const productsSection = new MockNode('FRAME', 'Trending Sneakers', 1440, 920)
  productsSection.x = 0; productsSection.y = 72
  productsSection.appendChild(createText('Sec Title', 'Trending Sneakers', 32, 500, 38, 40, 30))

  const products = [
    { title: 'Air Boost Pro', price: '$149.00' },
    { title: 'Retro High OG', price: '$189.00' },
    { title: 'Cloud Runner V2', price: '$129.00' },
    { title: 'Street Classic', price: '$99.00' },
    { title: 'Trail Matrix X', price: '$169.00' },
    { title: 'Urban Glide Lite', price: '$119.00' },
  ]

  products.forEach((p, idx) => {
    const card = new MockNode('FRAME', `Product Card ${idx + 1}`, 380, 380)
    card.x = 40 + (idx % 3) * 440
    card.y = 90 + Math.floor(idx / 3) * 410
    card.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 }, visible: true }]
    card.appendChild(createImage('Product Photo', 380, 240, 0, 0))
    card.appendChild(createText('Title', p.title, 16, 340, 22, 20, 255))
    card.appendChild(createText('Price', p.price, 18, 160, 24, 20, 285))
    card.appendChild(createButton('Buy', 'Add to Cart', 120, 36, 240, 280))
    productsSection.appendChild(card)
  })
  root.appendChild(productsSection)

  const archetype = detectScreenArchetype(root, root.width, root.height)
  assert.strictEqual(archetype, 'E_COMMERCE', 'Must detect E_COMMERCE archetype')

  const log = []
  await applyResponsiveEngine(root, 'mobile', log)

  assert.strictEqual(root.width, 390)
  assert.ok(root.height <= 1800, `E-commerce storefront must be compact (<= 1800px), got ${root.height}px`)
})

// ----------------------------------------------------
// TEST 7: Admin Data Table (Screen 8)
// ----------------------------------------------------
await testCase('Screen 8: Admin Data Table (dense rows compacted, no 10,000px explosion)', async () => {
  const root = new MockNode('FRAME', 'Invoices Data Table Admin', 1200, 800)

  const tableFrame = new MockNode('FRAME', 'Transactions Table', 1120, 600)
  tableFrame.x = 40; tableFrame.y = 60

  // 10 table rows
  for (let i = 0; i < 10; i++) {
    const row = new MockNode('FRAME', `Table Row ${i + 1}`, 1120, 52)
    row.x = 0; row.y = i * 54
    row.appendChild(createText('Invoice ID', `INV-2026-${1000 + i}`, 13, 140, 18, 16, 17))
    row.appendChild(createText('Customer', `Client Company ${i + 1}`, 13, 240, 18, 180, 17))
    row.appendChild(createText('Date', 'Sep 10, 2026', 13, 160, 18, 450, 17))
    row.appendChild(createText('Status', 'PAID', 12, 100, 18, 650, 17))
    row.appendChild(createText('Amount', `$${(i + 1) * 350}.00`, 13, 140, 18, 800, 17))
    tableFrame.appendChild(row)
  }
  root.appendChild(tableFrame)

  const archetype = detectScreenArchetype(root, root.width, root.height)
  assert.strictEqual(archetype, 'DATA_TABLE_ADMIN', 'Must detect DATA_TABLE_ADMIN archetype')

  const log = []
  await applyResponsiveEngine(root, 'mobile', log)

  assert.strictEqual(root.width, 390)
  assert.ok(root.height <= 1200, `Data table height must be compact (<= 1200px), got ${root.height}px`)
})

// ----------------------------------------------------
// TEST 8: Loose Un-grouped Layers (Messy Figma File)
// ----------------------------------------------------
await testCase('Messy Figma File: 25 loose un-grouped layers synthesized into bands', async () => {
  const root = new MockNode('FRAME', 'Messy Loose Layers Frame', 1440, 1800)

  // Background rect
  const bg = new MockNode('RECTANGLE', 'Canvas Background', 1440, 1800)
  bg.x = 0; bg.y = 0
  root.appendChild(bg)

  // Loose Nav (y: 20-60)
  root.appendChild(createText('Logo', 'FastApp', 22, 140, 28, 40, 24))
  root.appendChild(createText('Link1', 'Features', 14, 80, 20, 300, 28))
  root.appendChild(createText('Link2', 'Pricing', 14, 80, 20, 420, 28))
  root.appendChild(createText('Link3', 'Blog', 14, 80, 20, 530, 28))
  root.appendChild(createButton('NavCTA', 'Sign Up', 120, 38, 1280, 20))

  // Loose Hero (y: 120-400)
  root.appendChild(createText('HeroH1', 'Next Gen Design Automation', 48, 700, 110, 80, 140))
  root.appendChild(createText('HeroSub', 'DesignKit transforms complex files in seconds.', 18, 550, 44, 80, 270))
  root.appendChild(createButton('HeroBtn', 'Get Started Free', 160, 46, 80, 330))
  root.appendChild(createImage('HeroIllustration', 450, 320, 880, 120))

  // Loose Cards (y: 520-800)
  for (let i = 0; i < 4; i++) {
    const c = createCard(`Card ${i + 1}`, `Title ${i + 1}`, 'Description text goes here.', 280, 200)
    c.x = 80 + i * 320
    c.y = 540
    root.appendChild(c)
  }

  // Loose Footer (y: 880-1000)
  root.appendChild(createText('FootBrand', 'FastApp Inc.', 16, 200, 22, 80, 900))
  root.appendChild(createText('FootCopy', '© 2026 All rights reserved.', 13, 250, 18, 80, 940))
  root.appendChild(createText('FootLink1', 'Privacy Policy', 13, 140, 18, 800, 900))
  root.appendChild(createText('FootLink2', 'Terms of Service', 13, 140, 18, 960, 900))

  const log = []
  await applyResponsiveEngine(root, 'mobile', log)

  assert.strictEqual(root.width, 390)
  assert.ok(root.height <= 2600, `Synthesized loose page must be compact (<= 2600px), got ${root.height}px`)
})

// ----------------------------------------------------
// TEST 9: Idempotence & Repeat Stability
// ----------------------------------------------------
await testCase('Idempotence: Re-running engine on transformed frame produces consistent height', async () => {
  const root = new MockNode('FRAME', 'Landing Page', 1440, 1200)

  const header = new MockNode('FRAME', 'Header', 1440, 70)
  header.appendChild(createText('Logo', 'Brand', 20, 120, 24, 40, 23))
  header.appendChild(createText('Link', 'About', 14, 80, 20, 300, 25))
  root.appendChild(header)

  const hero = new MockNode('FRAME', 'Hero', 1440, 400)
  hero.x = 0; hero.y = 70
  hero.appendChild(createText('H1', 'Welcome to Platform', 40, 600, 90, 40, 40))
  hero.appendChild(createButton('CTA', 'Join Now', 150, 44, 40, 160))
  root.appendChild(hero)

  const log1 = []
  await applyResponsiveEngine(root, 'mobile', log1)
  const h1 = root.height

  const log2 = []
  await applyResponsiveEngine(root, 'mobile', log2)
  const h2 = root.height

  assert.ok(Math.abs(h1 - h2) <= 5, `Height must be idempotent across runs (Run 1: ${h1}px, Run 2: ${h2}px)`)
})

// ----------------------------------------------------
// TEST 10: Component Instances (Instance Override Safety)
// ----------------------------------------------------
await testCase('Component Instances: Frame containing component instances with relative-transform restrictions', async () => {
  const root = new MockNode('FRAME', 'Dashboard with Instance Sidebar', 1440, 900)

  // Sidebar is an INSTANCE
  const sidebarInstance = new MockNode('INSTANCE', 'Sidebar Instance', 240, 900)
  sidebarInstance._x = 0
  sidebarInstance._y = 0

  // Children inside instance have isLockedInstanceChild = true (throws if modified without detaching)
  const brand = createText('Brand', 'ACME System', 20, 180, 28, 20, 20)
  brand.isLockedInstanceChild = true
  sidebarInstance.appendChild(brand)

  const nav1 = createText('Nav1', 'Dashboard', 14, 180, 20, 20, 70)
  nav1.isLockedInstanceChild = true
  sidebarInstance.appendChild(nav1)

  root.appendChild(sidebarInstance)

  const main = new MockNode('FRAME', 'Main Content', 1200, 900)
  main.x = 240
  main.y = 0
  main.appendChild(createText('Heading', 'Dashboard View', 32, 600, 40, 40, 40))
  root.appendChild(main)

  const log = []
  // This must NOT throw "in set_x: This property cannot be overridden in an instance: relative-transform"
  await applyResponsiveEngine(root, 'mobile', log)

  assert.strictEqual(root.width, 390)
  assert.ok(root.height <= 1200)
})

// ----------------------------------------------------
// TEST 11: Destroyed Instance Sublayers & Table Cells
// ----------------------------------------------------
await testCase('Figma Invalidation Safety: Destroyed instance sublayers & table cells (in get_visible: The node does not exist)', async () => {
  const root = new MockNode('FRAME', 'Dashboard with Stale Sublayers', 1440, 900)

  const sidebar = new MockNode('FRAME', 'Sidebar Nav', 240, 900)
  sidebar.x = 0
  sidebar.y = 0
  sidebar.appendChild(createText('Brand', 'Platform', 20, 180, 28, 20, 20))
  sidebar.appendChild(createText('Link 1', 'Analytics', 14, 180, 20, 20, 70))
  root.appendChild(sidebar)

  const main = new MockNode('FRAME', 'Main Content', 1200, 900)
  main.x = 240
  main.y = 0

  const card = new MockNode('FRAME', 'Metrics Card with Stale Sublayer', 360, 200)
  card.x = 40
  card.y = 40
  const aliveText = createText('Revenue Title', 'Total Sales $48.2K', 18, 300, 24, 20, 20)
  card.appendChild(aliveText)

  // Sublayer with id "I580:5310;580:5289" that was destroyed in Figma C++ document model
  const deadSublayer = new MockNode('RECTANGLE', 'Dead Sublayer', 100, 100)
  deadSublayer.id = 'I580:5310;580:5289'
  deadSublayer._destroyedSublayer = true
  card.appendChild(deadSublayer)

  main.appendChild(card)
  root.appendChild(main)

  const log = []
  // This must NOT throw "in get_visible: The node (instance sublayer or table cell) with id ... does not exist"
  await applyResponsiveEngine(root, 'mobile', log)

  assert.strictEqual(root.width, 390)
  assert.ok(root.height > 0)
})

// ----------------------------------------------------
// TEST 12: Real-World Long Landing Page with True Reflow
// ----------------------------------------------------
await testCase('Real-World Long Landing Page: 2-Col Hero, Multi-Col Features, 4-Col Footer reflow without ghost gaps or overflow', async () => {
  const root = new MockNode('FRAME', 'Landing Page Desktop', 1440, 3600)

  // 1. Header (Desktop 1440x80)
  const header = new MockNode('FRAME', 'Site Header', 1440, 80)
  header.x = 0; header.y = 0
  header.appendChild(createText('Brand Logo', 'AcmeSaaS', 22, 160, 28, 60, 26))
  const navLinks = new MockNode('FRAME', 'Nav Links Container', 480, 30)
  navLinks.x = 360; navLinks.y = 25
  navLinks.appendChild(createText('Nav 1', 'Features', 14, 80, 20, 0, 5))
  navLinks.appendChild(createText('Nav 2', 'Pricing', 14, 80, 20, 100, 5))
  navLinks.appendChild(createText('Nav 3', 'Docs', 14, 80, 20, 200, 5))
  navLinks.appendChild(createText('Nav 4', 'Blog', 14, 80, 20, 300, 5))
  header.appendChild(navLinks)
  header.appendChild(createButton('Header CTA', 'Get Started', 140, 44, 1240, 18))
  root.appendChild(header)

  // 2. Hero Section (Desktop 2-column: Text Left, Illustration Right)
  const hero = new MockNode('FRAME', 'Hero Section', 1440, 620)
  hero.x = 0; hero.y = 80
  const heroLeft = new MockNode('FRAME', 'Hero Text Group', 600, 420)
  heroLeft.x = 80; heroLeft.y = 80
  heroLeft.appendChild(createText('Hero Badge', 'New Feature Available', 12, 180, 24, 0, 0))
  heroLeft.appendChild(createText('Hero Title', 'Scale Your Business With Intelligent Design Tools', 48, 560, 120, 0, 36))
  heroLeft.appendChild(createText('Hero Subtitle', 'Automate repetitive workflows and ship products 10x faster with AI-powered native components.', 18, 520, 60, 0, 180))
  heroLeft.appendChild(createButton('Hero CTA', 'Start Free Trial', 160, 48, 0, 270))
  hero.appendChild(heroLeft)

  const heroImg = createImage('Hero Illustration', 640, 440, 720, 70)
  hero.appendChild(heroImg)

  const decorBlur = new MockNode('ELLIPSE', 'ambient-blur', 120, 120)
  decorBlur.x = 680; decorBlur.y = 50
  hero.appendChild(decorBlur)
  root.appendChild(hero)

  // 3. Features Section (Desktop 3-column cards)
  const features = new MockNode('FRAME', 'Features Grid Section', 1440, 540)
  features.x = 0; features.y = 700
  features.appendChild(createText('Section Heading', 'Engineered for Performance and Scale', 32, 600, 44, 420, 40))

  for (let i = 0; i < 3; i++) {
    const col = new MockNode('FRAME', `Feature Card ${i + 1}`, 380, 280)
    col.x = 80 + i * 450
    col.y = 120
    col.fills = [{ type: 'SOLID', color: { r: 0.96, g: 0.97, b: 0.99 }, visible: true }]
    col.appendChild(createText('Col Title', `Feature Tier ${i + 1}`, 20, 320, 28, 24, 24))
    col.appendChild(createText('Col Desc', 'Comprehensive tooling designed to adapt to your unique engineering workflows seamlessly.', 14, 320, 60, 24, 64))
    col.appendChild(createButton('Col Btn', 'Explore Feature', 140, 38, 24, 150))
    features.appendChild(col)
  }
  root.appendChild(features)

  // 4. Testimonials (Single wide card)
  const testimonial = new MockNode('FRAME', 'Testimonial Section', 1440, 380)
  testimonial.x = 0; testimonial.y = 1240
  const quoteCard = new MockNode('FRAME', 'Quote Container', 1040, 260)
  quoteCard.x = 200; quoteCard.y = 50
  quoteCard.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 }, visible: true }]
  quoteCard.appendChild(createText('Quote Text', '"DesignKit completely transformed how our team adapts complex landing pages to mobile."', 24, 960, 80, 40, 40))
  quoteCard.appendChild(createText('Author', 'Sarah Connor, Head of Product at Cyberdyne', 14, 400, 24, 40, 140))
  testimonial.appendChild(quoteCard)
  root.appendChild(testimonial)

  // 5. 4-Column Footer
  const footer = new MockNode('FRAME', 'Site Footer', 1440, 460)
  footer.x = 0; footer.y = 1620

  const brandCol = new MockNode('FRAME', 'Brand Column', 260, 180)
  brandCol.x = 80; brandCol.y = 60
  brandCol.appendChild(createText('Footer Brand', 'AcmeSaaS Inc.', 20, 200, 28, 0, 0))
  brandCol.appendChild(createText('Brand Tagline', 'The universal design-to-code automation platform.', 14, 220, 44, 0, 40))
  footer.appendChild(brandCol)

  const colNames = ['Product Links', 'Resources Links', 'Company Links']
  for (let c = 0; c < 3; c++) {
    const linkCol = new MockNode('FRAME', colNames[c], 180, 180)
    linkCol.x = 420 + c * 240
    linkCol.y = 60
    linkCol.appendChild(createText('Col Header', colNames[c], 16, 160, 24, 0, 0))
    for (let l = 0; l < 4; l++) {
      linkCol.appendChild(createText(`Link ${l + 1}`, `Page Link ${l + 1}`, 14, 160, 20, 0, 36 + l * 28))
    }
    footer.appendChild(linkCol)
  }

  const divider = new MockNode('RECTANGLE', 'Footer Divider', 1280, 1)
  divider.x = 80; divider.y = 300
  footer.appendChild(divider)

  const copyright = createText('Copyright Text', '© 2026 AcmeSaaS Inc. All rights reserved.', 12, 380, 20, 80, 330)
  footer.appendChild(copyright)

  const legalLinks = createText('Legal Links', 'Privacy Policy · Terms of Service · Cookies', 12, 320, 20, 1040, 330)
  footer.appendChild(legalLinks)
  root.appendChild(footer)

  const log = []
  await applyResponsiveEngine(root, 'mobile', log)

  // --- Assertions ---
  // A. Frame width is mobile 390px
  assert.strictEqual(root.width, 390, 'Root must be resized to 390px')

  // B. Entire document height must be compact (no ghost expansion)
  assert.ok(root.height <= 3200, `Document height must be compact (<= 3200px), got ${root.height}px`)
  assert.ok(root.height >= 1200, `Document height must be realistic (>= 1200px), got ${root.height}px`)

  // C. Footer reflowed compactly
  assert.ok(footer.height <= 950, `Footer must reflow cleanly without massive blank gap (<= 950px), got ${footer.height}px`)

  // D. No elements positioned off-canvas or exceeding mobile bounds
  function assertInViewport(node, maxW) {
    if ('children' in node) {
      for (const c of node.children) {
        if (!c.visible) continue
        const x = c.x
        const r = x + c.width
        assert.ok(x >= 0, `Node "${c.name}" has negative x: ${x}`)
        assert.ok(r <= maxW + 6, `Node "${c.name}" overflows right edge: ${r} > ${maxW + 6} (x=${x}, w=${c.width})`)
        assertInViewport(c, maxW)
      }
    }
  }
  assertInViewport(root, 390)

  // E. Hero illustration must be constrained to mobile width
  assert.ok(heroImg.width <= 350, `Hero image must be scaled to mobile width (<= 350px), got ${heroImg.width}px`)
})

// ----------------------------------------------------
// TEST 13: Real-World E-Commerce Landing Page (Nested Cards, Price/Rating Rows, Overlays, Cart Header)
// ----------------------------------------------------
await testCase('Real-World E-Commerce: Nested Product Cards, Preserved Rows, Overlays & Cart Header', async () => {
  const root = new MockNode('FRAME', 'Pelican E-Commerce Store', 1440, 2000)

  // Header with Logo, Nav links, Search, and Cart
  const header = new MockNode('FRAME', 'Header Nav', 1440, 72)
  header.appendChild(createText('Brand Logo', 'PELICAN GEAR', 24, 180, 28, 40, 22))
  header.appendChild(createText('Nav 1', 'Drinkware', 15, 80, 20, 260, 26))
  header.appendChild(createText('Nav 2', 'Coolers', 15, 70, 20, 360, 26))
  header.appendChild(createText('Search', '🔍 Search', 14, 80, 20, 1180, 26))
  header.appendChild(createText('Cart Action', '🛒 Cart (3)', 15, 90, 20, 1280, 26))
  root.appendChild(header)

  // Hero with Dual Buttons + Product Showcase Mockup
  const hero = new MockNode('FRAME', 'Hero Section', 1440, 520)
  hero.x = 0; hero.y = 72
  hero.appendChild(createText('Hero Title', 'Drinkware & Ice Cooler for every occasion', 54, 600, 64, 40, 60))
  hero.appendChild(createText('Hero Subhead', 'Premium custom corporate drinkware built for extreme durability.', 18, 540, 28, 40, 210))
  const btnRow = new MockNode('FRAME', 'CTA Button Row', 340, 50)
  btnRow.x = 40; btnRow.y = 280
  btnRow.appendChild(createButton('Btn1', 'Shop Bottles', 160, 48, 0, 0))
  btnRow.appendChild(createButton('Btn2', 'Shop Tumblers', 160, 48, 180, 0))
  hero.appendChild(btnRow)

  // Visual Product Mockup on right
  const mockup = new MockNode('FRAME', 'Hero Product Showcase Mockup', 550, 420)
  mockup.x = 800; mockup.y = 50
  mockup.appendChild(createImage('Bottle Render', 400, 380, 50, 20))
  mockup.appendChild(createButton('Badge', 'NEW 2026', 90, 28, 60, 40))
  hero.appendChild(mockup)
  root.appendChild(hero)

  // 4-Column Product Grid (Nested Cards)
  const gridSection = new MockNode('FRAME', 'Featured Products Grid', 1440, 800)
  gridSection.x = 0; gridSection.y = 600
  gridSection.appendChild(createText('Grid Title', 'Best Selling Tumblers', 32, 400, 40, 40, 20))

  const testProducts = [
    { title: '26oz Pacific Tumbler', sale: '$34.00', orig: '$45.00' },
    { title: '40oz Porter Dual Lid', sale: '$42.00', orig: '$55.00' },
    { title: '18oz Ridge Travel Mug', sale: '$28.00', orig: '$38.00' },
    { title: '32oz Expedition Flask', sale: '$39.00', orig: '$49.00' },
  ]

  testProducts.forEach((p, idx) => {
    const card = new MockNode('FRAME', `Product Card ${idx + 1}`, 310, 440)
    card.x = 40 + idx * 340
    card.y = 80
    card.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: true }]

    // Image container with discount tag & heart overlays
    const imgContainer = new MockNode('FRAME', 'Image Container', 310, 260)
    imgContainer.x = 0; imgContainer.y = 0
    imgContainer.appendChild(createImage('Tumbler Photo', 310, 260, 0, 0))
    imgContainer.appendChild(createButton('Discount Tag', '-25%', 54, 24, 10, 10))
    imgContainer.appendChild(createButton('Heart Icon', '♥', 32, 32, 268, 10))
    card.appendChild(imgContainer)

    // Details container
    const details = new MockNode('FRAME', 'Product Details', 290, 160)
    details.x = 10; details.y = 270
    details.appendChild(createText('Title', p.title, 16, 280, 22, 0, 0))

    // Rating row (stars + review count side-by-side)
    const ratingRow = new MockNode('FRAME', 'Rating Row', 180, 22)
    ratingRow.x = 0; ratingRow.y = 30
    ratingRow.appendChild(createText('Stars', '★★★★★', 14, 75, 18, 0, 0))
    ratingRow.appendChild(createText('Count', '4.9 (128)', 13, 65, 18, 80, 0))
    details.appendChild(ratingRow)

    // Price row (sale price + orig price side-by-side)
    const priceRow = new MockNode('FRAME', 'Price Row', 180, 26)
    priceRow.x = 0; priceRow.y = 60
    priceRow.appendChild(createText('Sale Price', p.sale, 18, 70, 24, 0, 0))
    priceRow.appendChild(createText('Orig Price', p.orig, 14, 60, 20, 78, 2))
    details.appendChild(priceRow)

    details.appendChild(createButton('Add to Cart', 'Add to Cart', 280, 38, 0, 100))
    card.appendChild(details)

    gridSection.appendChild(card)
  })

  root.appendChild(gridSection)

  const log = []
  await applyResponsiveEngine(root, 'mobile', log)

  // 1. Frame converted to mobile 390px
  assert.strictEqual(root.width, 390, 'Root frame must be 390px wide')

  // 2. Archetype detection
  const detectedArchetype = detectScreenArchetype(root, 1440, 2000)
  assert.strictEqual(detectedArchetype, 'E_COMMERCE', 'Must detect E_COMMERCE archetype')

  // 3. Grid cards reflow into 2 columns on mobile
  const liveGrid = root.children.find(c => c.name === 'Featured Products Grid')
  assert.ok(liveGrid, 'Grid section must exist')
  const cardsInGrid = liveGrid.children.filter(c => c.name && c.name.startsWith('Product Card'))
  assert.strictEqual(cardsInGrid.length, 4, 'Must contain all 4 product cards')

  // Card 1 and Card 2 should be in row 1 side-by-side (2-column layout!)
  assert.ok(cardsInGrid[0].x < cardsInGrid[1].x, 'Card 1 and Card 2 must be side-by-side in 2-col grid')
  assert.strictEqual(cardsInGrid[0].y, cardsInGrid[1].y, 'Card 1 and Card 2 must share same row Y')
  assert.ok(cardsInGrid[0].width <= 180, `Card width in 2-col grid must be ~169px, got ${cardsInGrid[0].width}px`)

  // 4. Compact card height: card must NOT balloon to 700px tall
  assert.ok(cardsInGrid[0].height <= 480, `Card height must be compact (<= 480px), got ${cardsInGrid[0].height}px`)

  // 5. Hero mockup scaled down proportionally (<= 350px width)
  const heroMockup = hero.children.find(c => c.name.includes('Mockup') || c.name.includes('Showcase'))
  if (heroMockup) {
    assert.ok(heroMockup.width <= 350, `Hero mockup must fit within mobile width, got ${heroMockup.width}px`)
  }
})

// ----------------------------------------------------
// TEST 14: Full 13-Section Landing Page (No Swallowed Sections, Single Mobile Frame)
// ----------------------------------------------------
await testCase('Full Landing Page: All 13 sections retained in main frame without consumption into nav', async () => {
  const root = new MockNode('FRAME', 'Landing Page Full Desktop', 1440, 5200)

  // 1. Top Announcement Bar (1440x36)
  const promoBar = new MockNode('FRAME', 'Announcement Bar', 1440, 36)
  promoBar.x = 0; promoBar.y = 0
  promoBar.appendChild(createText('Promo Text', 'Need rush production? Ask our factory direct hotline', 12, 400, 20, 520, 8))
  root.appendChild(promoBar)

  // 2. Site Header (1440x80)
  const header = new MockNode('FRAME', 'Main Site Header', 1440, 80)
  header.x = 0; header.y = 36
  header.appendChild(createText('Brand Logo', 'POSH XCCESSORIES', 22, 180, 28, 40, 26))
  const searchBar = new MockNode('FRAME', 'Search Bar Input', 400, 40)
  searchBar.x = 420; searchBar.y = 20
  header.appendChild(searchBar)
  const cartBtn = createText('Shopping Cart', '🛒 Cart (0)', 14, 90, 24, 1310, 28)
  header.appendChild(cartBtn)
  root.appendChild(header)

  // 3. Category Links Bar (1440x44)
  const catBar = new MockNode('FRAME', 'Category Links Bar', 1440, 44)
  catBar.x = 0; catBar.y = 116
  const catNames = ['All Categories', 'Featured Picks', 'Drinkware', 'Journals & Portfolios', 'Tech Gear', 'Writing', 'Closeouts', 'E-Flyer']
  for (let c = 0; c < catNames.length; c++) {
    catBar.appendChild(createText(`Cat Link ${c + 1}`, catNames[c], 13, 110, 20, 40 + c * 130, 12))
  }
  root.appendChild(catBar)

  // 4. Hero Section (1440x550)
  const hero = new MockNode('FRAME', 'Hero Section', 1440, 550)
  hero.x = 0; hero.y = 160
  const heroText = new MockNode('FRAME', 'Hero Content', 560, 380)
  heroText.x = 60; heroText.y = 60
  heroText.appendChild(createText('Hero Badge', 'PREMIUM IMPRINT COLLECTION', 11, 200, 20, 0, 0))
  heroText.appendChild(createText('Hero Title', 'Journals that carry your brand.', 44, 520, 100, 0, 30))
  heroText.appendChild(createText('Hero Subtitle', 'Soft-touch covers in rich contemporary tones.', 16, 480, 50, 0, 140))
  heroText.appendChild(createButton('Hero CTA', 'Shop Journal Collection', 180, 44, 0, 210))
  hero.appendChild(heroText)
  const heroImg = createImage('Hero Main Mockup', 640, 420, 720, 60)
  hero.appendChild(heroImg)
  root.appendChild(hero)

  // 5. Mini Categories (1440x260)
  const miniCats = new MockNode('FRAME', 'Mini Categories Row', 1440, 260)
  miniCats.x = 0; miniCats.y = 710
  for (let m = 0; m < 3; m++) {
    const mini = createCard(`Mini Card ${m + 1}`, `Category ${m + 1}`, 'Explore products', 380, 200, 60 + m * 440, 30)
    miniCats.appendChild(mini)
  }
  root.appendChild(miniCats)

  // 6. Trust Badges (1440x120)
  const badges = new MockNode('FRAME', 'Trust Badges Banner', 1440, 120)
  badges.x = 0; badges.y = 970
  for (let b = 0; b < 4; b++) {
    const badge = new MockNode('FRAME', `Badge ${b + 1}`, 280, 70)
    badge.x = 60 + b * 320; badge.y = 25
    badge.appendChild(createText(`Badge Title ${b + 1}`, `Trust Badge ${b + 1}`, 14, 200, 24, 40, 10))
    badges.appendChild(badge)
  }
  root.appendChild(badges)

  // 7. Featured Products Grid (1440x560)
  const featured = new MockNode('FRAME', 'Featured Products Section', 1440, 560)
  featured.x = 0; featured.y = 1090
  featured.appendChild(createText('Featured Heading', 'Featured Products', 28, 400, 36, 60, 20))
  for (let p = 0; p < 4; p++) {
    const pCard = new MockNode('FRAME', `Product Card ${p + 1}`, 280, 420)
    pCard.x = 60 + p * 320; pCard.y = 80
    pCard.appendChild(createImage('PImg', 260, 220, 10, 10))
    pCard.appendChild(createText('PTitle', `Pro Series Item ${p + 1}`, 16, 240, 22, 10, 240))
    pCard.appendChild(createText('PPrice', '$8.85 to $11.00', 14, 200, 20, 10, 270))
    pCard.appendChild(createButton('PBtn', 'Add to Quote', 260, 36, 10, 310))
    featured.appendChild(pCard)
  }
  root.appendChild(featured)

  // 8. Shop by Industry (1440x540)
  const industry = new MockNode('FRAME', 'Shop by Industry [PROPOSED]', 1440, 540)
  industry.x = 0; industry.y = 1650
  industry.appendChild(createText('Ind Heading', 'Shop by Industry', 28, 400, 36, 60, 20))
  for (let ind = 0; ind < 4; ind++) {
    const indCard = createCard(`Ind Card ${ind + 1}`, `Industry ${ind + 1}`, 'Curated pairings', 280, 200, 60 + ind * 320, 80)
    industry.appendChild(indCard)
  }
  root.appendChild(industry)

  // 9. Explore All 18 Categories (1440x440)
  const categoriesSec = new MockNode('FRAME', 'Explore All 18 Categories', 1440, 440)
  categoriesSec.x = 0; categoriesSec.y = 2190
  categoriesSec.appendChild(createText('Cat Heading', 'Explore All 18 Categories', 28, 400, 36, 60, 20))
  for (let c = 0; c < 4; c++) {
    const cCard = createCard(`Cat Item ${c + 1}`, `Category ${c + 1}`, 'Select category', 280, 180, 60 + c * 320, 80)
    categoriesSec.appendChild(cCard)
  }
  root.appendChild(categoriesSec)

  // 10. Promotional Collections (1440x460)
  const collectionsSec = new MockNode('FRAME', 'Promotional Collections', 1440, 460)
  collectionsSec.x = 0; collectionsSec.y = 2630
  collectionsSec.appendChild(createText('Col Heading', 'Promotional Collections', 28, 400, 36, 60, 20))
  for (let col = 0; col < 2; col++) {
    const colCard = createCard(`Col Card ${col + 1}`, `Collection ${col + 1}`, 'Curated kits', 600, 280, 60 + col * 660, 80)
    collectionsSec.appendChild(colCard)
  }
  root.appendChild(collectionsSec)

  // 11. Distributors Custom Pricing Matrix (1440x260)
  const pricingSec = new MockNode('FRAME', 'Distributors: Access Your Custom Pricing Matrix', 1440, 260)
  pricingSec.x = 0; pricingSec.y = 3090
  pricingSec.appendChild(createText('Pricing Title', 'Distributors: Access Your Custom Pricing Matrix', 26, 600, 36, 80, 40))
  pricingSec.appendChild(createButton('Pricing CTA', 'Distributor Login', 160, 44, 80, 120))
  root.appendChild(pricingSec)

  // 12. Promotions & Factory Closeout Alerts (1440x200)
  const alertsSec = new MockNode('FRAME', 'Promotions & Factory Closeout Alerts', 1440, 200)
  alertsSec.x = 0; alertsSec.y = 3350
  alertsSec.appendChild(createText('Alerts Title', 'Promotions & Factory Closeout Alerts', 22, 500, 30, 80, 30))
  alertsSec.appendChild(createButton('Subscribe Btn', 'Subscribe', 140, 40, 1100, 30))
  root.appendChild(alertsSec)

  // 13. Footer Section (1440x450)
  const footer = new MockNode('FRAME', 'Site Footer', 1440, 450)
  footer.x = 0; footer.y = 3550
  footer.appendChild(createText('Footer Info', 'POSH XCCESSORIES, Inc.', 18, 300, 24, 60, 40))
  footer.appendChild(createText('Footer Copyright', '© 2026 POSH XCCESSORIES. All rights reserved.', 12, 400, 20, 60, 380))
  root.appendChild(footer)

  // Execute engine
  const log = []
  await applyResponsiveEngine(root, 'mobile', log)

  // Assertions
  assert.strictEqual(root.width, 390, 'Root must be resized to 390px')
  assert.strictEqual(root.children.length, 13, `All 13 sections must remain in the mobile layout frame (0 sections deleted), got ${root.children.length}`)

  // Verify Header reflowed cleanly
  assert.strictEqual(header.width, 390, 'Header must be 390px')
  assert.ok(header.height <= 60, `Header height must be compact (<= 60px), got ${header.height}px`)
  const hamburger = header.children.find(c => c.name === 'Mobile Menu Icon')
  assert.ok(hamburger, 'Header must contain mobile menu icon')

  // Verify Total Page Height accommodates all 13 sections
  assert.ok(root.height >= 4000, `Mobile page height must accommodate all 13 sections (>= 4000px), got ${root.height}px`)

  // Verify sequential non-overlapping Y positioning and top-to-bottom order
  assert.strictEqual(root.children[0].name, 'Announcement Bar', 'First section must be Announcement Bar')
  assert.strictEqual(root.children[1].name, 'Main Site Header', 'Second section must be Main Site Header')
  assert.strictEqual(root.children[root.children.length - 1].name, 'Site Footer', 'Last section must be Site Footer')
  assert.strictEqual(root.children[0].y, 0, 'Announcement Bar must start at y = 0')
  assert.ok(root.children[root.children.length - 1].y >= 3000, 'Footer must be at the bottom (y >= 3000)')

  for (let i = 0; i < root.children.length - 1; i++) {
    const curr = root.children[i]
    const next = root.children[i + 1]
    assert.ok(next.y >= curr.y + curr.height - 2, `Section "${next.name}" (y=${next.y}) must be below "${curr.name}" (bottom=${curr.y + curr.height})`)
  }
})

await testCase('Auto Layout Landing Page: Vertical AL root retains exact natural order & no text squashing', async () => {
  const root = new MockNode('FRAME', 'Auto Layout E-Commerce Storefront', 1440, 4800)
  root.layoutMode = 'VERTICAL'
  root.paddingTop = 0
  root.itemSpacing = 20

  const topBar = new MockNode('FRAME', 'Promo Bar', 1440, 40)
  topBar.appendChild(createText('Top Promo', 'Limited time factory discount', 12, 300, 20, 0, 0))
  root.appendChild(topBar)

  const header = new MockNode('FRAME', 'Header Nav', 1440, 70)
  header.appendChild(createText('Brand', 'STORE BRAND', 20, 160, 24, 20, 20))
  root.appendChild(header)

  const multiColSec = new MockNode('FRAME', 'Shop by Industry', 1440, 500)
  // 4 column titles side-by-side on desktop
  const colTitles = ['Corporate Gifting', 'Higher Education', 'Healthcare Networks', 'Financial Services']
  for (let c = 0; c < colTitles.length; c++) {
    const colTitle = createText(`ColTitle ${c + 1}`, colTitles[c], 18, 180, 24, 60 + c * 320, 40)
    multiColSec.appendChild(colTitle)
  }
  root.appendChild(multiColSec)

  const footer = new MockNode('FRAME', 'Footer Section', 1440, 400)
  footer.appendChild(createText('Foot Copy', '© 2026 Store Brand. All rights reserved.', 12, 350, 20, 40, 340))
  root.appendChild(footer)

  const log = []
  await applyResponsiveEngine(root, 'mobile', log)

  assert.strictEqual(root.width, 390, 'Root must be resized to 390px')
  assert.strictEqual(root.children.length, 4, 'All 4 sections must remain in the frame')
  assert.strictEqual(root.children[0].name, 'Promo Bar', 'First section must be Promo Bar at y=0')
  assert.strictEqual(root.children[0].y, 0, 'Promo Bar y must be 0')
  assert.strictEqual(root.children[root.children.length - 1].name, 'Footer Section', 'Last section must be Footer Section')
  assert.ok(root.children[root.children.length - 1].y > 200, 'Footer must be below earlier sections')

  // Verify that multi-column titles were not squashed into 10-15px side-by-side slices
  for (const c of multiColSec.children) {
    if (c.type === 'TEXT') {
      assert.ok(c.width >= 100, `Text node "${c.name}" must not be crushed into a narrow width (< 100px), got ${c.width}px`)
    }
  }
})

await testCase('Text Auto-Width & Multi-Card Horizontal AL Flipping to Vertical', async () => {
  const root = new MockNode('FRAME', 'Storefront Section Test', 1440, 2000)

  // 1. Horizontal AL frame containing 3 category cards (Drinkware, Portfolios, Tech)
  const miniCats = new MockNode('FRAME', 'Mini Categories AL Row', 1440, 240)
  miniCats.layoutMode = 'HORIZONTAL'
  miniCats.itemSpacing = 20
  miniCats.paddingLeft = 40
  miniCats.paddingRight = 40

  const catNames = ['Drinkware', 'Portfolios', 'Power & Mobile']
  for (let m = 0; m < 3; m++) {
    const card = new MockNode('FRAME', `Category Card ${m + 1}`, 420, 200)
    const title = createText(`CardTitle ${m + 1}`, catNames[m], 18, 120, 24, 20, 20)
    const pill = createText(`CardPill ${m + 1}`, 'Shop Category', 13, 100, 20, 20, 150)
    card.appendChild(title)
    card.appendChild(pill)
    miniCats.appendChild(card)
  }
  root.appendChild(miniCats)

  // 2. Loose background shape for a footer content frame
  const footerContent = new MockNode('FRAME', 'Footer Content Frame', 1440, 400)
  footerContent.x = 0; footerContent.y = 800
  footerContent.appendChild(createText('Foot Brand', 'BRAND NAME', 20, 200, 24, 40, 40))
  footerContent.appendChild(createText('Foot Copy', '© 2026 Brand. All rights reserved.', 12, 350, 20, 40, 320))

  const footerBg = new MockNode('RECTANGLE', 'Footer Dark Background', 1440, 400)
  footerBg.x = 0; footerBg.y = 800
  footerBg.fills = [{ type: 'SOLID', color: { r: 0.05, g: 0.08, b: 0.15 } }]

  root.appendChild(footerBg)
  root.appendChild(footerContent)

  const log = []
  await applyResponsiveEngine(root, 'mobile', log)

  // 1. Verify Horizontal AL row of 3 cards flipped to VERTICAL on mobile
  assert.strictEqual(miniCats.layoutMode, 'VERTICAL', 'Mini categories AL frame with 3 cards must flip to VERTICAL on mobile')
  assert.strictEqual(miniCats.children.length, 3, 'All 3 cards must remain')
  for (const card of miniCats.children) {
    assert.strictEqual(card.width, 390 - (miniCats.paddingLeft + miniCats.paddingRight), 'Each card must span full mobile width')
    // Verify text inside card took WIDTH_AND_HEIGHT (Auto Width) for short labels
    const title = card.children.find(c => c.name.startsWith('CardTitle'))
    assert.ok(title, 'Card title exists')
    assert.strictEqual(title.textAutoResize, 'WIDTH_AND_HEIGHT', 'Short card title must have Auto Width (WIDTH_AND_HEIGHT)')
  }

  // 2. Verify loose background rectangle was absorbed into footer content frame
  assert.strictEqual(root.children.filter(c => c.name === 'Footer Dark Background').length, 0, 'Loose background rectangle must be absorbed, not left as top-level section')
  assert.ok(footerContent.children.some(c => c.name === 'Footer Dark Background') || footerContent.fills.length > 0, 'Footer content frame must now have the background')
})

await testCase('Corner Radius Pill Distortion Guard & Auto-Width on Badges/Buttons', async () => {
  const root = new MockNode('FRAME', 'Pricing & Tag Section Test', 1440, 1000)

  // Section with dark container card containing pill CTA buttons
  const darkSection = new MockNode('FRAME', 'Distributors: Access Your Custom Pricing Matrix', 1440, 300)
  darkSection.fills = [{ type: 'SOLID', color: { r: 0.05, g: 0.10, b: 0.20 } }]
  darkSection.cornerRadius = 16

  const title = createText('Pricing Title', 'Distributors: Access Your Custom Pricing Matrix', 24, 600, 32, 60, 40)
  const sub = createText('Pricing Sub', 'Unlock negotiated contract tiers and save quotes.', 14, 500, 24, 60, 80)

  // Pill CTA with cornerRadius = 9999
  const pillBtn = createButton('Distributor Login Btn', 'Distributor Login', 180, 44, 60, 130)
  pillBtn.cornerRadius = 9999
  pillBtn.layoutMode = 'HORIZONTAL'

  // Pill badge with cornerRadius = 9999
  const badge = new MockNode('FRAME', 'PROPOSED Badge', 100, 28)
  badge.cornerRadius = 9999
  badge.layoutMode = 'HORIZONTAL'
  const badgeTxt = createText('Badge Txt', 'PROPOSED', 11, 80, 16, 10, 6)
  badge.appendChild(badgeTxt)

  darkSection.appendChild(title)
  darkSection.appendChild(sub)
  darkSection.appendChild(pillBtn)
  darkSection.appendChild(badge)
  root.appendChild(darkSection)

  const log = []
  await applyResponsiveEngine(root, 'mobile', log)

  // 1. Verify dark container card did NOT absorb the button's 9999 pill radius (must be <= 24px)
  assert.ok(darkSection.cornerRadius <= 24, `Container card corner radius must not be deformed into a giant pill (<= 24px), got ${darkSection.cornerRadius}px`)

  // 2. Verify button label and badge text retained Auto Width (WIDTH_AND_HEIGHT)
  const btnTxt = pillBtn.children.find(c => c.type === 'TEXT')
  assert.ok(btnTxt, 'Button text exists')
  assert.strictEqual(btnTxt.textAutoResize, 'WIDTH_AND_HEIGHT', 'Button text must take Auto Width (WIDTH_AND_HEIGHT)')
  assert.strictEqual(badgeTxt.textAutoResize, 'WIDTH_AND_HEIGHT', 'Badge text must take Auto Width (WIDTH_AND_HEIGHT)')

  // 3. Verify badge frame took HUG horizontal sizing
  assert.strictEqual(badge.layoutSizingHorizontal, 'HUG', 'Badge frame must have Hug horizontal sizing (HUG)')
  assert.ok(badge.width <= 140, `Badge width must hug its content (<= 140px), got ${badge.width}px`)
})

console.log(`\n========================================`)
console.log(`Suite Complete: ${passed} Passed, ${failed} Failed`)
console.log(`========================================\n`)

if (failed > 0) {
  process.exit(1)
}
