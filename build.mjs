import * as esbuild from 'esbuild'
import { build as viteBuild } from 'vite'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { mkdirSync, existsSync, cpSync, readFileSync, writeFileSync, rmSync, statSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const isWatch = process.argv.includes('--watch')

// Ensure dist directory exists
mkdirSync(resolve(__dirname, 'dist'), { recursive: true })

/**
 * Clean up stale chunk files from old packaging strategies
 */
function cleanupStaleModelChunks() {
  const staleChunks = [
    resolve(__dirname, 'src/ai/rmbg14_chunks.ts'),
    resolve(__dirname, 'src/ai/u2netp_chunks.ts'),
    resolve(__dirname, 'src/ai/silueta_chunks.ts'),
    resolve(__dirname, 'src/ai/u2net_chunks.ts'),
  ]
  for (const stale of staleChunks) {
    if (existsSync(stale)) {
      rmSync(stale, { force: true })
      console.log(`🧹 Cleaned up stale ${stale.split(/[/\\]/).pop()}`)
    }
  }
}

cleanupStaleModelChunks()

const pluginOptions = {
  entryPoints: [resolve(__dirname, 'src/plugin/code.ts')],
  bundle: true,
  outfile: resolve(__dirname, 'dist/code.js'),
  format: /** @type {'cjs'} */ ('cjs'),
  target: 'es2017',
  logLevel: /** @type {'info'} */ ('info'),
  tsconfig: resolve(__dirname, 'tsconfig.plugin.json'),
}

console.log('🔨 Building DesignKit...\n')

if (isWatch) {
  console.log('👀 Watch mode — building continuously\n')

  const ctx = await esbuild.context(pluginOptions)
  await ctx.watch()
  console.log('✅ Plugin watcher started')

  await viteBuild({
    build: { watch: {} },
    logLevel: 'info',
  })
} else {
  // 1. Build plugin sandbox code
  await esbuild.build(pluginOptions)
  console.log('✅ Plugin code → dist/code.js')

  // 2. Build UI code with Vite
  await viteBuild()
  console.log('✅ UI → dist/index.html')

  // 3. Copy static assets to dist/assets
  const assetsSrc = resolve(__dirname, 'assets')
  const assetsDst = resolve(__dirname, 'dist/assets')
  if (existsSync(assetsSrc)) {
    cpSync(assetsSrc, assetsDst, { recursive: true })
    console.log('✅ Local Model Assets → dist/assets')
  }

  console.log('\n🎉 Build complete!')
  console.log('👉 In Figma: Plugins → Development → Import plugin from manifest')
  console.log('   Select: manifest.json in the project root\n')
}

