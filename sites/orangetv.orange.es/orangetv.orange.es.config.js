// Override of iptv-org/epg's orangetv.orange.es config (copied over it by the
// workflow; the upstream loader requires *.config.js, so this file stays JS).
// Fixes two upstream bugs:
//   1. The segment cache stored CHANNEL-FILTERED items, so every channel
//      grabbed after the first inherited that channel's segment 2-3
//      programmes (e.g. TRECE's "El cascabel" showing on ~100 channels).
//      The cache now stores the raw segment payload and filtering happens
//      per channel.
//   2. Channels with nothing in segment 1 (00:00-08:00) skipped segments
//      2-3 entirely and came out empty; segments are now always fetched.
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const doFetch = require('@ntlab/sfetch')
const debug = require('debug')('site:orangetv.orange.es')

dayjs.extend(utc)

doFetch.setDebugger(debug)

const API_PROGRAM_ENDPOINT = 'https://epg.orangetv.orange.es/epg/SmartTV_Android/1_PRO'
const API_IMAGE_ENDPOINT = 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images'
const API_CHANNEL_ENDPOINT =
  'https://pc.orangetv.orange.es/pc/api/rtv/v1/GetChannelList?bouquet_external_id=1_PRO&model_external_id=PC&filter_unsupported_channels=true&max_pr_level=8&client=json'

const caches = {} // url -> raw segment payload (never channel-filtered)

module.exports = {
  site: 'orangetv.orange.es',
  days: 2,
  request: {
    cache: {
      ttl: 24 * 60 * 60 * 1000 // 1 day
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
    }
  },
  url({ date }) {
    return segmentUrl(date)
  },
  async parser({ content, channel, date }) {
    const items = parseItems(content, channel)
    const queues = []
    for (let i = 2; i <= 3; i++) {
      const url = segmentUrl(date, i)
      if (caches[url] !== undefined) {
        items.push(...parseItems(caches[url], channel))
      } else {
        queues.push({ url, params: module.exports.request })
      }
    }
    if (queues.length) {
      await doFetch(queues, (queue, res) => {
        caches[queue.url] = res
        items.push(...parseItems(res, channel))
      })
    }

    return items.map(item => {
      return {
        title: item.name,
        sub_title: item.seriesName,
        description: item.description,
        category: parseGenres(item),
        season: item.seriesSeason ? parseInt(item.seriesSeason) : null,
        episode: item.episodeId ? parseInt(item.episodeId) : null,
        icon: parseIcon(item),
        start: dayjs.utc(item.startDate),
        stop: dayjs.utc(item.endDate)
      }
    })
  },
  async channels() {
    const axios = require('axios')
    const data = await axios
      .get(API_CHANNEL_ENDPOINT)
      .then(r => r.data)
      .catch(console.error)

    return data.response.map(item => {
      return {
        lang: 'es',
        name: item.name,
        site_id: item.externalChannelId
      }
    })
  }
}

function segmentUrl(date, segment = 1) {
  return `${API_PROGRAM_ENDPOINT}/${date.format('YYYYMMDD')}_8h_${segment}.json`
}

function parseIcon(item) {
  if (item.attachments && item.attachments.length) {
    const cover = item.attachments.find(i => i.name.match(/cover/i))
    if (cover) {
      return `${API_IMAGE_ENDPOINT}${cover.value}`
    }
  }
}

function parseGenres(item) {
  return (item.genres || []).map(i => i.name)
}

function parseItems(content, channel) {
  const result = []
  const json =
    typeof content === 'string' ? JSON.parse(content) : Array.isArray(content) ? content : []
  if (Array.isArray(json)) {
    json
      .filter(i => String(i.channelExternalId) === String(channel.site_id))
      .forEach(i => {
        result.push(...(i.programs || []))
      })
  }

  return result
}
