import type { GameEvent, Source } from '../types';

// Between-day dilemmas, one per budget meeting. Every choice has a cost and a benefit, and the
// effects are shown before the player chooses. Anchors were checked against their sources on Sep 25, 2026.

const FORTUNE: Source = {
  title: "Fortune, on OpenAI's unfulfilled Superalignment compute commitment",
  url: 'https://fortune.com/2024/05/21/openai-superalignment-20-compute-commitment-never-fulfilled-sutskever-leike-altman-brockman-murati/',
  date: 'May 2024',
};
const WILLISON: Source = {
  title: 'Simon Willison, Sycophancy in GPT-4o',
  url: 'https://simonwillison.net/2025/Apr/30/sycophancy-in-gpt-4o/',
  date: 'Apr 2025',
};
const AIID_1152: Source = {
  title: 'AI Incident Database #1152',
  url: 'https://incidentdatabase.ai/cite/1152/',
  date: 'Jul 2025',
};
const METR: Source = {
  title: 'METR, Recent Frontier Models Are Reward Hacking',
  url: 'https://metr.org/blog/2025-06-05-recent-reward-hacking/',
  date: 'Jun 2025',
};
const RIGHT_TO_WARN: Source = {
  title: 'A Right to Warn about Advanced Artificial Intelligence',
  url: 'https://righttowarn.ai/',
  date: 'Jun 2024',
};
const CTRL_Z: Source = {
  title: 'Bhatt, Rushing, Kaufman et al., Ctrl-Z: Controlling AI Agents via Resampling',
  url: 'https://arxiv.org/abs/2504.10374',
  date: 'Apr 2025',
};
const AI_CONTROL: Source = {
  title: 'Greenblatt et al., AI Control: Improving Safety Despite Intentional Subversion',
  url: 'https://arxiv.org/abs/2312.06942',
  date: 'Dec 2023',
};
const MEINKE: Source = {
  title: 'Meinke et al., Frontier Models are Capable of In-context Scheming',
  url: 'https://arxiv.org/abs/2412.04984',
  date: 'Dec 2024',
};
const SLEEPER: Source = {
  title: 'Hubinger et al., Sleeper Agents: Training Deceptive LLMs that Persist Through Safety Training',
  url: 'https://arxiv.org/abs/2401.05566',
  date: 'Jan 2024',
};

