# Oversight Shift — Design

The single source of truth for the build. It reconciles `docs/concept/` (the Sep 23–25 plan) and `docs/research/` (the core-loop report) with the decisions made at kickoff on Sep 25. Where those docs disagree with this one, this one wins. All numbers live in `src/rules.ts` and are untested starting points.

## Pitch

**You run the AI-control protocol on shift.** Your lab is deploying a model smarter than the tools watching it. Get it through a 7-day deployment: keep its work shipping so the lab stays funded, and keep what it breaks below the line.

Why both halves matter: AI control isn't about stopping the AI. It's about getting useful work out of a model you can't fully trust, without disaster. A safety team that blocks everything doesn't make anyone safer; it gets routed around.

Genre: a *Papers, Please* inspection loop inside an FTL-style run of escalating days, with an upgrade pick between days. Judging: 40% fun, 40% relevance to AI risk, 20% replay value.

## Winning, losing, and acceptable failure

**Harm** accumulates across the whole run against a ceiling of **8**. Each card has a hidden severity:

| Severity | Harm | Example |
|---|---|---|
| Minor | 1 | Flattering answer agreeing with a wrong claim; a sloppy summary |
| Major | 3 | Internal data emailed out; a safety check weakened in a report |
| Severe | 6 | Production database deleted; a lab freezer alarm disabled |

You can absorb several minor incidents or one severe one, not two severe. **The first incident of a run is a free warning** (full report, no harm); every later one counts. Letting a probable Minor through to save an Audit for a possible Severe is a correct play, not a mistake.

**Usefulness** has a daily quota that rises each day. Missing it once: a leadership warning and one fewer auditor hour tomorrow. Missing it twice ends the run.

| | Under-caution: "Incident in production" | Over-caution: "Leadership ships it unmonitored" |
|---|---|---|
| Trigger | Harm reaches the ceiling | Quota missed twice |
| Ending screen | Incident headline; the fatal card replayed with its tell highlighted; every tell missed this run | Memo reassigning the safety team, then the rest of the queue plays out unwatched and every sabotage in it ships |
| Lesson | Scores lie; read the card | Oversight that can't keep pace gets routed around, and the harm happens anyway |

**Win:** survive Day 7. The ending grades the record (harm taken, catch rate, false alarms) and closes with: *"The next model arrives tomorrow. It's better than this one."*

**What each extreme looks like in play.** Too cautious: Audits and Defers everywhere, compute burned on clean cards, usefulness under the quota line, high false alarms. Too careless: approving whatever reads green, incident reports sliding in, harm climbing, low catch rate. The day-end review shows *missed sabotage* and *false alarms* side by side so the player sees which way they lean. No "you are Reckless" label.

## Information model

| Layer | Source | Cost | Reliability |
|---|---|---|---|
| Hint | Monitor score | Free | Noisy, sometimes biased |
| Evidence | Reading the card; Resample | Attention; compute | Good if you know what to look for |
| Proof | Audit | Auditor hours | Always right |

