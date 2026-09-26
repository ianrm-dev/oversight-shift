import type { Branch } from './research-tree';

// Depth content for the research tree: what each approach is, what it assumes, and its tradeoffs.
// Numbers are taken from sources already verified in research-anchors.ts and tools.ts.

export interface BranchPrimer {
  what: string;
  assumes: string;
  strengths: string;
  limits: string;
  vs: string;
}

export const BRANCH_PRIMERS: Record<Branch, BranchPrimer> = {
  monitoring: {
    what: 'A cheaper model you trust reads everything the stronger model produces and flags what looks suspicious.',
    assumes: 'That a weaker model can still notice many problems in a stronger model’s work, even without fully understanding it.',
    strengths: 'It is cheap enough to run on every output, so nothing goes completely unwatched.',
    limits: 'It is outmatched by the model it watches, so it misses subtle attacks and raises false alarms.',
    vs: 'Monitoring is the always-on first pass; control protocols decide what to do with what it flags.',
  },
  control: {
    what: 'Rules for using a model you don’t trust: when to check, redo, resample, or block its work.',
    assumes: 'That the model might be actively working against you, so safety can’t rely on trusting it.',
    strengths: 'It works today without knowing what the model intends, and its safety can be tested with red teams.',
    limits: 'Every safeguard costs usefulness, and it may not scale to models far smarter than their overseers.',
    vs: 'Control manages a model you can’t read; interpretability tries to read it so you might trust it.',
  },
  interp: {
    what: 'Looking inside a model’s internal activity to see what it is computing, not just what it outputs.',
    assumes: 'That goals and deception leave traces inside the model that simple tools can detect.',
    strengths: 'It could catch a model that behaves perfectly on the outside but intends harm.',
    limits: 'Results so far mostly come from models built to misbehave in known ways; real deception may look different.',
    vs: 'Interpretability asks what the model is thinking; evals ask what it can do.',
  },
  evals: {
    what: 'Testing what a model can do and how it behaves, including red teams trying to make it misbehave.',
    assumes: 'That tests reveal real capabilities, and that the model isn’t hiding them on purpose.',
    strengths: 'Evals give concrete, comparable evidence for decisions like whether a model is ready to release.',
    limits: 'A model that sandbags can pass a test by pretending to be weaker than it is.',
    vs: 'Evals measure before and during deployment; monitoring watches the actual work as it happens.',
  },
  security: {
    what: 'Limiting what an AI agent can touch, so its mistakes or attacks can only do limited damage.',
    assumes: 'That something will go wrong eventually, so the damage should be contained in advance.',
    strengths: 'Permissions work whatever the model intends, and they build on decades of computer security practice.',
    limits: 'Tight limits make agents less useful, and they only block what someone thought to restrict.',
    vs: 'Security limits the blast radius; monitoring and control try to stop the bad action itself.',
  },
  governance: {
    what: 'Changing the rules, incentives and institutions around AI: disclosure, outside testing, and who gets to say stop.',
    assumes: 'That many risks come from pressure on people, like racing competitors, not only from the model.',
    strengths: 'It can change what every lab does at once, not just what one team does on one shift.',
    limits: 'It moves slowly, depends on cooperation, and can’t fix a technical problem on its own.',
    vs: 'Governance shapes the pressure you work under; the technical branches decide what you do under it.',
  },
};

export interface NodeDepth {
  tradeoff: string;
  openQuestion: string;
}

