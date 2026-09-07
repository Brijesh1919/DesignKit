# DesignKit

> **All-in-one local Figma design utility toolkit** — no AI, no backend, no external APIs.

## Installation

```bash
npm install
npm run build
```

Then in Figma:
1. Go to **Plugins → Development → Import plugin from manifest**
2. Select `manifest.json` from this project root
3. Run **DesignKit** from Plugins → Development

## Development (watch mode)

```bash
npm run dev
```

This watches both the plugin code and the UI, rebuilding on every change.  
After each rebuild, **right-click → Plugins → Development → DesignKit** in Figma to reload.

## Architecture

```
designkit/
├── manifest.json          ← Figma plugin manifest (import this)
├── dist/
│   ├── code.js            ← Compiled plugin sandbox code
│   └── index.html         ← Self-contained UI (all JS/CSS inlined)
│
└── src/
    ├── shared/
    │   └── types.ts       ← Shared TS types (plugin ↔ UI messages)
    ├── plugin/            ← Figma sandbox code (no DOM access)
    │   ├── code.ts        ← Main entry, message router
    │   └── figma/         ← Figma API wrappers
    └── ui/                ← React UI (runs in plugin iframe)
        ├── tools/         ← One component per tool
        ├── registry/      ← Tool registry (add new tools here)
        ├── styles/        ← Design tokens + base styles
        └── utils/         ← Color math, typography, messaging
```

## Implemented Tools (v1.0)

| Category | Tool |
|---|---|
| 🎨 Colors | Color Palette Generator |
| 🎨 Colors | Color Harmony Generator |
| 🎨 Colors | Contrast Checker |
| Aa Typography | Typography Scale Generator |
| 📐 Layout | Spacing Normalizer |
| 📐 Layout | Auto Layout Optimizer |
| 🖼 Images | Image Color Extractor |
| 🖼 Images | Solid Background Remover |

## Adding a New Tool

1. Create `src/ui/tools/<category>/<ToolName>.tsx`
2. Add it to `src/ui/registry/toolRegistry.ts`
3. Add any Figma API calls to `src/plugin/code.ts`
4. Run `npm run build`

No other files need to be touched.

## Technical Notes

- **No backend** — the plugin is entirely self-contained after building
- **Image processing** — done locally via HTML Canvas in the plugin iframe
- **Color math** — pure JavaScript, no libraries
- **Font loading** — Inter loaded from Google Fonts CDN (Figma plugin iframes have internet access for assets)
- **WCAG contrast** — calculated with the correct WCAG 2.1 relative luminance formula
