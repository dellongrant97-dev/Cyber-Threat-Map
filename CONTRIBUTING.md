# Contributing

Thanks for helping improve Cyber-Threat-Map. Contributions should keep the dashboard defensive, source-attributed, and honest about what public snapshots can and cannot establish.

## Before opening a pull request

1. Fork the repository and create a focused branch.
2. Install the locked dependencies with `npm ci`.
3. Run `npm test` and `npm run build`; include any relevant manual keyboard/mobile checks in the pull request description.
4. Keep changes small, explain user-visible behavior, and update the README when source behavior, setup, configuration, or limitations change.

Pull requests targeting `main` run the tests and production build in GitHub Actions. Pull requests are not deployed.

## Data and security requirements

- Do not fabricate threat events, timestamps, categories, confidence, attribution, or historical records. Keep provider publication, dashboard retrieval, and observation times distinct.
- Keep provider attribution, applicable licenses/terms, rate limits, error states, and privacy implications visible in documentation and the interface.
- OpenPhish Community Feed use is restricted by its [terms](https://openphish.com/terms.html) to personal, academic, or independent research. Do not use it for organizational business/security operations without prior written consent.
- Do not add API keys, credentials, private indicator data, or secrets. Vite `VITE_` variables are public in built assets. A provider requiring protected credentials needs a separately designed backend, not a frontend secret.
- Avoid new dependencies unless they materially solve the task; document their purpose and check their maintenance and license.
- Preserve GitHub Pages compatibility. Do not add scanning, probing, exploitation, or other unauthorized network behavior.

## Scope and implementation

The application is a static React/Vite site; data adapters and UI are in `src/`, with pure data and cache behavior tested under `tests/` using Node's built-in test runner. Prefer focused tests for data normalization, validation, timestamps, cache behavior, and explicit failures when changing these areas.

For visual changes, retain responsive layouts, keyboard access, visible focus, reduced-motion support, readable contrast, and accurate labels. Include a short manual verification note when automated tests cannot cover the interaction.

## Reporting a security issue

Do not include credentials, private indicators, or exploitable details in a public issue. Use GitHub's private vulnerability reporting for this repository if enabled; otherwise contact the maintainers privately through a channel listed on the repository profile.