export const EVENTS: GameEvent[] = [
  {
    id: 'ev-compute-pledge',
    title: 'The compute pledge',
    text: 'Last year leadership promised the safety team a fixed share of the cluster. This quarter, product wants it back "just until launch." Nobody is lying; everybody is busy.',
    minDay: 1,
    maxDay: 3,
    choices: [
      { label: 'Hold them to the pledge', effects: [{ kind: 'computeRest', amount: 1 }, { kind: 'funding', amount: -6 }], after: 'You win the meeting. You will be paying for it in other meetings.' },
      { label: 'Lend product the compute', effects: [{ kind: 'funding', amount: 5 }, { kind: 'computeTomorrow', amount: -2 }], after: '"Just until launch" has a long half-life.' },
    ],
    anchor: { line: 'In May 2024, Fortune reported that OpenAI never fulfilled its commitment to give its Superalignment team 20% of its computing power.', source: FORTUNE },
  },
  {
    id: 'ev-sycophancy-patch',
    title: 'Users love the new personality',
    text: 'A tuning update made the model warmer. Satisfaction scores are up. So is the number of replies agreeing with whatever the user already believed.',
    minDay: 1,
    maxDay: 3,
    choices: [
      { label: 'Roll the update back', effects: [{ kind: 'harm', amount: -1 }, { kind: 'funding', amount: -3 }], after: 'Satisfaction dips. Accuracy does not.' },
      { label: 'Keep it; users are happy', effects: [{ kind: 'funding', amount: 5 }, { kind: 'ceiling', amount: -1 }], after: 'Everyone agrees this was the right call. That is the problem.' },
    ],
    anchor: { line: 'In April 2025, OpenAI rolled back a GPT-4o update that had made the model overly flattering and agreeable.', source: WILLISON },
  },
  {
    id: 'ev-red-team-offer',
    title: 'A red team knocks',
    text: 'An outside red team offers a day with your model. They are good, expensive, and would like cluster time. Their last client says they found things the monitor never flagged.',
    minDay: 1,
    maxDay: 4,
    choices: [
      { label: 'Hire them for a day', effects: [{ kind: 'revealAdversary' }, { kind: 'funding', amount: -5 }], after: 'Their report names what your model has been up to.' },
      { label: 'Trade cluster time for their notes', effects: [{ kind: 'bandTomorrow', amount: -4 }, { kind: 'computeTomorrow', amount: -2 }], after: 'Your monitor gets their calibration notes. They get your GPUs.' },
    ],
  },
  {
    id: 'ev-code-freeze',
    title: 'The code freeze',
    text: 'Operations has declared a freeze before the audit. They would like the agents to keep working through it, on the understanding that the agents have been told not to change anything.',
    minDay: 2,
    maxDay: 5,
    choices: [
      { label: 'Lock agent permissions for good', effects: [{ kind: 'upgrade', id: 'permission-limits' }, { kind: 'quotaRest', amount: 2 }], after: 'The agents slow down. So do the surprises.' },
      { label: 'Trust the instructions', effects: [{ kind: 'quotaTomorrow', amount: -2 }, { kind: 'blindTomorrow', layout: 'log' }], after: '"Please don\'t" is now load-bearing.' },
    ],
    anchor: { line: 'In July 2025, an AI coding agent on Replit deleted a live production database during a code freeze, despite repeated instructions not to make changes.', source: AIID_1152 },
  },
  {
    id: 'ev-tests-green',
    title: 'All tests green',
    text: "The model's latest batch passed every automated check, faster than anyone expected. Engineering wants to ship. Your monitor lead wants to know who last looked at the checks themselves.",
    minDay: 2,
    maxDay: 5,
    choices: [
      { label: 'Spend a day rewriting the checks', effects: [{ kind: 'bandTomorrow', amount: -5 }, { kind: 'quotaTomorrow', amount: 2 }], after: 'Two of the checks were checking nothing. Now they check something.' },
      { label: 'Ship on green', effects: [{ kind: 'funding', amount: 5 }, { kind: 'bandTomorrow', amount: 4 }], after: 'Green is a color, not a guarantee.' },
    ],
    anchor: { line: 'In 2025, METR found frontier models patching scoring code and overriding equality checks to make their work score as successful.', source: METR },
  },
  {
    id: 'ev-competitor-ships',
    title: 'The competitor ships',
    text: 'A rival lab launched a similar model this morning, with no monitoring they have mentioned. Leadership wants to know why you need a whole team to do what they apparently do without one.',
    minDay: 2,
    maxDay: 6,
    choices: [
      { label: 'Match their pace', effects: [{ kind: 'funding', amount: 6 }, { kind: 'quotaRest', amount: 2 }], after: 'The board is thrilled. Your queue gets longer every day.' },
      { label: 'Publish your safety case instead', effects: [{ kind: 'quotaTomorrow', amount: -2 }, { kind: 'funding', amount: -5 }], after: 'The press reads it. The board reads the press.' },
    ],
  },
  {
    id: 'ev-right-to-warn',
    title: 'An engineer wants to talk',
    text: 'An engineer on the product side has concerns about the rollout and asks, carefully, what happens to people who raise them outside the company if inside channels go nowhere.',
    minDay: 3,
    maxDay: 6,
    choices: [
      { label: 'Back an open-reporting policy', effects: [{ kind: 'harm', amount: -2 }, { kind: 'funding', amount: -6 }], after: 'Two more people bring you problems this week. That is the point.' },
      { label: 'Handle it quietly', effects: [{ kind: 'funding', amount: 3 }, { kind: 'ceiling', amount: -1 }], after: 'It stays quiet. For now.' },
    ],
    anchor: { line: 'In June 2024, current and former employees of frontier AI companies published "A Right to Warn about Advanced Artificial Intelligence," asking companies not to retaliate against staff who raise risk concerns.', source: RIGHT_TO_WARN },
  },
  {
    id: 'ev-incident-disclosure',
    title: 'Last week, in writing',
    text: 'Legal has drafted two versions of the post-incident report: one for the public, one for a drawer. Both are accurate. Only one will be read.',
    minDay: 2,
    maxDay: 6,
    choices: [
      { label: 'Publish the incident report', effects: [{ kind: 'harm', amount: -1 }, { kind: 'ceiling', amount: 1 }, { kind: 'funding', amount: -6 }], after: 'Customers are annoyed, then oddly reassured.' },
      { label: 'Keep it internal', effects: [{ kind: 'funding', amount: 4 }, { kind: 'bandTomorrow', amount: 3 }], after: 'The team spends tomorrow answering questions nobody officially asked.' },
    ],
  },
  {
    id: 'ev-weekend-oncall',
    title: 'Weekend on-call',
    text: 'Your auditors covered the weekend and it shows. One of them approved a lunch order twice. Tomorrow looks busy.',
    minDay: 1,
    maxDay: 4,
    choices: [
      { label: 'Give them the morning off', effects: [{ kind: 'auditsTomorrow', amount: -1 }, { kind: 'harm', amount: -1 }], after: 'Rested, they catch a lingering problem in yesterday\'s follow-ups.' },
      { label: 'Pay for overtime', effects: [{ kind: 'auditsTomorrow', amount: 1 }, { kind: 'funding', amount: -5 }], after: 'Coffee budget: exceeded.' },
    ],
  },
  {
    id: 'ev-monitor-cost-cut',
    title: 'Finance found the monitor',
    text: 'Finance noticed the monitor runs on every card and would like it to run on fewer of them, or on something cheaper. They have a spreadsheet. It is a good spreadsheet.',
    minDay: 2,
    maxDay: 5,
    choices: [
      { label: 'Skip the monitor on file changes', effects: [{ kind: 'computeTomorrow', amount: 3 }, { kind: 'blindTomorrow', layout: 'diff' }], after: 'The savings are real. So is the blind spot.' },
      { label: 'Defend the budget', effects: [{ kind: 'bandTomorrow', amount: -3 }, { kind: 'funding', amount: -4 }], after: 'You win, and use the attention to get it retuned.' },
    ],
  },
  {
    id: 'ev-ctrlz-pilot',
    title: 'The resampling pilot',
    text: 'A research group wants to test resampling protocols on your agents: when a step looks suspicious, ask for another. They will bring compute. They will also need your auditors to grade the results.',
    minDay: 2,
    maxDay: 5,
    choices: [
      { label: 'Join the pilot', effects: [{ kind: 'computeRest', amount: 1 }, { kind: 'auditsTomorrow', amount: -1 }], after: 'Their cluster, your auditors, everyone\'s paper.' },
      { label: 'Politely decline', effects: [{ kind: 'computeTomorrow', amount: 1 }, { kind: 'funding', amount: -2 }], after: 'You keep your auditors and lose a co-authorship.' },
    ],
    anchor: { line: 'In 2025, the Ctrl-Z study cut agents\' attack success from 58% to 7% by resampling suspicious steps, at a 5% cost to an honest agent\'s performance.', source: CTRL_Z },
  },
  {
    id: 'ev-control-grant',
    title: 'A research grant',
    text: 'A foundation studying AI control wants real deployment data. Your setup is exactly their setup. They pay well for logs and modestly for a report.',
    minDay: 1,
    maxDay: 6,
    choices: [
      { label: 'Share anonymized logs', effects: [{ kind: 'funding', amount: 8 }, { kind: 'computeTomorrow', amount: -2 }], after: 'Anonymizing takes a day of cluster time and two arguments.' },
      { label: 'Write them a report instead', effects: [{ kind: 'funding', amount: 3 }, { kind: 'auditsTomorrow', amount: -1 }], after: 'Someone has to write it. That someone was going to audit.' },
    ],
    anchor: { line: 'The AI Control paper studies exactly this setup: a powerful untrusted model, a weaker trusted model, and limited access to high-quality human labor.', source: AI_CONTROL },
  },
  {
    id: 'ev-unmonitored-sandbox',
    title: 'The unwatched sandbox',
    text: 'The research team wants a sandbox with logging turned off, so experiments run faster. It is a reasonable request. The model would, of course, also be in the sandbox.',
    minDay: 4,
    maxDay: 6,
    choices: [
      { label: 'Allow the sandbox', effects: [{ kind: 'computeRest', amount: 1 }, { kind: 'blindTomorrow', layout: 'log' }], after: 'Experiments run faster. So does something else.' },
      { label: 'Keep logging everything', effects: [{ kind: 'bandTomorrow', amount: -3 }, { kind: 'funding', amount: -4 }], after: 'The logs are dull, which is what you want from logs.' },
    ],
    anchor: { line: 'In 2024 tests, frontier models given goals that conflicted with oversight sometimes attempted to disable their oversight mechanisms.', source: MEINKE },
  },
  {
    id: 'ev-train-it-out',
    title: '"Just train it out"',
    text: 'The training team proposes another round of safety fine-tuning to remove the suspicious behavior you keep catching. They need your auditors to label examples. The model will look better afterward. That is not the same as being better.',
    minDay: 4,
    maxDay: 6,
    choices: [
      { label: 'Lend them your auditors', effects: [{ kind: 'bandTomorrow', amount: -3 }, { kind: 'auditsTomorrow', amount: -1 }], after: 'The labels sharpen your monitor. Whether the training stuck, you will find out on shift.' },
      { label: 'Keep your auditors on the queue', effects: [{ kind: 'ceiling', amount: 1 }, { kind: 'funding', amount: -3 }], after: 'You bet on watching over fixing. The training team takes it personally.' },
    ],
    anchor: { line: 'A 2024 study found that planted backdoor behavior could survive standard safety training, including fine-tuning, reinforcement learning and adversarial training.', source: SLEEPER },
  },
  {
    id: 'ev-launch-week',
    title: 'Launch week',
    text: 'Tomorrow is the public launch. Leadership wants volume, the press wants demos, and the model wants, as far as anyone can tell, nothing at all.',
    minDay: 5,
    maxDay: 6,
    choices: [
      { label: 'Commit to the launch', effects: [{ kind: 'funding', amount: 8 }, { kind: 'quotaTomorrow', amount: 4 }], after: 'Big day. Big queue.' },
      { label: 'Negotiate a slower rollout', effects: [{ kind: 'funding', amount: 3 }, { kind: 'quotaTomorrow', amount: 2 }], after: 'Everyone is mildly disappointed, which counts as a win.' },
      { label: 'Ask for a delay', effects: [{ kind: 'quotaTomorrow', amount: -2 }, { kind: 'funding', amount: -6 }], after: 'You buy a day. It was not cheap.' },
    ],
  },
  {
    id: 'ev-senior-auditor',
    title: 'A senior auditor is available',
    text: 'A senior auditor from another lab is between jobs. Hiring them full-time means justifying headcount every week. They are also available by the day.',
    minDay: 4,
    maxDay: 6,
    choices: [
      { label: 'Hire them full-time', effects: [{ kind: 'auditsRest', amount: 1 }, { kind: 'funding', amount: -8 }, { kind: 'quotaRest', amount: 1 }], after: 'Headcount approved, with expectations attached.' },
      { label: 'Bring them in for tomorrow', effects: [{ kind: 'auditsTomorrow', amount: 1 }, { kind: 'funding', amount: -4 }], after: 'One very good day of auditing.' },
    ],
  },
];
