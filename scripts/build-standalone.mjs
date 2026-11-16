import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = path.join(root, 'dist')
let html = await readFile(path.join(dist, 'index.html'), 'utf8')
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/gi)]
const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/gi)]
if (scripts.length !== 1 || styles.length !== 1) {
  throw new Error('Expected one bundled script and stylesheet; check Vite output before exporting.')
}
for (const match of scripts) {
  const javascript = await readFile(path.join(dist, match[1].replace(/^\//, '')), 'utf8')
  html = html.replace(match[0], () => `<script type="module">\n${javascript.replace(/<\/script/gi, '<\\/script')}\n</script>`)
}
for (const match of styles) {
  const css = await readFile(path.join(dist, match[1].replace(/^\//, '')), 'utf8')
  if (/<\/style/i.test(css)) throw new Error('Unexpected closing style tag in stylesheet.')
  html = html.replace(match[0], () => `<style>\n${css}\n</style>`)
}
const favicon = await readFile(path.join(dist, 'favicon.svg'))
html = html.replace('href="/favicon.svg"', `href="data:image/svg+xml;base64,${favicon.toString('base64')}"`)
const output = path.join(dist, '微醺时刻.html')
await writeFile(output, html)
console.log(`Standalone web app: ${output} (${Math.ceil(Buffer.byteLength(html) / 1024)} KB)`)
