# AI use log (build phase)

Running log for the "How this was made" disclosure. Ideation and planning before kickoff are covered in `Oversight Shift AI use disclosure ideation.md`.

| When (ET) | Tool | What it did | What Ian decided or changed |
|---|---|---|---|
| Fri Sep 25, ~3:15 PM | Claude Code (Claude Opus 5.5) | Reviewed the three planning docs and the site's deploy setup; flagged contradictions and hosting constraints (rsync --delete, CSP) | Chose two-sided loss with varied harm severity; added the rule that cards must be solvable without domain knowledge |
| Fri Sep 25, ~3:45 PM | Claude Code | Proposed upgrade pool, monitor score model, day validation, compute resource, implicit stakes via access lines | Approved; asked for inferred (not labelled) stakes; defined the player's goal and failure modes |
| Fri Sep 25, ~4:00 PM | Claude Code | Scaffolded the Vite + TypeScript project (seeded RNG, typed data schema, title screen); wrote DESIGN.md reconciling the docs | — |
| Fri Sep 25, ~4:00–4:30 PM | Claude Code | Built the look-and-feel mock (`mock/index.html`: shift screen, incident report, upgrade pick), design tokens in `src/theme.css`, component styles in `src/ui.css`, and procedural SVG visuals (network lattice, model glyph that grows each day, arc meters). Checked its own work with headless-browser screenshots | Set the direction: follow the docs, maximise visual interest within good design practice; reviewing the mock |
