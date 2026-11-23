// ============================================================
// scripts/test_rlm.mjs
// Test Suite for Responsive Layout Model (RLM)
// Validates:
// 1. Manually positioned designs
// 2. Mixed Auto Layout (nested horizontal & vertical)
// 3. Nested component instances (preservation)
// 4. E-commerce product grids (4-col -> 2-col/1-col)
// 5. Dashboards with metrics
// 6. Text squashing prevention
// 7. Corner radius clamping
// ============================================================

import assert from 'assert'

class MockNode {
  constructor(type, name, w = 100, h = 100) {
    this.id = 'node_' + Math.random().toString(36).substring(2, 9)
    this.type = type
    this.name = name
    this.width = Math.round(w)
    this.height = Math.round(h)
    this.x = 0
    this.y = 0
    this.visible = true
    this.locked = false
    this.children = []
    this.parent = null
    this.layoutMode = 'NONE'
    this.layoutWrap = 'NO_WRAP'
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
    this.cornerRadius = 0
    this.topLeftRadius = 0
    this.topRightRadius = 0
    this.bottomLeftRadius = 0
    this.bottomRightRadius = 0
    this.layoutPositioning = 'AUTO'
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

  getRangeFontName() {
    return this.fontName
  }

  clone() {
    const copy = new MockNode(this.type, this.name, this.width, this.height)
    copy.x = this.x
    copy.y = this.y
    copy.visible = this.visible
    copy.layoutMode = this.layoutMode
    copy.layoutWrap = this.layoutWrap
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
    copy.fills = JSON.parse(JSON.stringify(this.fills || []))
    copy.strokes = JSON.parse(JSON.stringify(this.strokes || []))
    copy.cornerRadius = this.cornerRadius
    copy.layoutPositioning = this.layoutPositioning
    for (const child of this.children) {
      copy.appendChild(child.clone())
    }
    return copy
  }
}

globalThis.figma = {
  createFrame: () => new MockNode('FRAME', 'Frame', 100, 100),
  createText: () => new MockNode('TEXT', 'Text', 100, 20),
  createRectangle: () => new MockNode('RECTANGLE', 'Rectangle', 100, 100),
  loadFontAsync: async () => true,
}

const {
  convertWithRLM,
  parseSceneNodeToRLM,
  classifyRLMTree,
  planResponsiveLayout,
  validateRLMPlan,
} = await import('../src/plugin/figma/rlm/index.ts')

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    process.stdout.write(`• ${name}... `)
    await fn()
    console.log(`✅ PASS`)
    passed++
  } catch (err) {
    console.log(`❌ FAIL`)
    console.error(err)
    failed++
  }
}

// ---------------------------------------------------------------------
// TEST 1: Manually Positioned Designs with Loose Layers
// ---------------------------------------------------------------------
await test('Manually Positioned Design: Parses & Generates Mobile Auto Layout', async () => {
  const root = new MockNode('FRAME', 'Desktop Canvas', 1440, 900)
  root.layoutMode = 'NONE'

  // Top Announcement Bar
  const banner = new MockNode('FRAME', 'Announcement Bar', 1440, 40)
  banner.x = 0; banner.y = 0
  banner.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 }, visible: true }]
  const bannerTxt = new MockNode('TEXT', 'Banner Copy', 400, 20)
  bannerTxt.characters = 'Free Shipping on orders over $50'
  banner.appendChild(bannerTxt)
  root.appendChild(banner)

  // Header Nav
  const nav = new MockNode('FRAME', 'Site Header Nav', 1440, 80)
  nav.x = 0; nav.y = 40
  const logo = new MockNode('TEXT', 'Brand Logo', 120, 30)
  logo.characters = 'ACME BRAND'
  const navItem1 = new MockNode('TEXT', 'Nav Link 1', 60, 20)
  navItem1.characters = 'Shop'
  const navItem2 = new MockNode('TEXT', 'Nav Link 2', 60, 20)
  navItem2.characters = 'About'
  nav.appendChild(logo)
  nav.appendChild(navItem1)
  nav.appendChild(navItem2)
  root.appendChild(nav)

  const log = []
  const audit = await convertWithRLM(root, 'mobile', log)

  assert.strictEqual(root.layoutMode, 'VERTICAL', 'Root must be converted to native VERTICAL Auto Layout')
  assert.strictEqual(root.width, 390, 'Root width must be 390px')
  assert.ok(audit.healthScore >= 90, `Health score should be >= 90, got ${audit.healthScore}`)
})

