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

console.log(`\n========================================`)
console.log(`Suite Complete: ${passed} Passed, ${failed} Failed`)
console.log(`========================================\n`)

if (failed > 0) {
  process.exit(1)
}
