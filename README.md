# Oversight Shift

An AI Safety game built for Mangrove's Game Night Hackathon (Sept 25–27, 2026).
Live at ianrmackinnon.com/play/oversight-shift/

## Layout

- `docs/concept/` — game idea and design
- `docs/research/` — background research
- `src/` — game code (Vite + TypeScript, no UI framework)
  - `rules.ts` — every balance number
  - `rng.ts` — seeded randomness (one seed per run)
  - `types.ts` — content schema
  - `data/` — cards, upgrades, research notes (bundled, never fetched at runtime)
  - `theme.css` — colors, fonts, spacing tokens

## Develop

```sh
npm install
npm run dev        # http://localhost:5173/play/oversight-shift/
npm run build      # typecheck + build to dist/
npm run preview    # serve dist/ at the same subpath
```

## Deploy

The game ships inside the site repo. The site deploys with `rsync --delete` (on every
push to main and on a daily schedule), so anything deployed to the server separately
gets wiped.

```sh
npm run build
rm -rf ~/stacks/site/public/play/oversight-shift
mkdir -p ~/stacks/site/public/play
cp -r dist ~/stacks/site/public/play/oversight-shift
```

Then commit and push the site repo; pushing to main deploys live.

The site's Content-Security-Policy shapes the build: no runtime `fetch()` (no
`connect-src`), fonts must be self-hosted (`font-src 'self'`), no inline scripts, and
the page can't be embedded in an iframe (`frame-ancestors 'none'`).