// ---------------------------------------------------------------------
// TEST 2: Mixed Auto Layout (Nested Horizontal & Vertical)
// ---------------------------------------------------------------------
await test('Mixed Auto Layout: Correctly preserves nested structure', async () => {
  const root = new MockNode('FRAME', 'Mixed AL Page', 1440, 1200)

  // Section with horizontal layout mode
  const tagSection = new MockNode('FRAME', 'Tag Cloud Section', 1440, 100)
  tagSection.layoutMode = 'HORIZONTAL'

  const tags = ['Tote Bags', 'Drinkware', 'Stylus Pens', 'Business Cards', 'Apparel']
  for (const t of tags) {
    const pill = new MockNode('FRAME', `${t} Pill`, 110, 32)
    pill.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 }, visible: true }]
    pill.cornerRadius = 9999
    const txt = new MockNode('TEXT', 'Tag Text', 80, 16)
    txt.characters = t
    pill.appendChild(txt)
    tagSection.appendChild(pill)
  }
  root.appendChild(tagSection)

  const log = []
  await convertWithRLM(root, 'mobile', log)

  assert.strictEqual(tagSection.layoutWrap, 'WRAP', 'Tag cloud section must enable Auto Layout WRAP on mobile')
  assert.strictEqual(tagSection.layoutSizingHorizontal, 'FILL', 'Tag section must FILL mobile width')
  for (const pill of tagSection.children) {
    assert.strictEqual(pill.layoutSizingHorizontal, 'HUG', 'Pills must HUG contents')
    const t = pill.children[0]
    assert.strictEqual(t.textAutoResize, 'WIDTH_AND_HEIGHT', 'Pill text must take WIDTH_AND_HEIGHT')
  }
})

// ---------------------------------------------------------------------
// TEST 3: Nested Component Instances Preservation
// ---------------------------------------------------------------------
await test('Nested Component Instances: Preserved as live instances', async () => {
  const root = new MockNode('FRAME', 'Instance Test Page', 1440, 800)

  const section = new MockNode('FRAME', 'Features Area', 1440, 400)
  const buttonInstance = new MockNode('INSTANCE', 'Primary CTA Button', 160, 44)
  buttonInstance.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.9 }, visible: true }]
  const btnTxt = new MockNode('TEXT', 'Button Text', 120, 20)
  btnTxt.characters = 'Get Started'
  buttonInstance.appendChild(btnTxt)
  section.appendChild(buttonInstance)
  root.appendChild(section)

  const log = []
  await convertWithRLM(root, 'mobile', log)

  assert.strictEqual(buttonInstance.type, 'INSTANCE', 'Button instance must remain an INSTANCE, not unconditionally detached')
})

