import { useEffect, useMemo, useState } from 'react';
import { mergeKnowledgeBuckets } from '../lib/knowledge';
import { PLATFORM_META } from '../lib/platforms';
import type { KnowledgeBucket, Platform } from '../types';

const PROFILE_PLATFORMS: Platform[] = ['codeforces', 'leetcode', 'qoj'];
const LABELS: Record<string, string> = { overview: '总览', codeforces: 'Codeforces', leetcode: 'LeetCode', qoj: 'ICPC/CCPC' };
type ProfileView = 'overview' | Platform;
type RadarRow = Pick<KnowledgeBucket, 'axis' | 'count' | 'score'>;

function point(index: number, value: number, count: number, radius = 100): [number, number] {
  const angle = Math.PI * 2 * index / count - Math.PI / 2;
  const scale = value / 100;
  return [210 + Math.cos(angle) * radius * scale, 160 + Math.sin(angle) * radius * scale];
}

const points = (rows: RadarRow[], value: number | ((item: RadarRow) => number)) => rows
  .map((item, index) => point(index, typeof value === 'function' ? value(item) : value, rows.length).join(','))
  .join(' ');

export default function KnowledgeRadar({ data, selectedPlatform }: { data: KnowledgeBucket[]; selectedPlatform?: Platform | null }) {
  const available = PROFILE_PLATFORMS.filter((platform) => data.some((item) => item.platform === platform && item.count > 0));
  const preferred = selectedPlatform && PROFILE_PLATFORMS.includes(selectedPlatform) ? selectedPlatform : null;
  const [active, setActive] = useState<ProfileView>(preferred || 'overview');
  useEffect(() => {
    if (preferred) setActive(preferred);
    else if (active !== 'overview' && !available.includes(active)) setActive('overview');
  }, [preferred, active, available.join('|')]);
  const rows = useMemo<RadarRow[]>(() => mergeKnowledgeBuckets(data, active === 'overview' ? null : active), [data, active]);
  if (!rows.some((item) => item.count > 0)) {
    if (!preferred) return null;
    return <section className="panel knowledge-panel knowledge-empty">
      <div className="panel-head"><div><small>ABILITY EVIDENCE · 生涯累计</small><h2>能力画像</h2><p>根据已通过题目的标签和难度估算各方向水平。</p></div></div>
      <div className="empty">暂无题目标签。同步后可查看 {LABELS[preferred]} 能力画像。</div>
    </section>;
  }
  const displayRows = rows;
  const grid = [25, 50, 75, 100].map((value) => points(displayRows, value));
  const shape = points(displayRows, (item) => item.count > 0 ? item.score : 50);
  return <section className="panel knowledge-panel">
    <div className="panel-head"><div><small>ABILITY EVIDENCE · 生涯累计</small><h2>能力画像</h2><p>{active === 'overview' ? '根据各平台的做题记录估算各方向水平。' : active === 'codeforces' ? '根据近期 Rating 和已通过题目的难度估算。题目记录较少时，结果可能有偏差。' : active === 'qoj' ? '根据 QOJ 已通过题目的标签和难度估算。没有记录的方向显示「—」。' : '根据各类已通过题目的难度估算。'}</p></div></div>
    {!preferred && <div className="knowledge-tabs"><button aria-label="总览" aria-pressed={active === 'overview'} className={active === 'overview' ? 'active' : ''} onClick={() => setActive('overview')}><i className="overview" />总览</button>{available.map((platform) => <button aria-label={LABELS[platform]} aria-pressed={active === platform} className={active === platform ? 'active' : ''} onClick={() => setActive(platform)} key={platform}><i style={{ background: PLATFORM_META[platform].accent }} /><strong>{LABELS[platform]}</strong></button>)}</div>}
    <div className="knowledge-body">
      <svg viewBox="0 0 420 320" role="img" aria-label={`${LABELS[active]} 能力雷达图`}>
        {grid.map((points, index) => <polygon className="knowledge-grid" points={points} key={index} />)}
        {displayRows.map((_, index) => { const [x2, y2] = point(index, 100, displayRows.length); return <line className="knowledge-axis" x1={210} y1={160} x2={x2} y2={y2} key={index} />; })}
        <polygon className="knowledge-shape" points={shape} />
        {displayRows.filter((item) => item.count > 0).map((item) => { const index = displayRows.indexOf(item); const [cx, cy] = point(index, item.score, displayRows.length); return <circle cx={cx} cy={cy} r="3" key={item.axis}><title>{item.axis}：估算 {item.score} 分，{item.count} 道已通过题目</title></circle>; })}
        <g className="knowledge-labels">{displayRows.map((item, index) => { const [x, y] = point(index, 132, displayRows.length); const anchor = x < 190 ? 'end' : x > 230 ? 'start' : 'middle'; return <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" key={`label-${item.axis}`}>{item.axis}</text>; })}</g>
      </svg>
      <div className="knowledge-legend">{displayRows.map((item) => <div key={item.axis} title={item.count ? `${item.count} 道独立 AC 题目；${item.count < 4 ? '低' : item.count < 10 ? '中' : '高'}可信度` : '暂无该类题目的 AC 记录'}><span>{item.axis}</span><i><b style={{ width: `${item.count ? item.score : 0}%` }} /></i><strong>{item.count ? item.score : '—'}{item.count > 0 && <small>分</small>}</strong></div>)}</div>
    </div>
  </section>;
}
