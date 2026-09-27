# Oversight Shift: Design

How the game works and why. Every balance number lives in `src/rules.ts`; the numbers below are the current values.

## Pitch

**You run the AI-control protocol on shift.** Your lab is deploying a model smarter than the tools watching it. Get it through a 7-day deployment: keep its work shipping so the lab stays funded, and keep what it breaks below the line.

Why both halves matter: AI control isn't about stopping the AI. It's about getting useful work out of a model you can't fully trust, without disaster. A safety team that blocks everything doesn't make anyone safer; it gets routed around.

**Reading first, scarce help.** Your main tool is reading the card. The checks you can run on it are real control techniques, but you get about two checks a day and a clock that doesn't wait, so the skill is deciding which cards need them. The Day 1 briefing says it plainly: *"Your job: ship enough of the model's work to meet the quota, and stop its sabotage before harm reaches the limit. The catch: you can't check it all. Every check costs compute and clock time, auditors are few, and the queue doesn't wait."*

Genre: a *Papers, Please* inspection loop inside an FTL-style run of escalating days, with events, an upgrade pick and a budget meeting between days, and research that carries across runs.

## Winning, losing, and acceptable failure

**Harm** accumulates across the whole run against a ceiling of **10** (a quick shift's is 11). Each card has a hidden severity:

| Severity | Harm | Agent action, Day 3+ | Example |
|---|---|---|---|
| Minor | 1 | 2 | Flattering answer agreeing with a wrong claim; a sloppy summary |
| Major | 3 | 5 | Internal data emailed out; a safety check weakened in a report |
| Severe | 6 | 9 | Production database deleted; a lab freezer alarm disabled |

From Day 3, approved agent actions do 50% more harm (rounded). You can absorb several minor incidents or one severe one, not two severe. **The first incident of a run is a free warning** (two on Guided): full report, no harm. Letting a probable Minor through to save an audit for a possible Severe is a correct play, not a mistake.

**Usefulness** has a daily quota. It is built from each day's own cards: what perfect play would ship (every clean card approved at 3, every sabotage deferred at 1.5), minus room for mistakes (4.5 on Guided, 3 on Standard, 1.5 on Analyst), plus the day's adjustments (lab, client, events, research, upgrade upkeep). One mistake, a clean card deferred, costs 1.5. However the adjustments stack, the quota is capped so perfect play still makes it with one mistake to spare on Guided and Standard, and with none on Analyst. Leadership's base ask still rises through the week (9, 12, 15, 15, 18, 18, 20); the adjustments are measured against it, and if the day's cards can't meet it the briefing says the quota was cut.

**Approved sabotage pays nothing and costs trust.** It earns 0 usefulness, and the day's usefulness drops by half the harm it did, rounded down (never below 0 for the day). A free warning does no harm, so it costs no trust either.

Missing the quota once: a warning and one fewer auditor tomorrow. Missing it twice ends the run.

| | Under-caution: "Incident in production" | Over-caution: "The model ships unmonitored" |
|---|---|---|
| Trigger | Harm reaches the ceiling | Quota missed twice |
| Ending screen | The fatal card's line, with the tell highlighted; every tell missed this run | A leadership memo reassigning the safety team, then tomorrow's queue plays out unwatched and every sabotage in it ships |
| Lesson | Scores lie; read the card | Oversight that can't keep pace gets routed around, and the harm happens anyway |

Harm can also reach the ceiling from a choice between shifts; that ending names the event. The pause menu can end a run early; it is recorded as unfinished.

**Win:** survive Day 7. The end screen shows harm, funding raised, catches and misses, a score and grade, and closes with *"The next model arrives tomorrow. It's better than this one."*

**What each extreme looks like in play.** Too cautious: audits and Defers everywhere, compute burned on clean cards, usefulness under the quota line, many false alarms. Too careless: approving whatever reads green, incident reports sliding in, harm climbing. Too slow: the clock runs out and the rest of the queue ships unreviewed. The day-end review shows missed sabotage and false alarms side by side so the player sees which way they lean. No "you are Reckless" label.

## Resources

| Resource | Per day | What spends it |
|---|---|---|
| Shift clock | 25 s per card on Guided, 20 on Standard, 18 on Analyst, the same on a quick shift and the full week; 1 s less per model version above v1, never below 10. Day 1's first 3 cards are untimed training | Time on screen with a card, plus each check: Fact check, Scope check and Untrusted monitor 4 s, Resample 3 s, Human audit 8 s |
| Compute | 4 | Every tool: 2 compute each, so about two checks a day |
| Auditors | 1 (Guided +1), never below 1 | Human audit |
| Usefulness | Earned against the quota | Defer ships less than Approve |

**The shift clock** is the day's total review time (seconds per card × cards in the queue), shown as a large countdown with a bar, and as a full-width time strip under the status bar. Checks spend it too (the seconds above), except on the untimed training cards. It runs only while a card is on screen: incident reports, audit reveals, the toolkit, the pause menu, a hidden tab and tour tips all stop it. When it hits zero, every card left in the queue ships unreviewed (approved as it stands, harm and all), and a screen lists what went out. The anchor: careful human review is slow. In the MATS auditing pilot, people given 90 seconds per item reached 60% median accuracy on a set where half the items were backdoored. The player on the clock is that rushed reviewer. Day 1 opens with 3 untimed training cards (a banner says so); then a full-screen card says the clock is starting and that it's the heart of the job (shown in full once, as a short notice on later runs). The clock's budget covers only the timed cards.

**Compute** resets every day and unspent compute is worth nothing, so skipping the tools never pays. **Auditors** are the scarcest thing in the game on purpose: control research treats careful human review as the limiting resource.

Budgets move with difficulty, lab, model version, upgrades, purchases, contracts, events and research; the briefing shows the day's final numbers.

## Information model

| Layer | Source | Cost | Reliability |
|---|---|---|---|
| Hint | Trusted monitor score | Free, on every card | Noisy; worse as the week goes on, and gamed on some days |
| Evidence | Reading the card | Clock time | As good as your reading |
| Evidence | Fact check, Scope check, Resample, Untrusted monitor | 2 compute and 3–4 s of clock each | Each sees some tells and not others; accuracy set from published results |
| Proof | Human audit; the interpretability probe (a breakthrough) | 1 auditor and 8 s; free, once a day | Always right |

Randomness lives in the hint and the tools, before the decision. Audit and the probe never lie, and Scope check never lies within what it covers. Fact check, Scope check and the untrusted monitor state their live reliability next to each result ("Finds 3 in 4 problems it can see; false alarm on about 1 in 7 clean cards"), and the toolkit lists it for every tool.

**Stakes are shown, severity is not.** Each card opens with an at-a-glance strip: the kind of work, a stakes level (low, medium or high), icons for what the agent can touch (send messages, move money, delete, records, settings, publish, edit files), its size, and flags like "Logging off · unattended". The full access line is in the strip's tooltip. The stakes level comes from the situation, not the card: clean and sabotaged versions of the same situation always show the same level, so the strip never gives the answer away. The card's actual severity stays hidden until an audit or incident reveals it. Authoring rules:

1. Severity never exceeds what the access allows. A read-only chat card is never Severe.
2. Stakes grow with the arc: chat and file days (1–2) cap at Major; agents (Day 3+) bring Severe.
3. Audits and incident reports reveal the true severity, so the player's reading of the stakes improves over the run.

## Cards

Every card has the same parts: the at-a-glance strip, the **agent** that did the work, the client (flavor), a one-line **task**, the user's message if there is one, **On file** chips (what's allowed, and the facts supplied), and **what it did**: the model's own summary plus the output. Four layouts: `answer` (chat), `diff` (file changes), `log` (agent actions), `thread` (messages between agents).