// ---------------------------------------------------------------------
// TEST 4: E-Commerce Product Grid (Multi-Column Reflow & No Text Squashing)
// ---------------------------------------------------------------------
await test('E-Commerce Product Grid: 4 columns -> 2 columns without text squashing', async () => {
  const root = new MockNode('FRAME', 'Shop Page', 1440, 1000)

  const grid = new MockNode('FRAME', 'Featured Products Grid', 1400, 500)
  grid.x = 20; grid.y = 100

  // 4 Product Cards
  for (let i = 0; i < 4; i++) {
    const card = new MockNode('FRAME', `Product Card ${i + 1}`, 320, 420)
    card.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: true }]
    card.cornerRadius = 12

    const img = new MockNode('RECTANGLE', 'Product Image', 320, 240)
    img.fills = [{ type: 'IMAGE', visible: true }]

    const title = new MockNode('TEXT', 'Product Title', 280, 24)
    title.characters = `Elite Leather RFID Card Holder Deluxe Edition ${i + 1}`
    title.fontSize = 16

    const price = new MockNode('TEXT', 'Product Price', 100, 20)
    price.characters = '$8.95 to $11.00'
    price.fontSize = 14

    card.appendChild(img)
    card.appendChild(title)
    card.appendChild(price)
    grid.appendChild(card)
  }
  root.appendChild(grid)

  const log = []
  const audit = await convertWithRLM(root, 'mobile', log)

  assert.strictEqual(audit.textSquashCount, 0, 'Must have zero text squashing')
  assert.ok(audit.healthScore >= 95, `Health score should be >= 95, got ${audit.healthScore}`)
})

// ---------------------------------------------------------------------
// TEST 5: Corner Radius Pill Distortion Guard
// ---------------------------------------------------------------------
await test('Corner Radius Pill Distortion Guard: Clamps container radii <= 24px', async () => {
  const root = new MockNode('FRAME', 'Pricing Section', 1440, 600)

  const containerCard = new MockNode('FRAME', 'Custom Pricing Matrix Card', 1200, 400)
  containerCard.fills = [{ type: 'SOLID', color: { r: 0.05, g: 0.1, b: 0.2 }, visible: true }]
  containerCard.cornerRadius = 9999 // Bad desktop value

  const title = new MockNode('TEXT', 'Card Title', 400, 30)
  title.characters = 'Access Your Pricing Matrix'
  containerCard.appendChild(title)
  root.appendChild(containerCard)

  const log = []
  await convertWithRLM(root, 'mobile', log)

  assert.ok(containerCard.cornerRadius <= 24, `Container card corner radius must be clamped to <= 24px, got ${containerCard.cornerRadius}px`)
})

// ---------------------------------------------------------------------
// TEST 6: SaaS Dashboard with Metrics
// ---------------------------------------------------------------------
await test('SaaS Dashboard: Converts metric cards to mobile layout with high health', async () => {
  const root = new MockNode('FRAME', 'Analytics Dashboard', 1440, 1000)

  const metricsSection = new MockNode('FRAME', 'Metrics Grid', 1400, 220)
  const metricData = [
    { name: 'MRR', val: '$45,200', change: '+12%' },
    { name: 'ARR', val: '$542,400', change: '+18%' },
    { name: 'Active Users', val: '12,450', change: '+5%' },
    { name: 'Churn Rate', val: '1.2%', change: '-0.3%' },
  ]

  for (const m of metricData) {
    const card = new MockNode('FRAME', `Metric Card ${m.name}`, 320, 180)
    card.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: true }]
    card.cornerRadius = 8
    const label = new MockNode('TEXT', 'Label', 200, 20)
    label.characters = m.name
    label.fontSize = 14
    const value = new MockNode('TEXT', 'Value', 200, 32)
    value.characters = m.val
    value.fontSize = 24
    card.appendChild(label)
    card.appendChild(value)
    metricsSection.appendChild(card)
  }
  root.appendChild(metricsSection)

  const log = []
  const audit = await convertWithRLM(root, 'mobile', log)

  assert.strictEqual(audit.textSquashCount, 0, 'No text squashing in metric cards')
  assert.ok(audit.healthScore >= 90, `Health score should be >= 90, got ${audit.healthScore}`)
})