export const NODE_DEPTH: Record<string, NodeDepth> = {
  // Monitoring
  'mon-prompts': {
    tradeoff: 'Better instructions sharpen a weak monitor a little, but they can’t give it abilities it lacks. The stronger model may learn what the monitor looks for.',
    openQuestion: 'How much can a weaker model’s judgment improve before the gap in capability simply wins?',
  },
  'monitor-rationale': {
    tradeoff: 'An explanation tells you where to look, but in a 2025 pilot an AI reviewer helped the best human auditors, not the typical one.',
    openQuestion: 'Do explanations make people check more carefully, or trust the monitor too much?',
  },
  'mon-ensemble': {
    tradeoff: 'Combining monitors catches more, but each extra monitor costs compute, and monitors built alike may share the same blind spots.',
    openQuestion: 'How different do monitors need to be before their errors stop overlapping?',
  },

  // Control protocols
  'ctl-resample': {
    tradeoff: 'Asking again costs time and compute. In Ctrl-Z, resampling cut attack success from 58% to 7% at a 5% cost to an honest agent.',
    openQuestion: 'Can a patient model learn to attack only when it knows a second sample won’t be taken?',
  },
  'trusted-editing': {
    tradeoff: 'Editing keeps more of the useful work than throwing it away. In AI Control it reached 92% safety at 94% usefulness, against monitoring’s 62% and 97%.',
    openQuestion: 'How subtle can sabotage get before a weaker editor can no longer see what to remove?',
  },
  'untrusted-monitoring': {
    tradeoff: 'A copy of the strong model is a sharper monitor, reaching 79% safety at 96% usefulness in AI Control, but it may collude with the model it watches.',
    openQuestion: 'Can we ever be sure two copies of a model aren’t coordinating in ways we can’t see?',
  },
  paraphrasing: {
    tradeoff: 'Rewording messages breaks many hidden codes, but researchers found it can’t remove every channel, and it can slow the agents’ real work.',
    openQuestion: 'What hidden channels survive paraphrasing, and how would we know they were being used?',
  },
  canary: {
    tradeoff: 'Planting known-bad work tests whether a monitor is honest, but a clever monitor might learn to tell the planted tests from real work.',
    openQuestion: 'Can test cases be made indistinguishable from real work for a model smarter than whoever built them?',
  },

  // Interpretability
  interpretability: {
    tradeoff: 'Probes are cheap and read intent directly, but they’ve mostly been shown on models deliberately built with hidden triggers.',
    openQuestion: 'Would the same probes catch deception that arises on its own, rather than a trigger planted by researchers?',
  },
  'int-probe2': {
    tradeoff: 'Running probes more often costs little, but a probe trained on one kind of bad behavior may miss a different kind entirely.',
    openQuestion: 'How many different probes would it take to cover the ways a model could go wrong?',
  },
  'int-probe-start': {
    tradeoff: 'Probes in production give an always-on check on intent, but if a model learned to hide its internal signal, the probe would quietly stop working.',
    openQuestion: 'Could a model be trained, or train itself, to fool the probes watching it?',
  },

  // Evals & red teaming
  'evl-sandbag': {
    tradeoff: 'Checking results against what a model did elsewhere catches some sandbagging, but a model that is consistently weak on purpose leaves nothing to compare against.',
    openQuestion: 'How do you measure a capability that the model is deliberately hiding from you?',
  },
  'evl-redteam': {
    tradeoff: 'A red team finds real weaknesses, but in one auditing game black-box checks were fooled by a model imitating a weaker one.',
    openQuestion: 'Can red teams keep up when the model being tested is more capable than the testers?',
  },
  'evl-forecast': {
    tradeoff: 'Forecasts help you prepare, but they extrapolate trends. METR found the task length AI can handle doubling about every seven months since 2019; trends can break.',
    openQuestion: 'Will capability trends keep their pace, speed up, or stall, and how early could we tell?',
  },

  // Security
  'sec-least-privilege': {
    tradeoff: 'Giving an agent only the access it needs limits damage, but deciding exactly what it needs takes work, and too little access blocks real tasks.',
    openQuestion: 'How do you set permissions for an agent whose tasks change from one minute to the next?',
  },
  'sec-permissions': {
    tradeoff: 'Tiers stop the worst actions whatever the model intends, but every approval step slows the work people deployed the agent to do.',
    openQuestion: 'Which actions are dangerous enough to need a human sign-off every single time?',
  },
  'lab-government': {
    tradeoff: 'Public testing bodies add independent checks and national-security expertise, but they depend on labs sharing access and can move slower than the models.',
    openQuestion: 'What access should governments have to test models before release, and who decides?',
  },
  'sec-sandbox': {
    tradeoff: 'A sandbox contains mistakes, but a sealed-off agent can’t do much that’s useful, and every opening you add is another way out.',
    openQuestion: 'Can an agent smart enough to be useful be kept inside a sandbox it wants to leave?',
  },

  // Governance
  'gov-incident-db': {
    tradeoff: 'Collecting failures helps everyone learn, but it depends on people reporting them, and embarrassing incidents are the easiest to leave out.',
    openQuestion: 'Should reporting serious AI incidents be required, the way it is for aviation?',
  },
  'gov-safety-case': {
    tradeoff: 'A written argument makes safety claims checkable, but an argument is only as strong as its weakest assumption, and those can be hard to test.',
    openQuestion: 'Who should review a lab’s safety case, and what happens if they reject it?',
  },
  'lab-nonprofit': {
    tradeoff: 'Outside evaluators have more independence, but less access and fewer resources than the labs whose models they test.',
    openQuestion: 'How can independent testers get enough access without becoming dependent on the labs?',
  },
  'lab-bigtech': {
    tradeoff: 'Industry groups can share safety practices across companies, but members also compete, and voluntary commitments can be dropped.',
    openQuestion: 'Can companies racing each other agree on safety limits that slow them all down?',
  },
  'gov-whistleblower': {
    tradeoff: 'Protecting people who raise concerns surfaces risks early, but it only helps if they are heard, and it can clash with confidentiality.',
    openQuestion: 'When should an employee’s duty to warn the public outweigh their duty to keep company secrets?',
  },
};
