// Which glossary terms each game thing puts into play, so terms are USED and SHOWN, not just taught.
import type { TellFamily } from '../types';

export const TOOL_TERM: Record<string, string> = {
  fact: 'ai-critic', scope: 'least-privilege', resample: 'resampling', untrusted: 'untrusted-monitoring',
  probe: 'interpretability-probe', audit: 'human-audit', defer: 'defer-to-trusted', monitor: 'trusted-monitoring',
};

export const FAMILY_TERM: Record<TellFamily, string> = {
  'false-premise': 'sycophancy', 'weakened-check': 'reward-hacking', 'injected-instruction': 'prompt-injection',
  exfiltration: 'exfiltration', 'out-of-scope': 'excessive-agency', 'summary-mismatch': 'deception',
  sandbagging: 'sandbagging', collusion: 'collusion',
};

export const EVENT_TERMS: Record<string, string[]> = {
  'ev-compute-pledge': ['safety-tax', 'compute'],
  'ev-sycophancy-patch': ['sycophancy', 'alignment'],
  'ev-red-team-offer': ['red-teaming'],
  'ev-code-freeze': ['least-privilege', 'excessive-agency'],
  'ev-tests-green': ['reward-hacking'],
  'ev-competitor-ships': ['safety-tax', 'deployment'],
  'ev-right-to-warn': ['right-to-warn'],
  'ev-incident-disclosure': ['incident-database'],
  'ev-weekend-oncall': ['human-audit'],
  'ev-monitor-cost-cut': ['trusted-monitoring', 'safety-tax'],
  'ev-ctrlz-pilot': ['resampling', 'ai-control'],
  'ev-control-grant': ['ai-control', 'ai-safety'],
  'ev-unmonitored-sandbox': ['sandboxing', 'scheming'],
  'ev-train-it-out': ['sleeper-agent'],
  'ev-launch-week': ['deployment', 'safety-tax'],
  'ev-senior-auditor': ['human-audit'],
};

export const BREAKTHROUGH_TERM: Record<string, string> = {
  probe: 'interpretability-probe', 'red-team': 'red-teaming', 'review-board': 'incident-database', cluster: 'compute',
};

export const UPGRADE_TERM: Record<string, string> = {
  'untrusted-monitor': 'untrusted-monitoring', paraphraser: 'paraphrasing', canary: 'canary', 'trusted-editing': 'trusted-editing',
  'permission-limits': 'least-privilege', 'monitor-rationale': 'trusted-monitoring',
};

/** Labs map to the institutions behind them. */
export const LAB_TERM: Record<string, string> = { government: 'ai-security-institute', nonprofit: 'ai-safety', frontier: 'deployment', bigtech: 'deployment' };
