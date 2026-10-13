import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BarChart3, BookOpen, Check, ChevronLeft, Download, RefreshCw, ShieldCheck, Sparkles, X } from 'lucide-react';
import PlatformIcon from './PlatformIcon';
import { PLATFORM_META, PLATFORM_ORDER } from '../lib/platforms';
import { useI18n } from '../lib/i18n';
import type { AccountMap } from '../lib/ui';
import type { AccountConfig, Platform, SyncStatus } from '../types';
import { api } from '../services/api';
import type { Page } from '../lib/navigation';

interface Props {
  step: number;
  onStep: (step: number) => void;
  accounts: AccountMap;
  statuses: SyncStatus[];
  syncing: string | null;
  progress: { done: number; total: number; partial: number; failed: number } | null;
  onSaved: () => Promise<unknown>;
  onSync: () => Promise<void>;
  onFinish: (skipped?: boolean, page?: Page) => void;
}

const steps = ['欢迎使用', '连接账号', '首次同步', '开始使用'];

export default function OnboardingWizard({ step, onStep, accounts, statuses, syncing, progress, onSaved, onSync, onFinish }: Props) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const lock = useRef(false);
  const [platform, setPlatform] = useState<Platform>('codeforces');
  const [drafts, setDrafts] = useState<Partial<Record<Platform, { account: string; secret: string }>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const configured = PLATFORM_ORDER.filter((p) => accounts[p].some((entry) => entry.account.trim()));
  const syncSucceeded = attempted && !error && configured.length > 0 && configured.every((p) => {
    const rows = statuses.filter((entry) => entry.platform === p);
    return rows.length > 0 && rows.every((entry) => entry.status === 'ok');
  });
  const existing = PLATFORM_ORDER.flatMap((p) => accounts[p]).filter((entry) => entry.account.trim());
  const working = busy || !!syncing;
  const draft = drafts[platform] || { account: '', secret: '' };
  const hasDraft = Object.values(drafts).some((entry) => entry?.account.trim());
  const change = (key: 'account' | 'secret', value: string) => {
    setError('');
    setDrafts((current) => ({ ...current, [platform]: { ...(current[platform] || { account: '', secret: '' }), [key]: value } }));
  };

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, []);
  useEffect(() => { heading.current?.focus(); setError(''); }, [step]);

  const save = async () => {
    if (lock.current || working) return;
    const additions: AccountConfig[] = [];
    for (const p of PLATFORM_ORDER) {
      const entry = drafts[p];
      const account = entry?.account.trim() || '';
      if (!account) continue;
      if (/\s|:\/\//.test(account) || (p === 'nowcoder' && !/^\d+$/.test(account))) {
        setError(t('请输入 {platform} 的账号 ID，不要填完整链接。', { platform: PLATFORM_META[p].name })); return;
      }
      if (accounts[p].some((value) => value.account.toLowerCase() === account.toLowerCase())) {
        setError(t('{platform} 已添加这个账号。', { platform: PLATFORM_META[p].name })); return;
      }
      additions.push({ platform: p, account, secret: entry!.secret.trim() });
    }
    if (!pendingRefresh && !existing.length && !additions.length) { setError(t('添加一个账号，或选择稍后设置。')); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      if (additions.length && !pendingRefresh) {
        // Read the current database before merging; replay never removes other IDs.
        const latest = await api.getAccounts();
        if (additions.some((entry) => latest.some((value) => value.platform === entry.platform && value.account.toLowerCase() === entry.account.toLowerCase()))) {
          throw new Error(t('账号已在其他位置更新，请重新打开向导。'));
        }
        await api.saveAllAccounts([...latest, ...additions]);
        setPendingRefresh(true);
        // Clear saved drafts even if the following refresh fails, avoiding duplicate saves.
        setDrafts({});
      }
      await onSaved();
      setPendingRefresh(false);
      onStep(2);
    } catch (cause) { setError(String(cause)); }
    finally { lock.current = false; setBusy(false); }
  };

  const sync = async () => {
    if (lock.current || working) return;
    lock.current = true; setBusy(true); setError(''); setAttempted(true);
    try { await onSync(); } catch (cause) { setError(String(cause)); }
    finally { lock.current = false; setBusy(false); }
  };

  return <dialog ref={dialog} className="onboarding-dialog" aria-labelledby="onboarding-title" aria-describedby="onboarding-description" onCancel={(event) => { event.preventDefault(); if (!working) onFinish(true); }} onKeyDown={(event) => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], select:not([disabled])')).filter((element) => element.getClientRects().length);
    const first = controls[0]; const last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); heading.current?.focus(); return; }
    const active = document.activeElement as HTMLElement;
    if (!controls.includes(active) || event.shiftKey && active === first || !event.shiftKey && active === last) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    }
  }}>
    <div className="onboarding-header"><span><Sparkles size={16} /> OJ Insight</span><button className="onboarding-close" aria-label={t('跳过向导')} disabled={working} onClick={() => onFinish(true)}><X size={18} /></button></div>
    <ol className="onboarding-steps" aria-label={t('用户向导进度')}>{steps.map((label, index) => <li key={label} className={index === step ? 'current' : index < step ? 'done' : ''} aria-current={index === step ? 'step' : undefined}><span>{index < step ? <Check size={13} /> : index + 1}</span>{t(label)}</li>)}</ol>
    <div className="onboarding-body">
      <small className="onboarding-eyebrow">{t('第 {step} 步，共 4 步', { step: step + 1 })}</small>
      <h2 id="onboarding-title" ref={heading} tabIndex={-1}>{t(['欢迎使用 OJ Insight', '添加平台账号', '同步训练记录', '开始使用'][step])}</h2>
      <p id="onboarding-description">{t([
        '添加 OJ 账号并同步记录，即可查看统计、整理题单和复盘比赛。',
        '输入个人主页中的账号 ID。同一平台的其他账号可在设置中添加。',
        '首次同步可能需要几分钟。同步后可离线查看已保存的记录。',
        '选择要打开的页面。向导可在设置中重新打开。',
      ][step])}</p>
      {step === 0 && <><div className="onboarding-features">
        <article><BarChart3 size={22} /><strong>{t('训练统计')}</strong><p>{t('查看 AC、活动记录、Rating 和难度分布。')}</p></article>
        <article><BookOpen size={22} /><strong>{t('题单与比赛')}</strong><p>{t('整理题单、创建模拟赛、记录解题笔记。')}</p></article>
        <article><ShieldCheck size={22} /><strong>{t('本地保存')}</strong><p>{t('账号和记录保存在本机，无需注册 OJI 账号。')}</p></article>
      </div><div className="onboarding-note">{t('只需添加常用平台，也可以稍后设置。')}</div></>}
      {step === 1 && <>
        {!!existing.length && <div className="onboarding-note"><strong>{t('已连接账号')}</strong><div className="onboarding-connected">{existing.map((entry) => <span key={`${entry.platform}:${entry.account}`}><PlatformIcon platform={entry.platform} />{entry.account}</span>)}</div><p>{t('可继续添加账号，已有账号会保留。')}</p></div>}
        <div className="onboarding-platforms" aria-label={t('选择平台')}>{PLATFORM_ORDER.map((p) => <button key={p} disabled={working || pendingRefresh} aria-pressed={platform === p} className={platform === p ? 'active' : ''} onClick={() => { setPlatform(p); setError(''); }}><PlatformIcon platform={p} />{PLATFORM_META[p].name}{drafts[p]?.account.trim() && <Check size={14} aria-label={t('已填写')} />}</button>)}</div>
        <div className="onboarding-account"><label htmlFor="onboarding-account">{PLATFORM_META[platform].name} · {t('账号 ID')}</label><input id="onboarding-account" value={draft.account} onChange={(event) => change('account', event.target.value)} placeholder={t(PLATFORM_META[platform].accountHint)} disabled={working || pendingRefresh} autoComplete="off" spellCheck={false} /><p>{t(PLATFORM_META[platform].accountHint)}</p>
          {platform !== 'codeforces' && PLATFORM_META[platform].secretHint && <><label htmlFor="onboarding-cookie">{t('Cookie（可选）')}</label><input id="onboarding-cookie" type="password" value={draft.secret} onChange={(event) => change('secret', event.target.value)} placeholder={t(PLATFORM_META[platform].secretHint!)} disabled={working || pendingRefresh} autoComplete="off" /></>}
          {platform === 'qoj' && <p>{t('QOJ 完整提交记录需要登录 Cookie，可在设置中补充。')}</p>}
          {platform === 'codeforces' && <p>{t('无需密码。API Key / Secret 可在账号设置中填写。')}</p>}
        </div><div className="onboarding-note"><ShieldCheck size={16} />{t('保存后再选择是否同步。')}</div>
      </>}
      {step === 2 && <>
        <div className="onboarding-sync-list" aria-live="polite">{configured.map((p) => {
          const rows = statuses.filter((value) => value.platform === p);
          const status = rows.find((value) => value.status === 'error' || value.status === 'auth_required' || value.status === 'warning') || rows[0];
          return <article key={p}><PlatformIcon platform={p} /><div><strong>{PLATFORM_META[p].name}</strong><span>{accounts[p].map((entry) => entry.account).join(' · ')}</span></div><div className="onboarding-sync-status"><strong>{syncing === p || syncing === 'all' && status?.status === 'syncing' ? t('同步中') : t(status?.status === 'ok' ? '同步成功' : status?.status === 'warning' ? '部分数据可用' : status?.status === 'error' || status?.status === 'auth_required' ? '同步失败，可重试' : '等待同步')}</strong>{status?.message && <span>{status.message}</span>}</div></article>;
        })}</div>
        {working && progress && <div className="onboarding-progress" role="status"><span>{t('已检查 {done} / {total} 个平台', { done: progress.done, total: progress.total })}</span><progress max={Math.max(1, progress.total)} value={progress.done} /></div>}
        <div className="onboarding-note">{t('同步失败会保留原有记录。详情见「设置 → 数据源」。')}</div>
      </>}
      {step === 3 && <div className="onboarding-explore">
        {([
          ['overview', BarChart3, '总览', '查看训练统计和每日记录。'],
          ['problem-sets', BookOpen, '题单', '创建题单，或从推荐题单中保存一份。'],
          ['export', Download, '导出', '保存 PNG 或 SVG 图表。'],
        ] as const).map(([page, Icon, title, description]) => <button key={page} onClick={() => onFinish(false, page)}><Icon size={22} /><div><strong>{t(title)}</strong><span>{t(description)}</span></div><ArrowRight size={18} /></button>)}
      </div>}
      {error && <p className="onboarding-error" role="alert">{error}</p>}
    </div>
    <footer className="onboarding-footer"><button className="onboarding-secondary" disabled={working} onClick={() => step ? onStep(step === 3 && !configured.length ? 1 : step - 1) : onFinish(true)}>{step ? <ChevronLeft size={16} /> : null}{t(step ? '上一步' : '稍后设置')}</button><div>
      {step === 1 && <button className="onboarding-secondary" disabled={working} onClick={() => onStep(3)}>{t('稍后连接')}</button>}
      {step === 2 && <button className="onboarding-secondary" disabled={working} onClick={() => syncSucceeded ? void sync() : onStep(3)}>{t(syncSucceeded ? '重新同步' : attempted ? '下一步' : '稍后同步')}</button>}
      <button className="primary" disabled={working || step === 1 && !pendingRefresh && !existing.length && !hasDraft || step === 2 && !configured.length} onClick={() => step === 0 ? onStep(1) : step === 1 ? void save() : step === 2 ? syncSucceeded ? onStep(3) : void sync() : onFinish(false, 'overview')}>
        {working ? <RefreshCw className="spin" size={16} /> : step === 2 && !syncSucceeded ? <RefreshCw size={16} /> : <ArrowRight size={16} />}{t(working ? step === 1 ? '保存中…' : '同步中…' : step === 0 ? '开始设置' : step === 1 ? '保存并继续' : step === 2 ? syncSucceeded ? '下一步' : attempted ? '重新同步' : '开始同步' : '进入总览')}
      </button>
    </div></footer>
  </dialog>;
}
