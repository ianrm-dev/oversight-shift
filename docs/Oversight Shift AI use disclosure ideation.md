# Oversight Shift: AI use during ideation and planning

**Entrant:** Ian Mackinnon
**Event:** Mangrove Game Night hackathon (kickoff Sep 25, 2026)
**Tool:** Claude (Anthropic), used in a Claude Cowork conversation from Sep 23 to Sep 25, 2026
**Scope of this note:** ideation and planning only. No game code was written in this conversation. Code written during the build with Claude Code is disclosed separately in the game's "How this was made" section.

## What I brought

- The decision to enter, and the first concept: a roguelike, because AI safety is a never-ending contest where we get better over time and so does AI, with mechanics built around different threat models and the safety tools that counter them.
- The art and platform direction: text-forward, mathematical vector art and procedural animation drawn in code rather than image-model art, a browser game hosted on my own site. I raised the concern that itch.io's community is broadly hostile to AI-built games, which moved hosting to my site.
- The genre steer: management and event games like FTL and Game Dev Tycoon over action or physics, and my doubt that a Slay the Spire-style deckbuilder would be too random to teach anything.
- The choice of the Oversight Shift concept, and the request to ground it in real past and current research and incidents, escalating from a single model to agents to multi-agent systems.
- The requests for research on similar games and for a look-and-feel mock step before building.

## What Claude contributed

- **Rules and terms check:** read the event page, FAQ, and hackathon terms. Confirmed AI tools are allowed with disclosure and that entrants keep ownership of submissions. Noted that the rules don't cover pre-kickoff work, and recommended keeping pre-kickoff work to ideation and tool setup and disclosing anything prepared early.
- **Concept options:** proposed three focused directions (an AI-control inspection game, an AI lab race tycoon, and a specification-gaming puzzle) with tradeoffs, and recommended the inspection game, which I chose.
- **Design draft:** the day-by-day escalation arc, card and action structure (approve, audit, defer to a trusted model, resample), the usefulness and harm meters, and a between-day upgrade pick. I will revise these during the build.
- **Real-world grounding:** compiled a reference table tying each threat and tool to a paper or incident, opening and checking each source on Sep 25 (for example Greenblatt et al., AI Control, 2023; Bhatt et al., Ctrl-Z, 2025; Hammond et al., Multi-Agent Risks from Advanced AI, 2025; Meinke et al., in-context scheming, 2024; METR on reward hacking, 2025; AI Incident Database #1152).
- **Research on similar games:** ran a multi-source research pass on Papers, Please, Into the Breach, Slay the Spire, Balatro, FTL, Reigns, Return of the Obra Dinn, Orwell, existing AI-safety games, and educational-game research. It produced a report and a set of core-loop rules (fair, findable tells; a monitor score shown with its error; an audit that always tells the truth; immediate feedback on misses; most cards clean so the game trains judgment rather than paranoia).
- **Build planning:** recommended a web-native stack (Vite, TypeScript, SVG) and a hosting approach on my site, drafted a schedule for the 36-hour window with a cut list, and wrote starting prompts for Claude Code.

## How the work was split

The creative direction, concept choice, and final decisions are mine. Claude acted as a research assistant and design sounding board: it proposed options, gathered and checked sources, and drafted plans that I accepted, changed, or rejected. All in-game text will be reviewed by me for accuracy against the cited sources before submission.
