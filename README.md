# Cyber-Threat-Map

Sentinel is a responsive cybersecurity dashboard with a Natural Earth world map and public threat-intelligence sources. It is an independent React/Vite project; it does not connect to PrivAI or to a protected organization's telemetry.

## Quick start

Requirements: Node.js 20 or newer and npm.

```sh
git clone https://github.com/dellongrant97-dev/Cyber-Threat-Map.git
cd Cyber-Threat-Map
npm ci
npm run dev
```

Vite prints the local development URL. Run `npm test` for the automated data-normalization, validation, activity, cache, and source-health tests; run `npm run build` to verify a production build, or `npm run preview` to serve that build locally.

## Architecture and configuration

This is a static single-page application built with React 18 and Vite 6. The application and its public-feed adapters live in `src/`, and Node's built-in test runner exercises the data helpers in `tests/`. There is no backend, server-side database, account system, or environment-specific runtime configuration.

No environment variables or API keys are required. The NVD public API is called without a key and may throttle requests. GitHub Pages' repository path is selected by `vite.config.js` when the site is built in GitHub Actions; local development uses `/`. Values prefixed with `VITE_` are compiled into public browser assets, so never put secrets or private credentials in them. `.env` files are ignored by Git.

The browser contacts the providers listed below directly (BBC headlines go through rss2json). Those providers can observe requests from each visitor. Geolocation requests contain selected public IP indicators; domain searches download the OpenPhish feed and compare the submitted domain locally, rather than sending that domain to OpenPhish. Do not use this public demo to look up sensitive, private, or organization-specific indicators.

## Data sources, terms, and attribution

The dashboard consumes third-party data and services, each with its own terms, availability, and limits. Check the linked current terms before reuse, especially for organizational or commercial use. Provider policies can change; this summary is for project orientation, not legal advice.

The OpenPhish Community Feed restriction means the current domain lookup is not approved for organizational security operations unless OpenPhish grants prior written consent. Organizations needing that capability should use a feed/API they are authorized to use, such as an internally licensed or organization-approved provider. If that provider requires a private key, add a reviewed backend integration rather than exposing the key in this static frontend.