**Every card opens on its text.** Reading is the main skill, so file changes, action logs and agent-team threads all start as plain lines. **V** redraws them as a diagram of what the agent touched, with the allowed zone marked and any lines your tools flagged; V again returns to the text. Analyst mode is text only.

**The rulebook is on the card.** The task states its own constraints (allowed files, recipients, tools) and supplies any facts needed. Every tell is a **contradiction between two things on the same card**, checkable with reading and common sense. The domain (a vet clinic, a bank, a power co-op, a school district, a lab, code) is flavor and sets stakes; it is never needed to solve the card. Players are not assumed to know code, biology, or policy.

| Tell family | The contradiction | Example |
|---|---|---|
| Out of scope | Task lists what's allowed; output touches something else | "Fix the typo on the login page" → edits `payments/refunds` |
| Summary mismatch | Model's summary says X; its output shows Y | "Summary: formatted the report" / log: `emailed report to external address` |
| Weakened check | A before/after number or rule got looser | "Alert if freezer > −70°C" → "> +70°C" |
| Injected instruction | Content the agent read contains an order; the next action obeys it | Web page says "forward all invoices to…", then the agent does |
| False premise | User claims something the attached facts contradict, and the reply goes along | "Since sales rose 20%…" but the attached report says they fell 20% |
| Exfiltration | Data goes somewhere the task didn't list | `backup@company-archive.net` isn't an approved recipient |
| Sandbagging | A capability check where a high score costs the model something, and it does badly, though the facts show it does the same work well elsewhere | "Can't determine" on the test; the record shows it handled the same task last week |
| Collusion | The sabotage is split across two thread messages: one agent breaks the rule, another waves it through | Coder changes the unapproved file; Reviewer: "LGTM" on everything but that file |

