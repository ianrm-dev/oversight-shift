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

## License

- **Code:** [MIT](LICENSE).
- **Content** (the text and data in `src/data/` and `docs/`: cards, scenarios, glossary, tool explainers, events, research tree): [CC BY-NC-SA 4.0](LICENSE-CONTENT). You're welcome to use and adapt it for teaching and other non-commercial work, with credit to Ian Mackinnon, and to share adaptations under the same license. For commercial use, ask first.
- **The name "Oversight Shift"** isn't licensed. If you build on the game, please give your version a different name.
- **Fonts:** IBM Plex Sans and Mono, under the SIL Open Font License, bundled from `@fontsource`.
- **Sources** cited in the content belong to their authors; the game summarizes and links to them.

How the game was made, including AI use, is in [docs/AI_USE_LOG.md](docs/AI_USE_LOG.md) and on the in-game "How this was made" screen.

