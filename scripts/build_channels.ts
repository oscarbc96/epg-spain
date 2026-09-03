#!/usr/bin/env bun
// Builds a *.channels.xml for iptv-org/epg from three sources:
//   1. Movistar Plus+ live lineup (primary; richest EPG). Their site config
//      pins demarcation=18 in the EPG URL, so the lineup uses it too —
//      channels from other demarcations would return no programmes.
//   2. Orange TV live lineup, only for channels Movistar doesn't carry
//      (TV3 and the rest of the autonómicas, locals, FDF/AMC/Nick/…).
//   3. A few static extras with no live API (Esport3, SX3 via El País);
//      grab pulls their logos from the iptv-org API.
// Logos come from each provider's API; xmltv_id from the curated map.
import { readFileSync, writeFileSync } from 'node:fs'

const DEMARCATION = process.env.DEMARCATION || '18'
const MOVISTAR_API = `https://ottcache.dof6.com/movistarplus/webplayer/OTT/contents/channels?mdrm=true&tlsstream=true&demarcation=${DEMARCATION}&version=8`
const ORANGE_API =
  'https://pc.orangetv.orange.es/pc/api/rtv/v1/GetChannelList?bouquet_external_id=1_PRO&model_external_id=PC&filter_unsupported_channels=true&max_pr_level=8&client=json'
const ORANGE_IMAGES = 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images'

interface Entry {
  site: string
  site_id: string
  name: string
  logo: string
  xmltv_id: string
}

interface MovistarChannel {
  CodCadenaTv: string
  Nombre: string
  Logo?: string
  Logos?: { uri: string }[]
}

interface OrangeChannel {
  externalChannelId: string
  name: string
  attachments?: { name: string; value: string }[]
}

const EXTRAS: Omit<Entry, 'logo'>[] = [
  { site: 'programacion-tv.elpais.com', site_id: '672', name: 'Esport3', xmltv_id: 'Esport3.es' },
  { site: 'programacion-tv.elpais.com', site_id: '541', name: 'SX3', xmltv_id: 'SX3.es' }
]

const args: Record<string, string> = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=')
    return [key, rest.join('=')]
  })
)

if (!args.output) {
  console.error('Usage: build_channels.ts --output=path/to/spain.channels.xml [--map=xmltv_ids.json]')
  process.exit(1)
}

const xmltvIds: Record<string, string> = args.map ? JSON.parse(readFileSync(args.map, 'utf8')) : {}

const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Loose name key so "Canal Sur" (Orange) matches "CanalSur", "TDP HD" matches "TDP"… mostly.
const nameKey = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(hd|sd|4k|uhd|tv)\b/g, '')
    .replace(/[^a-z0-9]/g, '')

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`${url} -> ${response.status}`)
  return response.json() as Promise<T>
}

const entries: Entry[] = []
const seenNames = new Set<string>()
const seenIds = new Set<string>()
const seenXmltvIds = new Set<string>()

function add(entry: Entry) {
  const key = nameKey(entry.name)
  if (!entry.site_id || !entry.name || seenIds.has(`${entry.site}:${entry.site_id}`)) return
  if (key && seenNames.has(key)) return
  if (entry.xmltv_id && seenXmltvIds.has(entry.xmltv_id)) return
  seenIds.add(`${entry.site}:${entry.site_id}`)
  if (key) seenNames.add(key)
  if (entry.xmltv_id) seenXmltvIds.add(entry.xmltv_id)
  entries.push(entry)
}

// 1. Movistar (primary)
const movistar = await fetchJson<MovistarChannel[]>(MOVISTAR_API)
if (!Array.isArray(movistar) || movistar.length < 50) {
  console.error(`Unexpected Movistar API response (${movistar?.length ?? 'no'} channels)`)
  process.exit(1)
}
for (const channel of movistar) {
  add({
    site: 'movistarplus.es',
    site_id: channel.CodCadenaTv,
    name: channel.Nombre,
    logo: channel.Logo || channel.Logos?.[0]?.uri || '',
    xmltv_id: xmltvIds[channel.CodCadenaTv] || ''
  })
}
const movistarCount = entries.length

// 2. Orange (gap-filler only)
let orangeCount = 0
try {
  const orange = await fetchJson<{ response: OrangeChannel[] }>(ORANGE_API, {
    'User-Agent': 'Mozilla/5.0'
  })
  for (const channel of orange.response) {
    const name = (channel.name || '').trim()
    if (/prueba/i.test(name)) continue // Orange test channels
    const logoAttachment = channel.attachments?.find(a => a.name === 'LOGO')
    const before = entries.length
    add({
      site: 'orangetv.orange.es',
      site_id: channel.externalChannelId,
      name,
      logo: logoAttachment ? `${ORANGE_IMAGES}${logoAttachment.value}` : '',
      xmltv_id: xmltvIds[channel.externalChannelId] || ''
    })
    orangeCount += entries.length - before
  }
} catch (error) {
  console.error(`WARN: Orange lineup unavailable, continuing with Movistar only (${(error as Error).message})`)
}

// 3. Static extras
for (const extra of EXTRAS) {
  add({ logo: '', ...extra })
}

const lines = entries
  .map(entry => {
    const logoAttr = entry.logo ? ` logo="${escape(entry.logo)}"` : ''
    return `  <channel site="${entry.site}" site_id="${escape(entry.site_id)}" lang="es"${logoAttr} xmltv_id="${escape(entry.xmltv_id)}">${escape(entry.name)}</channel>`
  })
  .sort()

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<channels>\n${lines.join('\n')}\n</channels>\n`
writeFileSync(args.output, xml)

const mapped = entries.filter(entry => entry.xmltv_id).length
const withLogo = entries.filter(entry => entry.logo).length
console.log(
  `Saved ${entries.length} channels (movistar ${movistarCount}, orange ${orangeCount}, extras ${entries.length - movistarCount - orangeCount}; ` +
    `${mapped} with xmltv_id, ${withLogo} with logo) to ${args.output}`
)
