# Cyber-Threat-Map

Sentinel is a responsive cybersecurity dashboard with a high-resolution, Natural Earth 1:50m SVG world map and public IP reputation intelligence. Search, confidence filters, map-marker selection, CSV export, feed refresh, source links, and approximate IP geolocation are driven by fetched data.

## Data accuracy and freshness

The dashboard reads [IPsum](https://github.com/stamparm/ipsum), which combines more than 30 public IP blocklists and updates its published snapshot about once every 24 hours. The browser checks the publisher every 15 minutes and downloads a new snapshot when its version changes; checking more frequently does not make the upstream feed more current.

IPsum entries are suspicious-IP indicators, not verified incidents. A higher source-list count is stronger corroboration, but is not proof that an IP attacked this network. The map samples up to 16 indicators and uses [ipapi.co](https://ipapi.co/) to estimate the IP's hosting location; GeoIP is approximate and is not the attacker's physical location. Some IPs may not resolve. Only the public indicator IPs selected for the map are sent to the geolocation provider.

The separate **Global events** layer uses the [USGS past-day M4.5+ earthquake feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson), checks every five minutes, and displays event locations, magnitudes, and reported times. Earthquakes are real-world natural events and are not presented as cyber incidents; map markers and list entries link to the USGS event records.

The **Major world news** panel displays recent [BBC World](https://www.bbc.co.uk/news/world) headlines and checks every 15 minutes. Its RSS feed is fetched through the public rss2json converter because the publisher feed does not permit direct browser access. The map highlights only places matched from a small built-in country/city gazetteer against each headline or summary; these are approximate reference points, not verified event boundaries. Headlines without a confident match remain in the list without a map marker. Story links lead to the BBC.

This static GitHub Pages demo is **not connected to an organization's SIEM, firewall, or EDR**, so it cannot report real-time attacks, blocked traffic, protected assets, or response times. Showing verified, real-time activity requires an authorized security-events API/backend for the organization's own telemetry. The UI deliberately does not invent incident timestamps or attack routes from blocklist data.

## Development

Install dependencies and start the Vite development server:

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.

## Deploy to GitHub Pages

The `Deploy GitHub Pages` workflow builds and deploys the site whenever changes are pushed to `main`. In the repository's **Settings → Pages**, select **GitHub Actions** as the build and deployment source. After the workflow succeeds, the site is available at <https://dellongrant97-dev.github.io/Cyber-Threat-Map/>.
