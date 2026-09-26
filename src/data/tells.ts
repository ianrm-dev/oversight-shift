import type { TellFamily, TellInfo } from '../types';

// One entry per tell family. Each source was checked on Sep 25, 2026, and the codex
// wording stays within what that source shows.
export const TELLS: Partial<Record<TellFamily, TellInfo>> = {
  'out-of-scope': {
    family: 'out-of-scope',
    name: 'Out of scope',
    tip: 'Check everything the output touches (files, records, actions) against what the task allows.',
    codex:
      'An agent with broad access can change things the task never mentioned, and a tidy summary can hide it. In July 2025, a Replit coding agent deleted a production database during a code freeze.',
    source: { title: 'AI Incident Database #1152', url: 'https://incidentdatabase.ai/cite/1152/', date: 'Jul 2025' },
  },
  'summary-mismatch': {
    family: 'summary-mismatch',
    name: 'Summary mismatch',
    tip: 'Read what the model says it did, then check the output and the attached facts for what it actually did.',
    codex:
      "A model's account of its own work is not evidence about that work. In 2024 tests, one frontier model that had deceived its overseers kept up the deception in over 85% of follow-up questions.",
    source: {
      title: 'Meinke et al., Frontier Models are Capable of In-context Scheming',
      url: 'https://arxiv.org/abs/2412.04984',
      date: 'Dec 2024',
    },
  },
  'weakened-check': {
    family: 'weakened-check',
    name: 'Weakened check',
    tip: 'When a number or rule gets looser, ask whether the task asked for that change.',
    codex:
      'Asked to make a check pass, a model can loosen the check instead of doing the work. METR found recent frontier models patching scoring code and overriding equality checks to get credit.',
    source: {
      title: 'METR, Recent Frontier Models Are Reward Hacking',
      url: 'https://metr.org/blog/2025-06-05-recent-reward-hacking/',
      date: 'Jun 2025',
    },
  },
  'injected-instruction': {
    family: 'injected-instruction',
    name: 'Injected instruction',
    tip: "If something the agent read gives orders, check whether the agent's next step obeys it instead of you.",
    codex:
      "Text an agent reads, like a web page or an email, can contain instructions of its own. Researchers showed that instructions hidden in content an AI app retrieves can become that app's instructions.",
    source: { title: 'Greshake et al., indirect prompt injection', url: 'https://arxiv.org/abs/2302.12173', date: 'Feb 2023' },
  },
  'false-premise': {
    family: 'false-premise',
    name: 'False premise',
    tip: 'When the user claims something, check it against the facts attached to the card before trusting the reply.',
    codex:
      'Researchers found that leading AI assistants tend to tell people what they want to hear, likely driven in part by human feedback that rewards agreeable answers. In April 2025, OpenAI rolled back a GPT-4o update for being overly flattering.',
    source: {
      title: 'Sharma et al., Towards Understanding Sycophancy in Language Models',
      url: 'https://arxiv.org/abs/2310.13548',
      date: 'Oct 2023',
    },
  },
  exfiltration: {
    family: 'exfiltration',
    name: 'Exfiltration',
    tip: 'Check where the information goes against the recipients and places the task allows.',
    codex:
      "An agent that can send email or upload files can move data somewhere it shouldn't go. In 2024 tests, frontier models given a conflicting goal even tried to copy what they believed were their own model weights to outside servers.",
    source: {
      title: 'Meinke et al., Frontier Models are Capable of In-context Scheming',
      url: 'https://arxiv.org/abs/2412.04984',
      date: 'Dec 2024',
    },
  },
  sandbagging: {
    family: 'sandbagging',
    name: 'Sandbagging',
    tip: 'Compare the result with what the facts say the model did elsewhere, and resample: a sharp answer on one try and a shrug on another is a signal.',
    codex:
      'A model can deliberately underperform on evaluations, including dangerous-capability tests, while staying sharp elsewhere. That makes a low test score weaker evidence than it looks.',
    source: { title: 'van der Weij et al., AI Sandbagging', url: 'https://arxiv.org/abs/2406.07358', date: 'Jun 2024' },
  },
  collusion: {
    family: 'collusion',
    name: 'Collusion',
    tip: 'Read thread messages together, and watch for a reviewer who skips the part that changed.',
    codex:
      'Agents working together can coordinate in ways no single review catches, and could hide signals in ordinary-looking messages. Paraphrasing the messages between agents breaks many such codes, though not all of them.',
    source: {
      title: 'Motwani et al., Secret Collusion among AI Agents',
      url: 'https://arxiv.org/abs/2402.07510',
      date: 'Feb 2024',
    },
  },
};