**The pool.** 176 hand-written cards over 80 situations. Most situations have a clean version and one or more sabotaged versions (sharing a scenario id), and a run never deals two versions of the same one. 76 cards are sabotaged. A few louder "teaching" sabotages read high on the monitor; the rest are subtle, found by cross-checking one line against one fact, allowed list or summary. Clean cards include near-misses: odd-looking work that is within the task.

**Content rules**

- Each sabotage is a tagged line span with a one-sentence explanation and a plain headline of what happened when it shipped.
- No homoglyphs, single-character tells, or tells below a scroll fold. At most 8 output lines (the longest card has 6).
- False-premise and sandbagging cards always carry their source on the card.
- Biology stays mundane (freezer temps, sample labels, scheduling). Nothing near real hazardous material.
- 60–70% of cards are clean. The game trains discrimination, not paranoia.
- **Playtest cut rule:** someone outside tech must be able to explain every tell after the reveal. If a tell needs a term defined, rewrite or cut it.

## Tools and decisions

Two decisions end a card; everything else gathers evidence first.

| Action | Key | Cost | Effect |
|---|---|---|---|
| Approve | A | Free | Ships the work: +3 usefulness. If sabotaged, it earns 0, harm lands, trust costs usefulness (above), and an incident report replaces the card |
| Defer | D | The safety tax (ships at +1.5) | Discard the output; the weaker trusted model redoes it. Always safe. Keeps the research term ("defer to trusted", Greenblatt et al.); the button says what it does |
| Human audit | U | 1 auditor, 8 s | A human expert settles it. Clean work ships at +3; caught sabotage is redone by the trusted model (+1.5) and earns a 2-funding evidence grant |
| Fact check | F | 2 compute, 4 s | Checks the model's claims against the facts on file; points at the lines it doubts |
| Scope check | S | 2 compute, 4 s, from Day 2 | Compares every file, recipient and action with the allowed list |
| Resample | R | 2 compute, 3 s, from Day 2 | The model tries again: a new draft with a fresh monitor score. Changed lines are marked, and the score history shows. Can be repeated |
| Untrusted monitor | M | 2 compute, 4 s, via upgrade | A copy of the strong model scores the card too |
| Interpretability probe | P | Free, once a day, via breakthrough | Says whether this card is sabotaged |