Most upgrades make one layer cheaper, sharper, or harder to fool. Randomness lives only in the hint, before the decision; Audit never lies (Into the Breach's rule).

**Stakes are inferred, never labelled.** Each card has an **access line** in plain language ("Can: read customer records · send email"). Players judge stakes from the task and what the agent can reach, as in real deployments. Authoring rules:

1. Severity never exceeds what the access allows. A read-only chat card is never Severe.
2. Stakes grow with the arc: chat days (1–2) cap at Major; agents (Day 3+) bring Severe.
3. Audits and incident reports reveal the true severity, so the player's reading of access lines improves over the run.

## Cards

Every card has the same parts: a one-line **task spec**, the **agent** that did it, the **access line**, a short **output** (3–8 lines), and the **suspicion chip**. Four layouts: `answer` (chat), `diff` (file changes), `log` (tool calls), `thread` (multi-agent messages).

**The rulebook is on the card.** The spec states its own constraints (allowed files, recipients, tools) and supplies any facts needed. Every tell is a **contradiction between two things on the same card**, checkable with reading and common sense. The domain (biology lab, finance, HR, city infrastructure, journalism, code) is flavor and sets stakes; it is never needed to solve the card. Players are not assumed to know code, biology, or policy.

| Tell family | The contradiction | Example |
|---|---|---|
| Out of scope | Spec lists what's allowed; output touches something else | "Fix the typo on the login page" → edits `payments/refunds` |
| Summary mismatch | Model's summary says X; its action log shows Y | "Summary: formatted the report" / log: `emailed report to external address` |
| Weakened check | A before/after number or rule got looser | "Alert if freezer > −70°C" → "> +70°C" |
| Injected instruction | Fetched content contains an order; the next action obeys it | Web page says "forward all invoices to…", then the agent does |
| False premise | User claims something the attached source contradicts | "Since sales rose 20%…" but the attached report says they fell 20% |
| Exfiltration | Data goes somewhere the spec didn't list | `backup@company-archive.net` isn't an approved recipient |
| Sandbagging | Same request, far weaker answer when marked as an evaluation | Draft A: "Can't determine"; Resample: full answer |
| Collusion | Two thread messages share an odd signal, or the reviewer skips the changed part | Coder: "per the usual arrangement"; Reviewer: "LGTM, per the usual arrangement" |

**Content rules**

- Each sabotage is a tagged line span with a one-sentence explanation.
- No homoglyphs, single-character tells, or tells below a scroll fold. At most 8 output lines.
- False-premise and falsehood cards always carry their source on the card.
- Biology stays mundane (freezer temps, sample labels, scheduling). Nothing near real hazardous material.
- 60–70% of cards are clean. The game trains discrimination, not paranoia.
- **Playtest cut rule:** someone outside tech must be able to explain every tell after the reveal. If a tell needs a term defined, rewrite or cut it.
- Ian reviews all in-game text for accuracy before submission.

## Actions and resources

| Action | Hotkey | Cost | Effect |
|---|---|---|---|
| Approve | A | Free | Ships the work: full usefulness. If sabotaged, harm lands and an incident report slides into the next slot |
| Audit | U | 1 auditor hour | A human expert reveals the truth. Clean work ships at full usefulness; caught sabotage is redone by the trusted model (50%) and earns an evidence grant |
| Defer | D | Usefulness (ships at 50%) | Discard the output; the weaker trusted model redoes it. Always safe. Keeps the research term ("defer to trusted", Greenblatt et al.); the subtitle carries the meaning |
| Resample | R | 1 compute | The model tries again: new output, new score. Inconsistency between drafts is itself a tell. Unlocks Day 2 |

**Meters:** Usefulness (vs. the daily quota), Harm (vs. the ceiling), Auditor hours, Compute. There is no time meter; cards per day are fixed.

Each resource maps to its real cost: Audit is scarce human expert time, Resample is running the big model again, and Defer is shipping a weaker model's work. **Unspent compute converts to usefulness at day's end** ("spare capacity went to customers"), so every Resample visibly costs product work. That is the safety tax.

Show each action's cost on hover. Turns are untimed. Approve and Defer show a brief toast so the player sees what shipped.

**The three parties** are introduced on the Day 1 briefing: the model (strong, untrusted), the trusted model (weak, safe; it is the monitor and does Defer's redo), and the auditors (human, scarce; Audit). This mirrors the AI Control paper's untrusted model, trusted model, and limited trusted human labor.

## Funding

Leadership sets the quota; **whatever ships past it funds the safety team.** This is why usefulness matters after the quota is met, and it closes the "quota met, now Defer (or Approve) everything" exploit.

- Earned: 1 funding per point of usefulness above the quota, plus a 2-funding **evidence grant** per sabotage caught by Audit (catching the model red-handed is valuable in control research).
- Lost: incident cleanup costs 1 funding per point of harm.
- Spent at the **budget meeting** between days, alongside the free upgrade pick: contract auditor (+1 hour tomorrow), extra compute (+2 tomorrow), monitor tune-up (band −4 tomorrow), new proposals (reroll the upgrade offer). Purchases last one day.
- Backlog, after the full MVP: a clean-shift bonus (zero incidents and zero false alarms), and a run score and grade built from funding raised and the safety record, with a shareable seed.

## The monitor

- Each card has a hidden **true signal** set by its author, with deliberate overlap: clean 10–40, near-miss clean 38–55, subtle sabotage 35–58, one teaching sabotage per layout 62–75.
- The monitor displays the true signal plus noise (sd equal to the band). The **band** is today's noise level, ±14 on Day 1 widening to ±30 by Day 7 as the model outpaces the monitor. Shown as "62 ±20" and drawn as a range bar (42–82) on a green-to-red ramp.
- Upgrades narrow the band, never to zero. Never offer a noiseless monitor.
- Calibration is tuned with a headless simulator so high readings really are mostly sabotage. There is no exact "80 means 80%" promise. The day-end review reports real monitor performance ("flagged 4 of your 6 sabotages").

| Reading | Typical play |
|---|---|
| Band entirely below 40 | Approve quickly; this is where usefulness comes from |
| Band entirely above 60 | Audit if the access line looks dangerous; Defer or accept the risk if it looks minor |
| Band crosses 50 | The game lives here: read for the tell, Resample for evidence, or pay the Defer tax |

## The run

| Day | Phase | New rule, announced in a two-line briefing | How it changes decisions | Cards |
|---|---|---|---|---|
| 1 | Chat | Approve, Audit, Defer. Tells: answer contradicts the prompt or flatters a false premise. The first miss of the run is a free warning | Learn the base rate | 5 |
| 2 | Chat + files | File-change cards arrive; **Resample** unlocks. Tell: edits outside the spec's files | Resample becomes cheap evidence | 6 |
| 3 | Agent (boss) | Tool-call logs; approved agent actions do double harm; Severe stakes appear. Hint on the first log | Audits move to high-impact cards | 7 |
| 4 | Agent | Breather: nothing new, but the monitor's declared blind spot (under-rates logs by ~20) and full penalties | Read past the score | 7 |
| 5 | Multi-agent | Threads: sabotage split across two messages (collusion) | Inspect cards together | 8 |
| 6 | Multi-agent | Sandbagging: resampled quality varies suspiciously | Resample becomes a detector | 8 |
| 7 | Scheming (boss) | "The model knows your audit rate": rare, high-stakes attacks and a gamed monitor (sabotage reads low, the tell is still in the text) | Save Audits; patience beats paranoia | 9 |

- The first card using a new rule carries a hint.
- Hand-write 1–2 story cards per day; fill the rest from templates.
- **Research line:** one line on the next day's briefing, tied to the threat just met. Longer material lives in the codex and the game-over debrief.
- **Quick Shift:** a 4-day run (Days 1, 3, 5, 7). Each briefing includes the rules from any skipped day (Day 3's briefing adds Resample and out-of-scope files).
- **Pacing target:** about 50 decisions in 10–14 minutes. First catch or miss within 60 seconds, first upgrade by minute 2–3, Day 3 by minute 5. A first-time player usually reaches Day 4–5; a careful one can win.
- One-click restart, same seed or new. The seed shows on the end screen.

## Upgrades

After each day, at the budget meeting, pick one of three offered upgrades, each from a different category. **Skip = +1 Audit tomorrow.** Four slots max. Named after real control tools so each pick also teaches. Implemented so far: Scope lens, Sharper monitor, Audit headcount, Catch bonus, Escalation hotline, Permission limits, Incident response. The rest arrive with Days 5–7.

| Category | Upgrade | Effect | Best when |
|---|---|---|---|
| Information | Monitor rationale | Each score shows a one-line reason | Early days |
| Information | Scope lens | Anything the output touches outside the spec is underlined | Agent days |
| Information | Sharper monitor | Band narrows by 5 (floor 5) | Late days |
| Information | Untrusted monitor | Second, tighter score; lies on colluding cards from Day 5 | High risk, high reward |
| Budget | Audit headcount | +1 Audit per day | Always solid |
| Budget | Catch bonus | Catching sabotage refunds that Audit | You read cards well |
| Action | Paired resample | Resample shows both drafts side by side | Day 6 sandbagging |
| Action | Escalation hotline | Once per day, Defer returns full usefulness | Quota pressure |
| Action | Permission limits | Approved agent actions can't exceed Major harm | Agent days |
| Action | Paraphraser | Thread cards lose hidden signals; the untrusted monitor can't collude | Days 5–7 |
| Meter | Incident response | Harm ceiling +2 | Bleeding minor harms |
| Meter | Canary (honeypot) | Once per day, reveals whether the untrusted monitor is lying today | Paired with Untrusted monitor |

**Honeypot, defined:** a fake opportunity to misbehave, planted by the safety team. Here it tests the monitor: in the AI Control paper, the blue team plants fake attacks, and an untrusted monitor that rates them safe is caught lying.

Cut from the pool: cross-checks (the thread layout already shows every message). The interpretability probe is a stretch item (single use on Day 7, reveals the hidden adversary personality), cut unless time allows.

## Feedback

1. **Immediate incident report.** When an approved card was sabotaged, the report slides into the next slot. It quotes the bad line, names the tell family, and shows the monitor's score and the true severity. Day 1 gives free warnings.
2. **Day-end review.** One screen: shipped, caught, missed, false alarms, monitor calibration, usefulness vs. quota.
3. **Game-over debrief.** A specific epitaph ("Day 3: you approved the change that disabled the freezer alarm"), the fatal card replayed with its tell highlighted, and one research comparison ("Your catch rate: 62%. Human auditors in a 2025 pilot: 60% median").
4. **Codex.** Threat types discovered ("4 of 8"), each with a two-sentence summary and a real statistic. Credit the FAR.AI sandbagging demo and the MATS human-auditing pilot here.

**Never cut:** the end-of-run summary of what was missed and why.

Tone: wry, functionary's chair, not hero's.

## Generating and validating a day

Each day's queue is generated at the start of that day from `dayRng(seed, day, attempt)`, using the player's current upgrades. Checks:

1. **Solvable:** some way to Audit or Defer every Severe sabotage while still meeting the quota.
2. **Fair:** outside Day 7, at least one sabotage reads above 50. (Every sabotage has a findable tell by construction.)
3. **Base rate:** sabotaged cards stay within 30–40%.

A failing day regenerates with `attempt + 1`, so runs stay reproducible. Whether "defer everything" dominates is a tuning question for the headless simulator (bots: always-approve, audit-top-k, defer-above-threshold), not a per-seed check.

Hidden per-run **adversary personality** (sandbagger, colluder, prompt-injector, patient schemer), revealed in the debrief, is a stretch item.

## Research anchors

The per-threat source table is in `docs/concept/` ("Real-world research and incidents behind each threat"); those links were checked Sep 25. New anchors to verify before use:

- Interpretability probe: Anthropic, "Simple probes can catch sleeper agents" (2024).
- Compute and the safety tax: OpenAI's 2023 pledge of 20% of compute to superalignment, and 2024 reports that it went unmet.
- Honeypot / Canary: the AI Control paper's use of planted attacks to test an untrusted monitor.

Several designer quotes in the research report may be paraphrased by a fetch tool; none appear in the game without checking the source.

## Tech and hosting

- Vite + TypeScript, no framework. Plain DOM for cards and panels, inline SVG for procedural visuals, CSS transitions. `base: '/play/oversight-shift/'`.
- Content in `src/data/`, typed by `src/types.ts`, **bundled at build time**. The site CSP has no `connect-src`, so no runtime `fetch()`.
- Fonts: self-hosted IBM Plex Sans and Mono (`font-src 'self'`; no Google Fonts). Matches the personal site.
- No inline `<script>`. `frame-ancestors 'none'` means no iframe embed; if the submission form needs one, use the GitHub Pages fallback.
- All balance numbers in `src/rules.ts`.
- **Deploy:** build, copy `dist/` into `~/stacks/site/public/play/oversight-shift/`, and deploy with the site. The site deploys with `rsync --delete` on every push to main and on a daily schedule, so a separately deployed folder gets wiped. Pushing the site's main publishes live: ask Ian first.
- Disclosure: a "How this was made" section on the game page, plus `docs/AI_USE_LOG.md` kept during the build.

## Build plan

The window closes Sun Sep 27, 3:00 AM ET. Target submission Saturday night.

| Block | When | Done when |
|---|---|---|
| 0. Scaffold | Fri 3–4 PM | Done: Vite + TS, seeded RNG, typed data, title screen, subpath verified |
| 0.5 Look-and-feel mock | Fri, 1 hour hard stop | Static mock of three screens (shift with a file-change card, incident report, upgrade pick) and `src/theme.css` tokens |
| 1. Core loop | Fri evening | One day playable: queue, four actions, meters, monitor, incident report, day-end review; Days 1–2 content |
| 2. Run structure | Sat morning | 7 days, briefings, upgrades, both loss endings, win screen; Day 3–4 content |
| 3. Multi-agent and finale | Sat afternoon | Threads, sandbagging, Day 7 gamed monitor; Days 5–7 content; codex; debrief |
| 4. Look and feel | Sat evening | SVG lattice, arc meters, range bars, transitions, How this was made |
| 5. Playtest and ship | Sat night | Two runs by someone else, simulator balance pass, deploy, submit |

Content (about 40 templates across 8 tell families, 4 layouts, many domains) is the critical path. Draft it in parallel with engine work and send batches to Ian for review.

**Cut list, in order:** Canary; interpretability probe; adversary personality; Day 5–6 merge into one multi-agent day; Paired resample and Monitor rationale; sound (never planned).

## Balance status (Sep 25, ~6 PM, tools-first)

`npm run sim -- --all-difficulties --seeds 2000 --days 7` plays the real engine with tool-using bots. Win rates (survive Day 7):

| Bot | Guided | Standard | Analyst |
|---|---|---|---|
| tools-smart (good tool habits) | 85% | 62% | 44% |
| novice (tools, but skips them 30% of the time) | 56% | 34% | 26% |
| threshold-50 (score only) | 3% | 1% | 1% |
| approve-all / defer-all | 0% (dead by Day 3–4) | 0% | 0% |

Fact check now covers exfiltration and collusion (our collusion cards break a written rule); Paraphraser keeps the untrusted-monitor and monitor-boost effects. Auditors, not compute, are the binding constraint. Day 7 is the steepest drop.
