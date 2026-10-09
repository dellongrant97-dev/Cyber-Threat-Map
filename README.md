# Cyber-Threat-Map

Sentinel is a responsive cybersecurity command-center dashboard with a high-resolution, Natural Earth 1:50m SVG world map, neon dot-matrix continents, attack-route visualization, threat filters, incident feed, network health, and response metrics. The current interface uses realistic local mock data and does not require a backend.

## Development

Install dependencies and start the Vite development server:

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.

## Deploy to GitHub Pages

The `Deploy GitHub Pages` workflow builds and deploys the site whenever changes are pushed to `main`. In the repository's **Settings → Pages**, select **GitHub Actions** as the build and deployment source. After the workflow succeeds, the site is available at <https://dellongrant97-dev.github.io/Cyber-Threat-Map/>.
