// Custom site config (not in iptv-org/epg): La Xarxa's programming-grid
// widget used by Catalan local TV stations (TAC12 = grid 6112). The grid JS
// embeds ~12 days of schedule as an inline `lxmgrid` JSON array; one request
// serves every day, so the parser filters by the requested date.
// The workflow copies this folder into the iptv-org/epg clone before grabbing.
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
dayjs.extend(utc)

module.exports = {
  site: 'laxarxa.cat',
  days: 3,
  url({ channel }) {
    return `https://graella.laxarxa.cat/grid-${channel.site_id}.js`
  },
  request: {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
    }
  },
  parser({ content, date }) {
    const match = String(content).match(/lxmgrid = (\[[\s\S]*?\]);/)
    if (!match) return []

    let items
    try {
      items = JSON.parse(match[1])
    } catch {
      return []
    }

    // StartDateTime is Europe/Madrid local time ("2026/08/28 06:30:00");
    // the timestamps are epoch seconds. Filter by local day, emit by epoch.
    const day = date.format('YYYY/MM/DD')
    return items
      .filter(item => (item.StartDateTime || '').startsWith(day))
      .map(item => ({
        title: item.Title,
        description: item.Description || null,
        icon: typeof item.Images === 'string' ? item.Images : null,
        start: dayjs.unix(parseFloat(item.StartDateTimestamp)),
        stop: dayjs.unix(parseFloat(item.EndDateTimestamp))
      }))
  }
}