// ---------------------------------------------------------------------
// TEST 7: Absolute Decorative Elements (Native AL Absolute Positioning)
// ---------------------------------------------------------------------
await test('Absolute Decorative Elements: Positioned using native AL ABSOLUTE', async () => {
  const root = new MockNode('FRAME', 'Hero With Accents', 1440, 600)
  const hero = new MockNode('FRAME', 'Hero Section', 1440, 500)

  const title = new MockNode('TEXT', 'Hero Title', 600, 48)
  title.characters = 'Next Generation Design Toolkit'

  const decorGlow = new MockNode('RECTANGLE', 'Ambient Glow Blob', 200, 200)
  decorGlow.layoutPositioning = 'ABSOLUTE'
  decorGlow.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.2, b: 0.9 }, visible: true }]

  hero.appendChild(title)
  hero.appendChild(decorGlow)
  root.appendChild(hero)

  const log = []
  await convertWithRLM(root, 'mobile', log)

  assert.strictEqual(decorGlow.layoutPositioning, 'ABSOLUTE', 'Decorative glow must retain native layoutPositioning = ABSOLUTE')
})

// ---------------------------------------------------------------------
// TEST 8: Text Squashing Stress Test with Lengthy Copy
// ---------------------------------------------------------------------
await test('Text Squashing Stress Test: Long paragraph text never squashed', async () => {
  const root = new MockNode('FRAME', 'Long Copy Section', 1440, 700)
  const section = new MockNode('FRAME', 'Content Block', 1200, 400)

  const longParagraph = new MockNode('TEXT', 'Long Description', 900, 80)
  longParagraph.characters = 'Our state-of-the-art manufacturing facility in California delivers ultra-precision promotional products designed to elevate your corporate branding across nationwide campaigns.'
  longParagraph.fontSize = 16

  section.appendChild(longParagraph)
  root.appendChild(section)

  const log = []
  const audit = await convertWithRLM(root, 'mobile', log)

  assert.strictEqual(audit.textSquashCount, 0, 'Long paragraph copy must not be flagged for squashing')
  assert.strictEqual(longParagraph.textAutoResize, 'HEIGHT', 'Long copy must wrap using HEIGHT auto-resize')
})

// ---------------------------------------------------------------------
// TEST 9: Full E-Commerce Landing Page (Multi-Section End-to-End)
// ---------------------------------------------------------------------
await test('Full E-Commerce Landing Page: Converts clean vertical Auto Layout', async () => {
  const root = new MockNode('FRAME', 'PoshXessories Storefront', 1440, 2400)

  // 1. Promo Announcement Strip
  const promo = new MockNode('FRAME', 'Announcement Bar', 1440, 40)
  const promoTxt = new MockNode('TEXT', 'Promo Text', 500, 20)
  promoTxt.characters = 'Factory Direct Artwork Service | Call 800-555-0199'
  promo.appendChild(promoTxt)
  root.appendChild(promo)

  // 2. Navigation Header
  const nav = new MockNode('FRAME', 'Site Navigation Header', 1440, 80)
  const brand = new MockNode('TEXT', 'Brand Logo', 140, 28)
  brand.characters = 'POSHXESSORIES'
  nav.appendChild(brand)
  root.appendChild(nav)

  // 3. Category Tags Cloud
  const cats = new MockNode('FRAME', 'Category Tag Cloud', 1400, 60)
  cats.layoutMode = 'HORIZONTAL'
  for (const catName of ['Drinkware', 'Bags', 'Tech', 'Writing', 'Badges']) {
    const pill = new MockNode('FRAME', `${catName} Chip`, 100, 32)
    pill.cornerRadius = 9999
    const pt = new MockNode('TEXT', 'Txt', 80, 16)
    pt.characters = catName
    pill.appendChild(pt)
    cats.appendChild(pill)
  }
  root.appendChild(cats)

  // 4. Footer Section
  const footer = new MockNode('FRAME', 'Site Footer', 1440, 350)
  footer.y = 2000
  const copy = new MockNode('TEXT', 'Copyright Notice', 400, 20)
  copy.characters = '© 2026 PoshXessories Inc. All rights reserved.'
  footer.appendChild(copy)
  root.appendChild(footer)

  const log = []
  const audit = await convertWithRLM(root, 'mobile', log)

  assert.strictEqual(root.layoutMode, 'VERTICAL', 'Page must be in native Auto Layout')
  assert.strictEqual(promo.layoutSizingHorizontal, 'FILL', 'Announcement bar must FILL mobile width')
  assert.strictEqual(cats.layoutWrap, 'WRAP', 'Category chips must wrap')
  assert.ok(audit.healthScore >= 95, `Full page health score should be >= 95, got ${audit.healthScore}`)
})

