#!/usr/bin/env bun
// Validates the grabbed guide and generates the GitHub Pages index.html.
// Fails (exit 1) if the guide looks broken, so a bad run never gets deployed.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MIN_CHANNELS = 200
const MIN_PROGRAMMES = 5000

const args: Record<string, string> = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=')
    return [key, rest.join('=')]
  })
)

if (!args.guide || !args.output) {
  console.error('Usage: build_site.ts --guide=public/guide.xml --output=public')
  process.exit(1)
}

const xml = readFileSync(args.guide, 'utf8')

const channelMatches = [
  ...xml.matchAll(/<channel id="([^"]*)"><display-name>([^<]*)<\/display-name>(?:<icon src="([^"]*)"\/>)?/g)
]
const programmeCount = (xml.match(/<programme /g) || []).length
const iconCount = channelMatches.filter(match => match[3]).length

console.log(`guide: ${channelMatches.length} channels, ${iconCount} with logo, ${programmeCount} programmes`)

if (channelMatches.length < MIN_CHANNELS) {
  console.error(`FAIL: only ${channelMatches.length} channels (< ${MIN_CHANNELS})`)
  process.exit(1)
}
if (programmeCount < MIN_PROGRAMMES) {
  console.error(`FAIL: only ${programmeCount} programmes (< ${MIN_PROGRAMMES})`)
  process.exit(1)
}

const updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const channelCells = channelMatches
  .map(([, id, name, icon]) => {
    const img = icon ? `<img src="${escape(icon)}" alt="" loading="lazy">` : ''
    return `<div class="ch" title="${escape(id)}">${img}<span>${escape(name)}</span></div>`
  })
  .join('\n      ')

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EPG España</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #10131a; color: #e6e9ef; font: 15px/1.6 system-ui, sans-serif; }
  main { max-width: 900px; margin: 0 auto; padding: 48px 20px 80px; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  .sub { color: #8b93a5; margin: 0 0 28px; }
  .stats { display: flex; gap: 28px; flex-wrap: wrap; margin: 0 0 28px; }
  .stat b { display: block; font-size: 22px; }
  .stat span { color: #8b93a5; font-size: 13px; }
  .url { display: flex; gap: 8px; align-items: center; background: #1a1f2b; border: 1px solid #2a3140; border-radius: 8px; padding: 10px 14px; margin-bottom: 10px; }
  .url code { flex: 1; overflow-x: auto; white-space: nowrap; color: #9ecbff; }
  .url a { color: #8b93a5; text-decoration: none; font-size: 13px; }
  .url a:hover { color: #e6e9ef; }
  h2 { font-size: 17px; margin: 36px 0 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
  .ch { display: flex; align-items: center; gap: 8px; background: #1a1f2b; border-radius: 6px; padding: 6px 10px; font-size: 12.5px; }
  .ch img { width: 28px; height: 28px; object-fit: contain; flex: none; }
  footer { margin-top: 48px; color: #626a7c; font-size: 13px; }
  footer a { color: #8b93a5; }
</style>
</head>
<body>
<main>
  <h1>EPG España</h1>
  <p class="sub">Guía de programación (XMLTV) con la parrilla completa de Movistar Plus+ y Orange TV, incluidas las autonómicas (TV3, 3Cat Info, Esport3, SX3, À Punt…), con logos. Actualizada a diario mediante <a href="https://github.com/iptv-org/epg" style="color:#8b93a5">iptv-org/epg</a>.</p>

  <div class="stats">
    <div class="stat"><b>${channelMatches.length}</b><span>canales</span></div>
    <div class="stat"><b>${programmeCount}</b><span>programas (3 días)</span></div>
    <div class="stat"><b>${updatedAt}</b><span>última actualización</span></div>
  </div>

  <div class="url"><code id="u1">guide.xml</code><a href="guide.xml" download>descargar</a></div>
  <div class="url"><code id="u2">guide.xml.gz</code><a href="guide.xml.gz" download>descargar</a></div>

  <p>Usa la URL de <code>guide.xml</code> como fuente EPG/XMLTV en tu reproductor IPTV (TiviMate, IPTVnator, Jellyfin, Kodi…). Los canales con <code>xmltv_id</code> estándar de iptv-org enlazan automáticamente con sus listas.</p>

  <h2>Canales</h2>
  <div class="grid">
      ${channelCells}
  </div>

  <footer>Generado con <a href="https://github.com/iptv-org/epg">iptv-org/epg</a>. Datos de programación propiedad de sus emisoras. Solo para uso personal.</footer>
</main>
<script>
  for (const id of ['u1', 'u2']) {
    const el = document.getElementById(id)
    el.textContent = new URL(el.textContent, location.href).href
  }
</script>
</body>
</html>
`

writeFileSync(join(args.output, 'index.html'), html)
writeFileSync(join(args.output, '.nojekyll'), '')
console.log(`Saved ${join(args.output, 'index.html')}`)
