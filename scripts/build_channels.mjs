#!/usr/bin/env node
// Builds a *.channels.xml for iptv-org/epg from the live Movistar Plus+ lineup.
// Logos come from the Movistar API; xmltv_id from the curated map when known.
import { readFileSync, writeFileSync } from 'node:fs'

const API_URL =
  'https://ottcache.dof6.com/movistarplus/webplayer/OTT/contents/channels?mdrm=true&tlsstream=true&demarcation=18&version=8'

const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=')
    return [key, rest.join('=')]
  })
)

if (!args.output) {
  console.error('Usage: build_channels.mjs --output=path/to/spain.channels.xml [--map=xmltv_ids.json]')
  process.exit(1)
}

const xmltvIds = args.map ? JSON.parse(readFileSync(args.map, 'utf8')) : {}

const escape = value =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const response = await fetch(API_URL)
if (!response.ok) {
  console.error(`Movistar API request failed: ${response.status}`)
  process.exit(1)
}
const channels = await response.json()
if (!Array.isArray(channels) || channels.length < 50) {
  console.error(`Unexpected Movistar API response (${channels.length ?? 'no'} channels)`)
  process.exit(1)
}

const seen = new Set()
const lines = []
for (const channel of channels) {
  const siteId = channel.CodCadenaTv
  const name = channel.Nombre
  if (!siteId || !name || seen.has(siteId)) continue
  seen.add(siteId)

  const logo = channel.Logo || channel.Logos?.[0]?.uri || ''
  const xmltvId = xmltvIds[siteId] || ''
  const logoAttr = logo ? ` logo="${escape(logo)}"` : ''
  lines.push(
    `  <channel site="movistarplus.es" site_id="${escape(siteId)}" lang="es"${logoAttr} xmltv_id="${escape(xmltvId)}">${escape(name)}</channel>`
  )
}

lines.sort()

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<channels>\n${lines.join('\n')}\n</channels>\n`
writeFileSync(args.output, xml)

const mapped = lines.filter(line => !line.includes('xmltv_id=""')).length
console.log(`Saved ${lines.length} channels (${mapped} with xmltv_id, ${lines.filter(l => l.includes('logo=')).length} with logo) to ${args.output}`)