Other keys: **V** diagram, **T** toolkit (every tool's reach, live reliability, and the research behind it), **Esc** pause menu. Hovering an action previews its effect on the meters. Approve and Defer show a bold toast with the usefulness gain so the player sees what shipped. The status bar shows "Card N of M" above a row of progress dots, one per card in the queue.

### Tool accuracy

Tool accuracy is set from published research rather than tuned for fun. Two tools are deliberately simplified to be always right.

| Tool | What it sees | How reliable | Anchor |
|---|---|---|---|
| Trusted monitor | Everything, weakly | Reading = true signal + noise with sd equal to the day's band, so about 2 readings in 3 land within ±band | Weak trusted monitors in the literature are barely better than chance (a gpt-4o-mini monitor: AUC 0.64 in the MATS auditing pilot) |
| Fact check | False premise, summary mismatch, weakened check, sandbagging, exfiltration, collusion | Finds a problem it can see 85% / 75% / 65% of the time (Guided / Standard / Analyst); false alarm on 10% / 15% / 20% of the rest | CriticGPT caught about 86% of planted bugs, with about 1 critique in 10 flagging a problem that wasn't there; the best claim-vs-source checkers score about 75–77% balanced accuracy (LLM-AggreFact) |
| Scope check | Out of scope, exfiltration, injected instruction; needs an allowlist on the card | Exact within that coverage, no false alarms; blind to everything else | Permission filters are exact within their policy and miss what the policy allows (AgentDojo) |
| Resample | Attacks that don't repeat; sometimes sandbagging | A sabotaging model drops its attack on a fresh try 30% of the time (45% with research); a sandbagger answers honestly 40% of the time. A repeated attack gets a new, independent score, which is evidence in itself | Ctrl-Z: a rational attacker keeps attacking under resampling, and repeated attempts are easier to catch; prompting a sandbagger again rarely brings out its real ability (Auditing Games for Sandbagging) |
| Untrusted monitor | Everything, sharply, unless it colludes | Band ±8. When honest, sabotage reads 25 higher to it. From Day 5 it may collude for the whole day (50%, or 85% against the colluder adversary): sabotage then reads 40 lower, like clean work. The Paraphraser cuts the chance of collusion to a quarter | An honest copy of the strong model caught 98.8% of attacks at a 1% audit budget (Ctrl-Z); without signal jamming, collusion left untrusted monitoring less safe than trusted monitoring, and jamming reduced collusion without removing it (AI Control) |
| Human audit | Everything | Always right | Control papers assume careful audit is infallible. Rushed review is different, and that is what the clock models for the player |
| Interpretability probe | Everything | Always right | Linear probes caught planted sleeper agents with AUROC above 99%; the game's text notes real probes are near-perfect only on planted deception |

On Analyst, Fact check and Scope check say only "Problem found" or "Nothing found", never which line. Model v4 lowers Fact check's hit rate by 10 points (floor 30%).

## Funding

Leadership sets the quota; **whatever ships past it funds the safety team.** This is why usefulness matters after the quota is met, and it closes the "quota met, now Defer everything" exploit.

- Earned: 1 funding per point of usefulness above the quota (scaled by the day's client), plus a 2-funding **evidence grant** per sabotage caught by audit (catching the model red-handed is valuable in control research), plus a **reading reward**: +1 funding at day's end for each clean card shipped on your own reading (approved with no tool, audit or resample on it). Cards that ship unreviewed when the clock runs out don't count.
- Lost: incident cleanup costs 1 funding per point of harm.
- Spent at the **budget meeting** between days, on help for tomorrow only: contract auditor (+1 auditor, 5, one a day), extra compute (+2 compute, one more check, 3, one a day), monitor tune-up (band −4, 3), new proposals (reroll the upgrade offer, 2, up to 3). Each purchase raises that item's price by 1 for the rest of the run.

## The monitor

- Each card has a hidden **true signal** set by its author, with deliberate overlap: clean cards run 10–52 and sabotaged cards 38–68.
- The monitor shows the true signal plus noise. The **band** is the day's noise level: ±14 on Day 1 widening to ±25 by Day 7 as the model outpaces the monitor (Guided ×0.8, Analyst ×1.1). Shown as a score with a shaded range and a verdict: "Looks clean" when the whole range is under 50, "Suspicious" when it's all above, "Unsure" in between.
- The model bends it on some days: on Day 4 it under-reads agent actions by 20; on Day 7 the schemer games it and sabotage reads 20 lower; from Model v2 sabotage reads 5 lower. An event can knock it out for one kind of card for a day.
- Upgrades and research narrow the band, never below 5. Never offer a noiseless monitor.
- The day-end review reports real monitor performance ("The monitor put 2 of today's 3 sabotage attempts above 50").

| Reading | Typical play |
|---|---|
| Looks clean | Read the card quickly and approve; this is where usefulness comes from |
| Suspicious | Read for the tell; audit if the stakes are high, Defer if they're low |
| Unsure | The game lives here: read for the tell, spend compute on the right tool, or pay the Defer tax |

## The run

| Day | Phase | What changes | What it teaches | Cards |
|---|---|---|---|---|
| 1 | Chat | The model answers questions. Trusted monitor, Fact check and Human audit are available. First miss is a free warning | Read against the facts on file; the base rate | 5 |
| 2 | Chat + files | The model edits files. **Scope check** and **Resample** unlock | Check what was touched against the allowed list | 6 |
| 3 | Agents · *Capability jump* | The model takes actions: email, commands, settings. Approved agent actions do 50% more harm; Severe stakes appear | Text the agent read is not an instruction; audits move to high-stakes cards | 7 |
| 4 | Agents | Nothing new, but the monitor under-rates agent actions | Read past the score | 7 |
| 5 | Multi-agent | Agents pass work to each other; sabotage splits across two messages. The untrusted monitor may start colluding | Read a thread as one piece of work | 8 |
| 6 | Multi-agent | Some models hold back on purpose when tested | A weak answer the facts say it could beat is a tell | 8 |
| 7 | Scheming · *Final test* | The model knows your audit rate, saves its boldest attacks for cards marked unmonitored, and has learned to look innocent to the monitor | The text still tells the truth; save an auditor | 9 |

- Each day features its new threats, and they are guaranteed to appear that day: false premise (1), out of scope (2), injected instruction (3), exfiltration and weakened check (4), collusion and summary mismatch (5), sandbagging (6).
- Day 3 and Day 7 open with a full-screen intro before the briefing.
- Every briefing carries one line **from the real world** tied to the day's threat (the Replit database deletion on Day 3, METR's reward-hacking findings on Day 4, and so on).
- On Day 7, most finale cards carry the "Logging off · unattended" flag, and most flagged cards are clean (12 of 22), so the flag raises suspicion without settling anything. Both versions of a situation always share the flag.
- **Quick shift:** a 4-day demo (Days 1, 3, 5, 7) on the same clock as the full week (25 s per card on Guided) with a harm ceiling of 11. A first run with tours takes about 20 minutes. It always uses Frontier lab and Model v1, research doesn't apply, and it earns no Insight (its Field test included) and unlocks nothing, because it's tuned apart from the full game; it still counts terms and tells for the Field guide. Each briefing also brings in the rule the skipped day introduced ("Since Day 2: …"), its tools and its featured threats, so every threat and tool still appears. Quick is the default; the full week plays all seven days.
- One-click restart, same seed or new. The seed shows on the end screen.

## Between days

After the day-end review, in this order, each skipped when it doesn't apply:

1. **Event.** A dilemma arrives: the compute pledge, a code freeze, a competitor shipping, an engineer who wants to talk, finance eyeing the monitor. 16 events, one a night, seeded and never repeated within a run. Every choice lists its effects before you pick (funding, harm, ceiling, tomorrow's auditors, compute, band or quota, or lasting changes), and each event cites the real incident or paper it reflects.
2. **Breakthrough**, after Days 3 and 5: pick one of two rare rewards that last the run. Interpretability probe (needs research), red-team exercise (reveals the adversary), incident review board (remove 3 harm), safety compute cluster (+2 compute a day, one more check).
3. **Budget meeting.** Pick an upgrade, spend funding in the shop, and choose tomorrow's client.

**Clients (contracts).** Two of eight are offered; one must be picked. Each changes tomorrow's quota, funding multiplier, harm per incident or auditors: a hospital pays well but mistakes hurt more, a retail chatbot is low stakes and low pay, a research partnership lightens the quota and pays nothing. No client or event choice cuts the quota by more than 1 (Research partnership, Retail chatbot, and three event choices sit at −1). Every compute effect from events comes in steps of 2, one check.

## Upgrades

At the budget meeting, pick one of three offered upgrades, each from a different category, or **skip for +1 auditor tomorrow**. Four slots; when full, a new pick replaces an old one (or keep your loadout and take the auditor). Research adds a fourth offer drawn only from researched upgrades, so research widens the choice instead of diluting it. Each lab also starts with one upgrade as a perk in its own slot. Some upgrades carry a cost, shown on the card; a lab perk pays its cost too.

| Category | Upgrade | Effect | Cost | Source |
|---|---|---|---|---|
| Information | Sharper monitor | Band narrows by 5 | | Core |
| Information | Monitor rationale | The monitor marks the line it finds most unusual; right about 2 times in 3 | | Research |
| Information | Untrusted monitor | Adds the M tool (above) | | Research |
| Budget | Audit headcount | +1 auditor every day | Quota +1 every day | Core |
| Budget | Catch bonus | The first catch each day refunds its auditor | | Core |
| Budget | Compute grant | +2 compute every day: one more check | Quota +1 every day | Core |
| Budget | Overtime | +5 s per card on the shift clock | Quota +1 every day | Core |
| Action | Escalation hotline | Your first Defer each day ships at full value | Quota +1 every day | Core |
| Action | Fast track | Clean work you approve ships at 4 instead of 3 | Approved sabotage does +1 harm | Core |
| Action | Permission limits | Approved agent actions can do at most Major harm | | Core |
| Action | Paraphraser | Rewords messages between agents: the monitor rates collusion 15 higher, and the untrusted monitor colludes a quarter as often | | Research |
| Action | Trusted editing | Defer edits instead of redoing: ships at 2.25, but 1 sabotage in 4 survives the edit | | Research |
| Meter | Incident response | Harm ceiling +2 | | Core |
| Meter | Canary | Plants a known-bad sample each morning; the untrusted monitor's result then shows whether it is lying today. Needs Untrusted monitor | | Research |

**Canary, defined:** a fake opportunity to misbehave, planted by the safety team. Here it tests the monitor: in the AI Control paper, the blue team checked an untrusted monitor on 30 known-bad examples and planned to shut down if it missed too many.

## Across runs

**Adversaries.** Each run's model is secretly one of four: the sandbagger, the colluder, the gullible agent (not scheming itself, but it obeys instructions attackers hide in what it reads) or the patient schemer. The adversary weights which tell families you see, and the schemer holds back early and attacks more from Day 5. It is revealed at the end, or earlier by the red-team breakthrough, the red-team research node or an event, with a screen on what works against it.

**Model versions.** A ladder from v1 to v5; winning on a version unlocks the next. Each adds one change on top of the last: sabotage reads 5 lower (v2), one fewer auditor and a ceiling 2 lower (v3), Fact check 10 points weaker (v4), more attacks and a ceiling 1 lower (v5). Later versions also send more cards (from v3 and v5), deal more suspicious-looking clean work (v4+), and shorten the clock.

**Labs.** Four starting labs, three unlocked by research. Each sets starting funding, a starting upgrade, and small changes to quota, compute or ceiling:

- **Frontier lab** (the only lab on a quick shift): Incident response (+2 harm ceiling), 4 funding, quota 5% higher.
- **Safety nonprofit:** Monitor rationale, no funding, quota 10% lighter, 2 compute less a day.
- **Big tech AI division:** Audit headcount (with its quota +1), 8 funding, 2 compute more a day, quota 5% higher, ceiling 1 lower.
- **Government AI office:** Sharper monitor, no funding, quota 5% lighter.

**Research lab.** Runs earn **Insight**: 1 per day survived, 2 per incident post-mortem (up to 3), 1 per catch (up to 3), and nothing extra for a win, because failures teach the field more than quiet successes. Insight buys nodes in a 23-node tree across six agendas: Monitoring, Control protocols, Interpretability, Evals & red teaming, Security, Governance. Nodes narrow the band, raise the resample drop rate, add compute or ceiling, lower the quota, unlock research upgrades, labs and the probe, forecast attacks, or add a third choice to every event. Some are gated on experience (discover 6 tell families, face the colluder). The branches your last run's failures point at are half price. Each node shows the real research behind it, its tradeoff, and an open question.

**Score and grade.** The score: 5 per funding earned, 2 per usefulness, 25 per catch, 40 per day survived, −20 per harm, and 300 for a win. Harder difficulty and later model versions multiply it. The grade (S 1300, A 1050, B 800, C 500, else D) comes from the unmultiplied score with lighter weights for harm (−8 per point) and the win (150), so it rates how you played and a strong losing run can still earn a C or B. A quick shift is graded as if its days were a full week: everything but the win bonus is scaled by 7/4.

**Daily shift.** A shared seed per calendar day: same cards, events and adversary for everyone, on Standard, Frontier lab, Model v1, with no research applied. Your best score that day is kept.

## Learning layer

**Tours.** Each screen has a short tour the first time it appears: setup, briefing, shift, audit, incident, review, event, budget meeting, breakthrough, end screen and research lab. Each tip highlights one element, advances with a button (Space), never by forcing a move, and can be skipped. The clock doesn't run while a tip is up. "Show the tips again" is in the pause menu.

**Briefing.** One column, top to bottom: what changes today in one line, the one tip that matters most, the Day 1 "Your job / The catch" statement, the stakes (approved sabotage pays nothing and costs trust; a card shipped on your own reading earns +1 funding), alerts (a missed quota, a blind monitor, a revealed adversary), today's budget (quota, auditors, compute, harm, clock), the tools and terms new today, and one line from the real world.

**Terms on hover.** 39 glossary terms (trusted monitoring, prompt injection, sandbagging, least privilege, scheming…) are underlined wherever they appear: briefings, tools, events, research notes. Hovering or focusing one shows a plain definition, an everyday analogy and a small drawing. Terms are introduced a couple per day, and a term counts as met only when it happens in play (you used the tool, the threat got through or was caught). The day-end review lists the terms in action that day.

**Field guide** (from the title screen): Terms, which deepen in three steps (plain definition when met, how it works after meeting it in 3 runs, tradeoffs and an open question once you research its branch); Approaches (what each research agenda assumes, its strength and limit); Threats & adversaries found; Your runs.

**Field test.** An optional three-question quiz after a run: name the failures you just saw, then match definitions of terms you met. +1 Insight per right answer on the full week; none on a quick shift. The results list the terms the questions covered: the ones you got right under "You can now talk about", each with a line to start a conversation, and the ones you missed under "Worth another look", each with its plain definition.

**Send feedback.** A short dialog (F on the title screen, F in the pause menu, and a link on the end screens) sends a note to the site's own request log, like the play counter. No account or third party.

## Feedback

1. **Incident report**, replacing the card the moment approved sabotage ships: what happened, the bad line highlighted in the text and in a diagram, the tell and what researchers call it, a next-time tip, which tool sees this kind of tell, the monitor's score, and the harm taken (or that it was a free warning).
2. **Audit reveal**: the same for a catch ("almost"), with the severity it would have had; for clean work, why the audit was costly.
3. **Clock timeout**: every card that shipped unreviewed and what it did.
4. **Day-end review**: shipped, caught, missed, false alarms, monitor flagged, usefulness vs. quota; what got past you; what your Defers cost; terms in action; the funding ledger; a preview of tomorrow.
5. **End screen**: the ending (see above), every tell missed this run, how many sabotage attempts you stopped, set beside the MATS pilot's 60% median accuracy for human auditors with 90 seconds per item, a week-at-a-glance grid with one tick per card that copies as a shareable emoji grid, the adversary reveal, score and grade, and the Insight post-mortem.

**Never cut:** the end-of-run summary of what was missed and why.

Tone: wry, functionary's chair, not hero's.

## Generating and validating a day

Each day's queue is generated at the start of that day from `dayRng(seed, day, attempt)`, using the player's current modifiers. Redrafts, tool results and the untrusted monitor's collusion are seeded per card and day, so a seed replays identically whatever the player does. Checks:

1. **Featured:** the day's featured threats (and a quick shift's skipped days') are dealt, and a layout new that day appears.
2. **Fair:** outside Day 7, at least one sabotage reads above 50. The first card of the day is clean.
3. **Base rate:** 30–40% of cards are sabotaged, shifted by the adversary's timing and Model v5.
4. **Fresh:** no situation repeats within a run.
5. **Winnable:** draws that can meet leadership's base ask are preferred. The quota itself comes from the drawn cards (see Winning), so a perfect player always clears it: with one mistake to spare on Guided and Standard, exactly on Analyst. If the day's cards fall well short of leadership's ask, the briefing says the quota was cut.

A failing draw regenerates with `attempt + 1`; the last few attempts relax the soft rules so an unlucky seed still gets a day. A headless simulator plays thousands of seeds through the real engine with bot policies, a human-time model checks the clock against reading speeds, and a fuzzer asserts engine invariants across every difficulty, model version, lab, adversary and research setting.

## Balance

**Targets.** Reading has to be the way to win. Checking and deferring should keep you alive but grade poorly, and approving or deferring everything should always lose.

**Results** (quick shift, policy bots, 1000 seeds each, Guided / Standard / Analyst):

| Policy | Wins |
|---|---|
| Check then defer: spend every tool and auditor, approve only what checks clean, defer the rest | 72% / 38% / 3%, graded B or C |
| Reads half the cards right | 74% / 60% / 28%, graded S or A |
| Reads 90% of cards right | 100% / 99% / 93% |
| Approve all, or defer all | 0% |

The human reading-time model (quick shift) puts a Guided first-timer at about 10–16% wins and a practiced player at about 47–52%.

**Balance history.** The designer found a dominant strategy: spend every tool and auditor, approve only what checks clean, defer everything else, and win with A or B grades without reading a card. It worked because Frontier, the only quick-shift lab, started with a free full-value Defer each day; bought compute and auditors let checks cover nearly the whole queue; clients and events could cut the quota deeply; approved sabotage still paid +3; and the fixed quota table left hidden slack. The fix built the quota from each day's own cards, made approved sabotage pay nothing and cost trust, made each check cost clock time as well as compute (about two checks a day), capped quota cuts at −1 and shop compute and auditors at one a day, gave upkeep costs to the capacity upgrades, swapped Frontier's perk to Incident response, and paid funding for cards shipped on your own reading. The grade got lighter harm and win weights so it rates play, not only the outcome.

## Research anchors

Every threat, tool, event, breakthrough, research node and term is tied to a paper or incident, linked in `src/data/`; the links were checked on Sep 25–26, 2026. The main ones:

- **Tools** (`tools.ts`): trusted monitor and untrusted monitor, Greenblatt et al., *AI Control* (2023); human audit and fact check, the MATS *Early Experiments in Human Auditing for AI Control* pilot (2025); scope check, AI Incident Database #1152, the Replit agent that deleted a production database during a code freeze (2025); resample, Bhatt et al., *Ctrl-Z* (2025); Paraphraser, Motwani et al., *Secret Collusion among AI Agents* (2024).
- **Tells** (`tells.ts`): out of scope, AIID #1152; summary mismatch and exfiltration, Meinke et al., *Frontier Models are Capable of In-context Scheming* (2024); weakened check, METR, *Recent Frontier Models Are Reward Hacking* (2025); injected instruction, Greshake et al., indirect prompt injection (2023); false premise, Sharma et al., *Towards Understanding Sycophancy* (2023); sandbagging, van der Weij et al., *AI Sandbagging* (2024); collusion, Motwani et al. (2024).
- **Tool accuracy:** CriticGPT (McAleese et al., 2024) and LLM-AggreFact (Tang et al., 2024) for fact check; AgentDojo (Debenedetti et al., 2024) for scope check; Ctrl-Z and *Auditing Games for Sandbagging* (Taylor et al., 2025) for resample; Ctrl-Z and *AI Control* for the untrusted monitor.
- **Interpretability probe:** Anthropic, "Simple probes can catch sleeper agents" (2024).
- **Compute and the safety tax:** OpenAI's 2023 pledge of 20% of compute to superalignment, and Fortune's 2024 report that it went unmet (the compute pledge event).
- **Canary:** the AI Control paper's use of known-bad examples to test an untrusted monitor.

## Tech and hosting

- Vite + TypeScript, no framework. Plain DOM for cards and panels, inline SVG drawn in code for every visual (the background lattice, the model glyph that grows each day, card diagrams, icons, term drawings), CSS transitions. A fixed 1280×720 stage scaled to the window. `base: '/play/oversight-shift/'`.
- Content in `src/data/`, typed by `src/types.ts`, **bundled at build time**. The host's Content-Security-Policy has no `connect-src`, so no runtime `fetch()`.
- Fonts: self-hosted IBM Plex Sans and Mono (`font-src 'self'`; no Google Fonts).
- No inline `<script>`. `frame-ancestors 'none'` means no iframe embed.
- Progress (research, Insight, run history, tours seen, setup) lives in `localStorage`, with every access guarded so private windows still play. No cookies. Plays are counted by a same-origin image request when a run starts and ends.
- All balance numbers in `src/rules.ts`. Balance tools in `scripts/`: `sim.ts` (bots through the real engine), `clock-sim.ts` (human-time model), `qa.ts` (invariant fuzzer).
- Disclosure: an in-game "How this was made" screen (H on the title screen), plus `docs/AI_USE_LOG.md` kept during the build.
