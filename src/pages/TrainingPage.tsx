import { useRef, useState } from 'react';
import { Download, FileUp, FolderOpen, Sparkles } from 'lucide-react';
import PlatformIcon from '../components/PlatformIcon';
import { PLATFORM_META } from '../lib/platforms';
import { api } from '../services/api';
import { openTrainingExportDirectory, saveTrainingFile } from '../services/training';
import type { CandidatePool, Platform, ProblemSetInput, TrainingMode } from '../types';
import { useI18n } from '../lib/i18n';

const MODES: Array<{ id: TrainingMode; name: string; target: string; description: string }> = [
  { id: 'relaxed', name: '轻松', target: '70%–90%', description: '以熟悉的题目为主' },
  { id: 'balanced', name: '均衡', target: '50%–70%', description: '熟悉题与较难题搭配' },
  { id: 'pressure', name: '压力', target: '35%–55%', description: '增加较难题和陌生题型' },
];
const AUTO_PLATFORMS: Platform[] = ['codeforces', 'atcoder', 'qoj'];

export default function TrainingPage({ notify, onOpenProblemSets, onOpenContests }: { notify: (message: string) => void; onOpenProblemSets: () => void; onOpenContests: () => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<TrainingMode>('balanced');
  const [platforms, setPlatforms] = useState<Platform[]>(AUTO_PLATFORMS);
  const [candidateCount, setCandidateCount] = useState(36);
  const [pool, setPool] = useState<CandidatePool | null>(null);
  const [generating, setGenerating] = useState(false);
  const [extra, setExtra] = useState('');
  const [savedPath, setSavedPath] = useState('');
  const [importTarget, setImportTarget] = useState<'set' | 'contest'>('contest');
  const fileRef = useRef<HTMLInputElement>(null);
  const generate = async () => { if (!platforms.length) return notify(t('至少选择一个平台')); setGenerating(true); try { const result = await api.generateTrainingCandidates(platforms, mode, candidateCount); setPool(result); notify(t('候选池：{count} 道；排除已做 {excluded} 道', { count: result.candidates.length, excluded: result.excludedSolved })); } catch (error) { notify(String(error)); } finally { setGenerating(false); } };
  const exportPack = async () => { if (!pool) return; try { const bytes = await api.exportAiTrainingPack(pool.candidates, mode, extra); const saved = await saveTrainingFile(`OJ-Insight-AI组题包-${Date.now()}.zip`, bytes, 'zip'); if (saved) { setSavedPath(saved.path); notify(t('组题包已保存到 {path}', { path: saved.path })); } } catch (error) { notify(String(error)); } };
  const importGenerated = async (file?: File) => {
    if (!file) return;
    try {
      const data = await file.text(); const value = JSON.parse(data);
      if (!['com.ojinsight.generated-contest', 'com.ojinsight.match-manifest', 'com.ojinsight.problem-set'].includes(value.schema) || value.schemaVersion !== 1) throw new Error(t('请选择 OJ Insight 生成的 JSON 文件'));
      if (importTarget === 'contest') { const contest = await api.importGeneratedContest(data); notify(t('比赛“{title}”已导入', { title: contest.title })); onOpenContests(); }
      else { const input: ProblemSetInput = { id: null, title: value.title, description: value.description || '', setType: 'static', tagVisibility: value.tagVisibility || 'after_ac', sourceSetId: null, sourceUrl: null, problems: value.problems }; const set = await api.saveProblemSet(input); notify(t('题单“{title}”已导入', { title: set.title })); onOpenProblemSets(); }
    } catch (error) { notify(String(error)); } finally { if (fileRef.current) fileRef.current.value = ''; }
  };
  return <>
    <header className="topbar"><div><small lang="en">PERSONALIZED TRAINING</small><h1>{t('个性化组题')}</h1><p>{t('筛选候选题并导出 ZIP，交给大模型组题后，再导入生成的 JSON。')}</p></div><div className="compact-actions"><button title={t('导入大模型生成的 JSON 文件并保存为比赛')} onClick={() => { setImportTarget('contest'); fileRef.current?.click(); }}><FileUp size={14} />{t('导入为比赛')}</button><button title={t('导入大模型生成的 JSON 文件并保存为题单')} onClick={() => { setImportTarget('set'); fileRef.current?.click(); }}><FileUp size={14} />{t('导入为题单')}</button><input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importGenerated(event.target.files?.[0])} /></div></header>
    <section className="panel training-builder"><header className="training-section-title"><div><small lang="en">TRAINING PACK</small><h2>{t('生成候选池')}</h2><p>{t('选择训练难度，下方比例为目标完成率。')}</p></div><Sparkles size={22} /></header>
      <div className="training-modes">{MODES.map((entry) => <button key={entry.id} className={mode === entry.id ? 'active' : ''} onClick={() => { setMode(entry.id); setPool(null); }}><strong>{t(entry.name)}</strong><span>{t(entry.description)}</span><small>{t('参考比例 {target}', { target: entry.target })}</small></button>)}</div>
      <div className="candidate-controls"><div><span>{t('初筛平台')}</span><div className="platform-picks">{AUTO_PLATFORMS.map((platform) => <button key={platform} className={platforms.includes(platform) ? 'active' : ''} onClick={() => { setPlatforms((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]); setPool(null); }}><PlatformIcon platform={platform} />{PLATFORM_META[platform].name}</button>)}</div><small>{t('暂不支持洛谷、牛客和 LeetCode 自动组题。')}</small></div><label><span>{t('候选池大小')}</span><input type="number" min={12} max={120} value={candidateCount} onChange={(event) => { setCandidateCount(Number(event.target.value)); setPool(null); }} /></label><button className="primary generate-candidates" disabled={generating} onClick={() => void generate()}><Sparkles size={16} />{generating ? t('正在筛题…') : t('生成候选池')}</button></div>
      {pool && <div className="candidate-result"><header><div><strong>{t('筛选完成')}</strong><span>{t('{count} 道可用题 · 排除已做 {excluded} 道', { count: pool.candidates.length, excluded: pool.excludedSolved })}</span></div></header><p>{pool.selectionBasis}</p><div className="source-statuses">{pool.sources.map((source) => <span key={source.platform} className={source.available ? 'ok' : 'unavailable'}><i />{PLATFORM_META[source.platform].name} · {source.available ? t('{count} 道目录题', { count: source.problemCount }) : source.message}</span>)}</div><details><summary>{t('查看候选题')}</summary><div className="candidate-preview">{pool.candidates.slice(0, 30).map((problem) => <a key={problem.canonicalId} href={problem.url} target="_blank" rel="noreferrer"><PlatformIcon platform={problem.platform} /><span><strong>{problem.name}</strong><small>{problem.problemId}</small></span></a>)}</div></details><label className="training-extra"><span>{t('额外组题要求（可选）')}</span><textarea value={extra} onChange={(event) => setExtra(event.target.value)} placeholder={t('例如：多选图论题，限时 2 小时')} /></label><div className="training-pack-actions"><button className="primary" onClick={() => void exportPack()}><Download size={15} />{t('导出组题包 ZIP')}</button></div><p>{t('将模型生成的 JSON 导入为比赛或题单。')}</p>{savedPath && <div className="export-result"><span><strong>{t('最近导出')}</strong>{savedPath}</span><button onClick={() => void openTrainingExportDirectory(savedPath)}><FolderOpen size={14} />{t('打开所在文件夹')}</button></div>}</div>}
    </section>
  </>;
}