// ---------------------------------------------------------------------
// TEST 10: Dedicated Overflow Analysis (Accidental vs Intentional)
// ---------------------------------------------------------------------
await test('Dedicated Overflow Analysis: Distinguishes accidental overflow vs intentional decorative glow', async () => {
  const { analyzeSectionOverflow } = await import('../src/plugin/figma/rlm/overflowAnalyzer.ts')

  const section = new MockNode('FRAME', 'Hero Section With Decor', 1440, 600)

  // Accidental overflow: desktop card with width 900
  const wideCard = new MockNode('FRAME', 'Accidental Wide Card', 900, 300)
  wideCard.x = 0; wideCard.y = 50
  const cardTitle = new MockNode('TEXT', 'Title', 800, 30)
  cardTitle.characters = 'Card with accidental desktop fixed width'
  wideCard.appendChild(cardTitle)
  section.appendChild(wideCard)

  // Intentional decorative layer: floating ambient blur blob
  const decorBlob = new MockNode('RECTANGLE', 'Ambient Glow Blob', 200, 200)
  decorBlob.x = 350; decorBlob.y = 20
  decorBlob.layoutPositioning = 'ABSOLUTE'
  decorBlob.fills = [{ type: 'SOLID', color: { r: 0.8, g: 0.1, b: 0.5 }, visible: true }]
  section.appendChild(decorBlob)

  const rlmSection = parseSceneNodeToRLM(section)
  classifyRLMTree(rlmSection, 600)

  const report = analyzeSectionOverflow(rlmSection, { width: 390, height: 844, name: 'Mobile', padding: 20, colGap: 12, rowGap: 28, navH: 56, defaultCardCols: 1 }, 350)

  assert.strictEqual(report.hasAccidentalOverflow, true, 'Must detect accidental overflow on the 900px wide card')
  const decorIssue = report.issues.find(i => i.nodeName === 'Ambient Glow Blob')
  assert.ok(decorIssue, 'Decorative glow blob was analyzed')
  assert.strictEqual(decorIssue.classification, 'INTENTIONAL_DECORATIVE', 'Glow blob must be classified as INTENTIONAL_DECORATIVE')
  assert.strictEqual(decorIssue.correctionNeeded, false, 'Intentional decorative layers must NOT be flagged for destructive resizing')
})

// ---------------------------------------------------------------------
// TEST 11: Intelligent Clipping (Rounded Media Clipped, Text Not Clipped)
// ---------------------------------------------------------------------
await test('Intelligent Clipping: Clips rounded cards with media; never clips text sections', async () => {
  const root = new MockNode('FRAME', 'Screen Root', 1440, 1200)

  // 1. Text Section (should NOT clip, so copy descenders & tooltips are visible)
  const textSection = new MockNode('FRAME', 'About Us Text Section', 1440, 300)
  const heading = new MockNode('TEXT', 'About Title', 400, 30)
  heading.characters = 'About Our Company Mission'
  textSection.appendChild(heading)
  root.appendChild(textSection)

  // 2. Rounded Product Card (should clip to rounded corners)
  const card = new MockNode('FRAME', 'Product Card With Image', 320, 400)
  card.cornerRadius = 16
  const img = new MockNode('RECTANGLE', 'Card Image Thumbnail', 320, 240)
  img.fills = [{ type: 'IMAGE', visible: true }]
  card.appendChild(img)
  root.appendChild(card)

  const log = []
  await convertWithRLM(root, 'mobile', log)

  assert.strictEqual(root.clipsContent, false, 'Root artboard must have clipsContent = false')
  assert.strictEqual(textSection.clipsContent, false, 'Text section must have clipsContent = false to avoid slicing copy')
  assert.strictEqual(card.clipsContent, true, 'Rounded card with media must have clipsContent = true for clean corner clipping')
})

