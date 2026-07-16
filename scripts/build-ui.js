const path = require('path')
const fs = require('fs')
const esbuild = require('esbuild')
const postcss = require('postcss')
const tailwindcss = require('@tailwindcss/postcss')

const rootDir = path.resolve(__dirname, '..')

const screens = [
  { source: 'Control Panel', output: 'control-panel' },
  { source: 'Serial Monitor', output: 'serial-monitor' },
  { source: 'Serial Plotter', output: 'serial-plotter' },
  { source: 'Board Manager', output: 'board-manager' },
  { source: 'Library Manager', output: 'library-manager' },
]

async function buildScreen(screen) {
  const screenDir = path.join(rootDir, 'v0_Screens', screen.source)
  const outDir = path.join(rootDir, 'media', screen.output)
  fs.mkdirSync(outDir, { recursive: true })

  await esbuild.build({
    entryPoints: [path.join(screenDir, 'index.tsx')],
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.svg': 'dataurl', '.png': 'dataurl' },
    outfile: path.join(outDir, 'main.js'),
  })

  const cssEntry = path.join(screenDir, 'app', 'globals.css')
  const cssSource = fs.readFileSync(cssEntry, 'utf8')
  const result = await postcss([tailwindcss({ base: screenDir })]).process(cssSource, {
    from: cssEntry,
    to: path.join(outDir, 'style.css'),
  })
  fs.writeFileSync(path.join(outDir, 'style.css'), result.css)
}

async function main() {
  for (const screen of screens) {
    await buildScreen(screen)
    console.log(`Built "${screen.source}" -> media/${screen.output}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