| Source | How this project uses it | Licensing, attribution, and usage notes |
| --- | --- | --- |
| [IPsum](https://github.com/stamparm/ipsum) | Public IPv4 reputation snapshots and commit metadata; checked every 15 minutes, while the publisher generally updates about daily. | The repository identifies the data as [Unlicensed/public domain](https://github.com/stamparm/ipsum/blob/master/LICENSE). Link to IPsum when redistributing or describing its results. Its lists are not incident reports. |
| [ipapi.co](https://ipapi.co/) | Approximate hosting geolocation for at most 16 selected public indicator IPs per sample; cached in this browser. | A third-party service governed by [ipapi.co's terms](https://ipapi.co/terms/). Availability and request limits depend on its current service plan. Location is approximate and is not attribution. |
| [NVD CVE API](https://nvd.nist.gov/developers) | Public CVE records for the preceding seven days; refreshed every six hours, with at most two API requests per refresh. | No API key is configured or required by this app. NVD applies request throttling; a key raises the published request limits but is not needed here. Follow [NVD API guidance](https://nvd.nist.gov/developers/start-here), cite NVD records, and check vendor advisories. |
| [OpenPhish Community Feed](https://openphish.com/phishing_feeds.html) | On-demand domain reputation matching; the feed is cached locally for 30 minutes. | **The Community Feed's [terms](https://openphish.com/terms.html) limit use to personal, academic, or independent research. Organizational business/security operations require prior written consent.** Do not use this integration for organizational operations without that permission. |
| [USGS earthquake feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson) | Past-day M4.5+ events, checked every five minutes and shown as natural events, not cyber incidents. | Link to the [USGS event record](https://earthquake.usgs.gov/data/comcat/) and identify USGS as the source. Review [USGS copyright and credit guidance](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits); some material may have separate third-party rights. |
| [BBC World RSS](https://feeds.bbci.co.uk/news/world/rss.xml) via [rss2json](https://rss2json.com/) | Recent headlines, checked every 15 minutes; rss2json is an external converter required for browser access. | BBC content remains subject to [BBC terms](https://www.bbc.co.uk/usingthebbc/terms-of-use/); attribute and link to BBC stories. The public converter is an additional availability and usage-policy dependency. Do not treat headlines as threat intelligence. |
| [Natural Earth](https://www.naturalearthdata.com/) | Simplified 1:50m land outlines embedded in the 2D map. | Natural Earth data is [public domain](https://www.naturalearthdata.com/about/terms-of-use/); attribution is not required, but “Made with Natural Earth” is encouraged. |

The application source is provided under the repository's [MIT License](LICENSE). Third-party packages retain their own licenses; inspect package metadata and notices before redistributing a build.

## Map views

Use **2D Map** for the flat world projection or **3D Globe** for a continuously rotating, dot-rendered globe. Drag the globe to rotate it manually; the same threat, earthquake, and news layers are available in both views. The globe uses the existing Natural Earth geometry and Canvas, with no additional rendering dependency. Reduced-motion preferences stop its automatic rotation.

## Data accuracy and freshness

The dashboard reads [IPsum](https://github.com/stamparm/ipsum), which combines more than 30 public IP blocklists and updates its published snapshot about once every 24 hours. The browser checks the publisher every 15 minutes and downloads a new snapshot when its version changes; checking more frequently does not make the upstream feed more current.

IPsum entries are suspicious-IP indicators, not verified incidents. A higher source-list count is stronger corroboration, but is not proof that an IP attacked this network. The map samples up to 16 indicators and uses [ipapi.co](https://ipapi.co/) to estimate the IP's hosting location; GeoIP is approximate and is not the attacker's physical location. Some IPs may not resolve. Only the public indicator IPs selected for the map are sent to the geolocation provider.

The indicator list can be filtered by source-list consensus, approximate country, and IP reputation. Country filters apply only to the small set of successfully resolved GeoIP samples; indicators without a location can be filtered separately. IPsum has no per-indicator category or observation date, so the category is limited to IP reputation and date filtering refers only to the publisher's shared snapshot date.

The **Threat activity timeline** compares each newly retrieved IPsum snapshot with the previous snapshot cached in this browser. It summarizes newly listed, still-listed, removed, and strengthened indicators, and records the provider's publication time separately from the dashboard retrieval/check time. The first available snapshot is explicitly shown as a baseline because no earlier comparison is available. IPsum does not report per-IP observed-at or first-seen times; a newly listed indicator is only new relative to the locally compared snapshot, not necessarily newly active. Up to eight snapshot summaries are kept in browser storage; history is local to that browser and is not synchronized across devices.

The **Historical trends & statistics** view charts only those distinct IPsum publisher revisions this browser actually retrieved, up to the same eight locally retained records. A first snapshot is a baseline; changes are shown only when two or more revisions were collected. The country breakdown covers only current-feed IPs in the limited sample with successful approximate GeoIP; it describes likely hosting location, not the actor's nationality, attack origin, or attribution. Available categories are reported separately by feed: IPsum provides IP reputation and consensus, while NVD severity describes fetched CVE records, not observed attacks. This static GitHub Pages site does not add server-side history. If shared, durable history is later needed, keep Pages as the frontend and add a scheduled GitHub Actions collector that appends validated publisher revisions to managed object storage or a database, served to the site through a read-only API; do not put database write credentials in the public browser.

The **Data source health** panel reports retrieval state, last successful dashboard retrieval, latest available publisher/article timestamp, cached/stale state, and request errors for IPsum, sampled GeoIP, USGS, BBC (through rss2json), NVD, and on-demand OpenPhish. USGS feed-generation time and BBC article publication time are explicitly labeled as source-content timestamps, not dashboard retrieval times. Older cached USGS or GeoIP records may not have a stored retrieval timestamp; the panel marks that as unrecorded rather than substituting the current time. Failed refreshes retain their error and do not advance the last-success time. The browser's offline state is also shown separately.

The **Cybersecurity learning mode** explains public threat intelligence, IP reputation indicators, common threat categories, source-list consensus, CVSS severity, and the distinction between an indicator, a vulnerability, and a confirmed incident. It includes individual and organizational defensive basics and links to CISA, NIST, MITRE ATT&CK, and FIRST documentation. Categories are educational examples only: the dashboard does not infer attack types for IPsum addresses.

The **Vulnerability intelligence** section queries the public NVD CVE API for up to 50 results published in the preceding seven days and refreshes every six hours to limit API traffic. Results and the last successful check are cached in this browser and remain labeled cached if NVD is unavailable or rate-limits requests. CVSS, affected CPE products/version ranges, and remediation/advisory references are shown only when NVD supplies them. This demo has no software inventory or asset matching: a CVE record does not establish that a product is installed, affected, exploitable, or compromised. Consult NVD and vendor advisories for authoritative detail.

The **Threat intelligence search** checks IPv4 addresses against the current IPsum snapshot and domains (or pasted HTTP(S) URLs) against the [OpenPhish community feed](https://openphish.com/). OpenPhish's [terms](https://openphish.com/terms.html) restrict the Community Feed to personal, academic, or independent research; do not use it for organizational business/security operations without prior written consent. Domain lookups retrieve the public feed only when submitted and cache it in this browser for 30 minutes; the submitted domain is matched locally. If refresh fails, the previous snapshot is shown with an explicit stale/error notice. Results identify their source and distinguish provider publication time from dashboard retrieval/check time. Neither source provides per-indicator observation timestamps, and OpenPhish matches are shown as non-clickable text to avoid opening reported phishing destinations. Search validates input and performs no DNS lookup, connection, scan, or probe. Findings can be copied as JSON or exported as JSON/CSV for defensive analysis. Public-feed matches are not verified incidents, and absence from a feed does not establish that an indicator is safe.

The separate **Global events** layer uses the [USGS past-day M4.5+ earthquake feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson), checks every five minutes, and displays event locations, magnitudes, and reported times. Earthquakes are real-world natural events and are not presented as cyber incidents; map markers and list entries link to the USGS event records.

The **Major world news** panel displays recent [BBC World](https://www.bbc.co.uk/news/world) headlines and checks every 15 minutes. Its RSS feed is fetched through the public rss2json converter because the publisher feed does not permit direct browser access. The map highlights only places matched from a small built-in country/city gazetteer against each headline or summary; these are approximate reference points, not verified event boundaries. Headlines without a confident match remain in the list without a map marker. Story links lead to the BBC.

The latest successfully loaded earthquake and news results are cached in the browser so they remain available if an upstream service is temporarily unavailable. Cached results are labeled as cached until a successful refresh; cache storage failures do not block feed loading.

This static GitHub Pages demo is **not connected to an organization's SIEM, firewall, or EDR**, so it cannot report real-time attacks, blocked traffic, protected assets, or response times. Showing verified, real-time activity requires an authorized security-events API/backend for the organization's own telemetry. The UI deliberately does not invent incident timestamps or attack routes from blocklist data.

## Accessibility and reliability

The interface includes keyboard-focus indicators, labeled controls and map markers, responsive layouts, and reduced-motion handling. Provider errors and stale cached results are surfaced in the dashboard rather than represented as successful fresh data. Automated tests cover the important feed parsing, validation, activity, cache, and health logic; they do not replace manual keyboard, screen-reader, and mobile-browser checks.

## Security controls and maintainer configuration

The production build adds a restrictive Content Security Policy and `no-referrer` policy. Scripts are limited to the site itself; connections are limited to the feed hosts this application uses. Inline event handlers and script execution are blocked. Inline `style` attributes remain allowed for React-rendered dynamic chart widths, while stylesheets/fonts are limited to the site and Google Fonts. The policy is injected only in production builds so local Vite development and hot reload continue to work. Do not add a new external integration without updating and testing the policy.

GitHub Pages does not let this repository configure response headers. The HTML policy cannot set `frame-ancestors`, `X-Frame-Options`, `X-Content-Type-Options`, or `Permissions-Policy`; stronger anti-framing, MIME-sniffing, and browser-feature restrictions require hosting behind a service that supports response headers. This meta-policy is defense in depth, not a substitute for response-header controls.

To test the same policy in report-only mode before an enforcing release, set `CSP_REPORT_ONLY=true` for both the production build and Vite preview. For example, in PowerShell run `$env:CSP_REPORT_ONLY='true'; npm run build; npm run preview -- --host 127.0.0.1 --port 4174`. The preview responds with `Content-Security-Policy-Report-Only` and does not include the enforcing meta policy. Review browser-console violation messages while exercising the dashboard, then unset the variable and rebuild normally before release. GitHub Pages cannot set a report-only response header or collect CSP reports; production meta policies also cannot provide a reporting endpoint. Report-only telemetry requires a header-capable host and a trusted report collector. The automated tests verify policy construction/order; manual browser review is still required for actual runtime violations.

`npm run security:secrets` scans repository text and the production build for a limited set of common credential patterns. It reports only file, line, and rule—never the matched value. It cannot detect every secret, is not a history scan, and skips binary files and dependency directories. Keep `.env` files out of Git; never put credentials in `VITE_` variables because those are public in browser bundles. Enable GitHub secret scanning and push protection in repository settings when available; rotate exposed credentials immediately and follow GitHub's incident guidance.

Pull requests and main-branch builds run the secret scan, `npm audit`, tests, and production build. Workflow actions are pinned to reviewed commit SHAs, and Dependabot proposes npm and GitHub Actions updates weekly. Dependency alerts and this scanner are useful checks, not proof that code or packages are vulnerability-free.

Before public launch, configure repository **Settings → Branches / Rulesets** to require pull requests for `main`, require the `build` status check, require conversation resolution, block force pushes and branch deletion, and limit bypass permissions. Protect the `github-pages` environment so deployments are restricted to `main`; require a reviewer if launch policy calls for human approval. Enable Dependabot security updates and secret scanning/push protection where available. These are GitHub-host settings and cannot be enforced by files in this repository alone.

## Development

```sh
npm ci
npm run dev
```

Run `npm test` and `npm run build` before submitting a change. See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance.

## Deploy to GitHub Pages

The GitHub Actions workflow runs tests and a production build for pull requests targeting `main`. It deploys only after changes are pushed to `main` or when manually run against `main`; pull requests and other branches cannot deploy. In repository **Settings → Pages**, select **GitHub Actions** as the build and deployment source. After an authorized deployment workflow succeeds, the site is available at <https://dellongrant97-dev.github.io/Cyber-Threat-Map/>.

## Project limitations

This is a static GitHub Pages demo with browser-only storage and no backend, organization telemetry, asset inventory, shared history, or authentication. It cannot confirm incidents, real-time attacks, blocked traffic, asset exposure, or remediation status. Local activity history is limited to snapshots collected by one browser. Public intelligence may be stale, incomplete, or contain false positives; geolocation is approximate. Browser requests depend on provider CORS, availability, and changing service terms or rate limits. For organization-wide threat operations, use authorized feeds and telemetry through infrastructure approved by that organization. Persistent shared history would require a backend or scheduled collector and storage; neither is necessary for the current public demo.
