# Oversight Shift

An AI Safety game built for Mangrove's Game Night Hackathon (Sept 25–27, 2026).
Live at ianrmackinnon.com/play/oversight-shift/

## Layout

- `DESIGN.md` — how the game works and why
- `docs/` — how it was made: the AI use log and the pre-build ideation note
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

## Hosting

`npm run build` produces a static site in `dist/` for the subpath `/play/oversight-shift/`; to serve it elsewhere, change `base` in `vite.config.ts`. Everything is bundled (no third-party requests, no inline scripts, self-hosted fonts), so it runs under a strict Content-Security-Policy.

Play counts: when a run starts and ends, the production build requests `ping.gif` from the same site with the mode, difficulty and result in the query string (plus a random cache-buster), so plays can be counted from the server's request log. No cookies, no identifiers.

## License

- **Code:** [MIT](LICENSE).
- **Content** (the text and data in `src/data/` and `docs/`: cards, scenarios, glossary, tool explainers, events, research tree): [CC BY-NC-SA 4.0](LICENSE-CONTENT). You're welcome to use and adapt it for teaching and other non-commercial work, with credit to Ian Mackinnon, and to share adaptations under the same license. For commercial use, ask first.
- **The name "Oversight Shift"** isn't licensed. If you build on the game, please give your version a different name.
- **Fonts:** IBM Plex Sans and Mono, under the SIL Open Font License, bundled from `@fontsource`.
- **Sources** cited in the content belong to their authors; the game summarizes and links to them.

The situations on the cards are fiction: every person, organization, address and number is made up. The research and incidents the game cites are real.

How the game was made, including AI use, is in [docs/AI_USE_LOG.md](docs/AI_USE_LOG.md) and on the in-game "How this was made" screen.

