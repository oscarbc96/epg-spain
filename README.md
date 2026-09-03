# epg-spain

Daily-updated XMLTV guide for the full Spanish [Movistar Plus+](https://www.movistarplus.es/programacion-tv) lineup (~143 channels, logos included), generated with [iptv-org/epg](https://github.com/iptv-org/epg) and published on GitHub Pages.

Successor of [epg_generator](https://github.com/oscarbc96/epg_generator).

## Guide URLs

| File | URL |
| --- | --- |
| XMLTV | `https://oscarbc96.github.io/epg-spain/guide.xml` |
| XMLTV (gzip) | `https://oscarbc96.github.io/epg-spain/guide.xml.gz` |

Point your IPTV player (TiviMate, Jellyfin, Kodi, IPTVnator…) at the `guide.xml` URL as its EPG/XMLTV source.

## How it works

A [GitHub Actions workflow](.github/workflows/update.yml) runs every day at 04:30 UTC:

1. `scripts/build_channels.mjs` fetches the live Movistar Plus+ channel lineup (so new channels appear automatically), attaches each channel's logo, and maps channels to standard [iptv-org](https://github.com/iptv-org/database) `xmltv_id`s via `channels/xmltv_ids.json` (120/143 mapped; the rest keep their Movistar ID).
2. [iptv-org/epg](https://github.com/iptv-org/epg) grabs 3 days of programming (`--days=3`).
3. `scripts/build_site.mjs` sanity-checks the result (fails the run instead of deploying a broken guide) and renders the [index page](https://oscarbc96.github.io/epg-spain/).
4. The output is deployed to GitHub Pages.

## Run locally

```sh
git clone --depth 1 https://github.com/iptv-org/epg.git /tmp/epg
npm install --prefix /tmp/epg
node scripts/build_channels.mjs --output=/tmp/epg/spain.channels.xml --map=channels/xmltv_ids.json
cd /tmp/epg && npm run grab --- --channels=spain.channels.xml --output=guide.xml --days=3 --maxConnections=10
```

## Disclaimer

Programming data belongs to Movistar Plus+. This project is for personal use only.
