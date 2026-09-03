# epg-spain

Daily-updated XMLTV guide for Spain (~276 channels, logos included): the full [Movistar Plus+](https://www.movistarplus.es/programacion-tv) lineup plus everything Orange TV carries that Movistar doesn't — TV3 and the rest of the autonómicas (3Cat Info, À Punt, IB3, ETB, TVG, Canal Sur, CMM, Aragón…), local stations, FDF, AMC, Nick, NatGeo… — plus Esport3 and SX3 via El País. Generated with [iptv-org/epg](https://github.com/iptv-org/epg) and published on GitHub Pages.

Successor of [epg_generator](https://github.com/oscarbc96/epg_generator).

## Guide URLs

| File | URL |
| --- | --- |
| XMLTV | `https://oscarbc96.github.io/epg-spain/guide.xml` |
| XMLTV (gzip) | `https://oscarbc96.github.io/epg-spain/guide.xml.gz` |

Point your IPTV player (TiviMate, Jellyfin, Kodi, IPTVnator…) at the `guide.xml` URL as its EPG/XMLTV source.

## How it works

A [GitHub Actions workflow](.github/workflows/update.yml) runs every day at 04:30 UTC ([mise](https://mise.jdx.dev) provisions bun + node from `mise.toml`):

1. `scripts/build_channels.ts` (bun) fetches the live Movistar Plus+ and Orange TV lineups (new channels appear automatically), deduplicates them (Movistar wins for shared channels — richer EPG), attaches each channel's logo from its provider, adds a couple of static extras (Esport3, SX3), and maps channels to standard [iptv-org](https://github.com/iptv-org/database) `xmltv_id`s via `channels/xmltv_ids.json`.
2. [iptv-org/epg](https://github.com/iptv-org/epg) grabs 3 days of programming (`--days=3`).
3. `scripts/build_site.ts` (bun) sanity-checks the result (fails the run instead of deploying a broken guide) and renders the [index page](https://oscarbc96.github.io/epg-spain/).
4. The output is deployed to GitHub Pages.

Notes:

- Movistar's site config in iptv-org/epg pins `demarcation=18`, so regional variants from other demarcations return no programmes; the autonómicas come from Orange instead (`DEMARCATION` env var overrides it if that ever changes).
- TAC12 (Tarragona) exists in the iptv-org database but no EPG source publishes its schedule, so it can't be included yet.

## Run locally

```sh
mise install
git clone --depth 1 https://github.com/iptv-org/epg.git /tmp/epg
npm install --prefix /tmp/epg
bun scripts/build_channels.ts --output=/tmp/epg/spain.channels.xml --map=channels/xmltv_ids.json
cd /tmp/epg && npm run grab --- --channels=spain.channels.xml --output=guide.xml --days=3 --maxConnections=10
```

## Disclaimer

Programming data belongs to its broadcasters and platforms (Movistar Plus+, Orange TV, El País). This project is for personal use only.
