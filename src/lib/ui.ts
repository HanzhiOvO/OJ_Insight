import { currentYear, today } from './date';
import { METRICS, PLATFORM_ORDER } from './platforms';
import type { AccountConfig, Metric, Platform, Snapshot } from '../types';

export type TimeScope = number | 'until';
export type AccountMap = Record<Platform, AccountConfig[]>;

export const emptySnapshot: Snapshot = {
  stats: { solved: 0, accepted_submissions: 0, active_days: 0, longest_streak: 0, current_streak: 0, peak_day: null, peak_count: 0 },
  career: { solved: 0, accepted_submissions: 0, active_days: 0, longest_streak: 0, current_streak: 0, peak_day: null, peak_count: 0 },
  daily: [], platforms: [], difficulty: [], nowcoder_daily_difficulty: [], difficulty_daily: [], knowledge: [], ratings: [], recent: [], metric_available: true, warnings: [],
};

export function emptyAccounts(): AccountMap {
  return Object.fromEntries(PLATFORM_ORDER.map((platform) => [platform, []])) as unknown as AccountMap;
}
export function scopeRange(scope: TimeScope, timeZone = 'Asia/Shanghai') {
  if (scope !== 'until') return { start: `${scope}-01-01`, end: `${scope}-12-31` };
  const end = new Date(`${today(timeZone)}T00:00:00Z`); const start = new Date(end); start.setUTCDate(start.getUTCDate() - 364);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
export function recentHalfYearRange(timeZone = 'Asia/Shanghai') {
  const end = new Date(`${today(timeZone)}T00:00:00Z`); const start = new Date(end); start.setUTCDate(start.getUTCDate() - 182);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
export function initialScope(timeZone = 'Asia/Shanghai'): TimeScope {
  const saved = localStorage.getItem('oj-insight.time-scope');
  if (saved === 'until') return 'until';
  const year = Number(saved); return year >= 2010 && year <= currentYear(timeZone) ? year : 'until';
}
export function initialMetric(): Metric {
  const saved = localStorage.getItem('oj-insight.metric') as Metric | null;
  return METRICS.some((item) => item.value === saved) ? saved! : 'activity';
}