// ---------------------------------------------------------------------
// TEST 12: Proportional Media & Background Dimensions
// ---------------------------------------------------------------------
await test('Proportional Media & Background: Preserves aspect ratio and adapts bg to mobile width', async () => {
  const root = new MockNode('FRAME', 'Hero Showcase', 1440, 700)

  const hero = new MockNode('FRAME', 'Hero Section', 1440, 600)
  // Desktop background originally 1440x600
  const bg = new MockNode('RECTANGLE', 'Hero Background', 1440, 600)
  bg.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.2 }, visible: true }]

  // Product photo with 16:9 aspect ratio (1280x720)
  const photo = new MockNode('RECTANGLE', 'Product Photo', 1280, 720)
  photo.fills = [{ type: 'IMAGE', visible: true }]

  hero.appendChild(bg)
  hero.appendChild(photo)
  root.appendChild(hero)

  const log = []
  await convertWithRLM(root, 'mobile', log)

  // Photo aspect ratio check: 720 / 1280 = 0.5625
  const photoAspect = photo.height / photo.width
  assert.ok(Math.abs(photoAspect - 0.5625) < 0.05, `Photo aspect ratio must be preserved (~0.56), got ${photoAspect}`)
  assert.ok(photo.width <= 390, `Photo width must fit mobile width (<= 390px), got ${photo.width}px`)
  assert.ok(bg.width <= 390, `Background width must adapt to mobile width (<= 390px), got ${bg.width}px`)
})

// ---------------------------------------------------------------------
// TEST 13: A/B Clipping Verification (Neither Overflows nor Hides Content)
// ---------------------------------------------------------------------
await test('A/B Clipping Verification: Content neither overflows nor is clipped unintentionally', async () => {
  const createTestArtboard = () => {
    const root = new MockNode('FRAME', 'Storefront Test', 1440, 800)
    const card = new MockNode('FRAME', 'Catalog Card', 340, 420)
    card.cornerRadius = 12
    const img = new MockNode('RECTANGLE', 'Img', 340, 220)
    img.fills = [{ type: 'IMAGE', visible: true }]
    const title = new MockNode('TEXT', 'Title', 300, 24)
    title.characters = 'Universal Travel Adapter Kit'
    const btn = new MockNode('FRAME', 'Buy Btn', 160, 44)
    btn.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.9 }, visible: true }]
    const btnTxt = new MockNode('TEXT', 'BtnTxt', 100, 18)
    btnTxt.characters = 'Add to Cart'
    btn.appendChild(btnTxt)
    card.appendChild(img)
    card.appendChild(title)
    card.appendChild(btn)
    root.appendChild(card)
    return { root, card, title, btn }
  }

  // Run conversion
  const { root, card, title, btn } = createTestArtboard()
  const log = []
  const audit = await convertWithRLM(root, 'mobile', log)

  // 1. Verify zero accidental overflow
  assert.strictEqual(audit.overflowCount, 0, 'Zero overflow count')
  assert.ok(card.width <= 390, 'Card width conforms to mobile')

  // 2. Verify essential text and button are visible and intact
  assert.strictEqual(title.visible, true, 'Title remains visible')
  assert.strictEqual(btn.visible, true, 'Button remains visible')
  assert.ok(title.width >= 100, `Title width must not be squashed, got ${title.width}px`)
})

console.log(`\n========================================`)
console.log(`RLM Test Suite: ${passed} Passed, ${failed} Failed`)
console.log(`========================================\n`)

if (failed > 0) {
  process.exit(1)
}
