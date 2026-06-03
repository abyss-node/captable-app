import { useState, useEffect, useRef } from 'react';
import type { CapTable, RoundResult } from './engine/captable';
import { encodeCapTableToHash, decodeCapTableFromHash } from './engine/captable';
import { INITIAL_CAP_TABLE } from './data/mockData';
import type { RoundHistory } from './engine/multiRound';
import type { AuditLog } from './engine/audit';
import {
  diffCapTables, makeImportEntry, makeResetEntry,
  loadAuditLog, saveAuditLog, appendToLog, clearAuditLog,
} from './engine/audit';
import LedgerView from './components/LedgerView';
import RoundSimulator from './components/RoundSimulator';
import type { SimulatorInputs } from './components/RoundSimulator';
import WaterfallView from './components/WaterfallView';
import ImportExport from './components/ImportExport';
import MultiRoundSimulator from './components/MultiRoundSimulator';
import AuditLogView from './components/AuditLogView';
import OnboardingWizard from './components/OnboardingWizard';

type Panel = 'ledger' | 'simulator' | 'multisim' | 'waterfall' | 'io' | 'audit';

const NAV: { id: Panel; label: string }[] = [
  { id: 'ledger', label: 'Ledger' },
  { id: 'simulator', label: 'Round Sim' },
  { id: 'multisim', label: 'Multi-Round' },
  { id: 'waterfall', label: 'Waterfall' },
  { id: 'io', label: 'Import / Export' },
  { id: 'audit', label: 'Audit Log' },
];

const STORAGE_KEY        = 'captable-app-state';
const ROUND_HISTORY_KEY  = 'captable-app-rounds';
const ACTIVE_PANEL_KEY   = 'captable-app-panel';

function saveCapTable(ct: CapTable): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ct)); } catch { /* full */ }
}

function saveRoundHistory(h: RoundHistory): void {
  try { localStorage.setItem(ROUND_HISTORY_KEY, JSON.stringify(h)); } catch { /* full */ }
}

function loadRoundHistory(): RoundHistory {
  try {
    const raw = localStorage.getItem(ROUND_HISTORY_KEY);
    if (!raw) return { rounds: [] };
    const parsed = JSON.parse(raw) as RoundHistory;
    if (Array.isArray(parsed.rounds)) return parsed;
  } catch { /* corrupt */ }
  return { rounds: [] };
}

function saveActivePanel(panel: string): void {
  try { localStorage.setItem(ACTIVE_PANEL_KEY, panel); } catch { /* full */ }
}

function loadActivePanel(): Panel {
  try {
    const p = localStorage.getItem(ACTIVE_PANEL_KEY) as Panel | null;
    const valid: Panel[] = ['ledger','simulator','multisim','waterfall','io','audit'];
    if (p && valid.includes(p)) return p;
  } catch { /* ignore */ }
  return 'ledger';
}

function loadInitialCapTable(): CapTable {
  // 1. Shared URL hash takes priority
  const hash = window.location.hash;
  if (hash.length > 1) {
    const decoded = decodeCapTableFromHash(hash.slice(1));
    if (decoded) return decoded;
  }
  // 2. Saved session
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const ct = JSON.parse(saved) as CapTable;
      if (Array.isArray(ct.stakeholders) && Array.isArray(ct.securities)) return ct;
    }
  } catch { /* ignore corrupt data */ }
  // 3. Default sandbox
  return INITIAL_CAP_TABLE;
}

export default function App() {
  const [capTable, setCapTable] = useState<CapTable>(loadInitialCapTable);
  const [activePanel, setActivePanel] = useState<Panel>(loadActivePanel);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [roundInputs, setRoundInputs] = useState<SimulatorInputs | null>(null);
  const [roundHistory, setRoundHistory] = useState<RoundHistory>(loadRoundHistory);
  const [auditLog, setAuditLog] = useState<AuditLog>(loadAuditLog);
  const [showWizard, setShowWizard] = useState(() => {
    // Show wizard only on a genuine first visit: no saved session, no shared URL
    const hasHash = window.location.hash.length > 1;
    const hasSaved = !!localStorage.getItem(STORAGE_KEY);
    return !hasHash && !hasSaved;
  });
  const [shareCopied, setShareCopied] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [editingField, setEditingField] = useState<'name' | 'auth' | 'fmv' | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftAuth, setDraftAuth] = useState('');
  const [draftFMV, setDraftFMV] = useState('');
  const [authError, setAuthError] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const authInputRef = useRef<HTMLInputElement>(null);
  const fmvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = `${capTable.companyName} · Cap Table`;
  }, [capTable.companyName]);

  function startEditName() {
    setDraftName(capTable.companyName);
    setEditingField('name');
    setTimeout(() => nameInputRef.current?.select(), 0);
  }

  function commitName() {
    const trimmed = draftName.trim();
    if (trimmed) updateCapTable({ ...capTable, companyName: trimmed });
    setEditingField(null);
  }

  function startEditAuth() {
    setDraftAuth(String(capTable.authorizedShares));
    setAuthError(false);
    setEditingField('auth');
    setTimeout(() => authInputRef.current?.select(), 0);
  }

  function commitAuth() {
    const val = Number(draftAuth);
    if (val <= totalPreShares) { setAuthError(true); return; }
    updateCapTable({ ...capTable, authorizedShares: val });
    setEditingField(null);
    setAuthError(false);
  }

  function startEditFMV() {
    setDraftFMV(capTable.fmvPerShare ? String(capTable.fmvPerShare) : '');
    setEditingField('fmv');
    setTimeout(() => fmvInputRef.current?.select(), 0);
  }

  function commitFMV() {
    const val = Number(draftFMV);
    updateCapTable({ ...capTable, fmvPerShare: val > 0 ? val : undefined });
    setEditingField(null);
  }

  function updateCapTable(ct: CapTable) {
    const entries = diffCapTables(capTable, ct);
    const newLog = appendToLog(auditLog, entries);
    setCapTable(ct);
    saveCapTable(ct);
    setAuditLog(newLog);
    saveAuditLog(newLog);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }

  function resetToDefault() {
    const entry = makeResetEntry();
    const newLog = appendToLog(auditLog, [entry]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ROUND_HISTORY_KEY);
    window.location.hash = '';
    setCapTable(INITIAL_CAP_TABLE);
    setAuditLog(newLog);
    saveAuditLog(newLog);
    setRoundResult(null);
    setRoundInputs(null);
    setRoundHistory({ rounds: [] });
  }

  function startNewCompany() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ROUND_HISTORY_KEY);
    clearAuditLog();
    window.location.hash = '';
    setCapTable(INITIAL_CAP_TABLE);
    setAuditLog([]);
    setRoundResult(null);
    setRoundInputs(null);
    setRoundHistory({ rounds: [] });
    setShowWizard(true);
  }

  function handleShare() {
    const encoded = encodeCapTableToHash(capTable);
    window.location.hash = encoded;
    const url = window.location.href;
    navigator.clipboard.writeText(url).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  }

  const totalPreShares = capTable.securities.reduce((s, sec) => {
    if (sec.kind === 'common' || sec.kind === 'option' || sec.kind === 'preferred') return s + sec.shares;
    return s;
  }, 0);

  const totalCapital = capTable.securities.reduce((s, sec) => {
    if (sec.kind === 'safe') return s + sec.investmentAmount;
    if (sec.kind === 'convertible_note') return s + sec.principalAmount;
    return s;
  }, 0);

  if (showWizard) {
    return (
      <OnboardingWizard
        onComplete={ct => {
          const entry = { id: crypto.randomUUID?.() ?? Date.now().toString(), timestamp: new Date().toISOString(), action: 'import' as const, description: `Created cap table for "${ct.companyName}"` };
          const newLog = appendToLog(auditLog, [entry]);
          setCapTable(ct);
          saveCapTable(ct);
          setAuditLog(newLog);
          saveAuditLog(newLog);
          setShowWizard(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0d14] text-slate-200 font-mono flex flex-col">
      {/* Top bar */}
      <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
          {editingField === 'name' ? (
            <input
              ref={nameInputRef}
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') setEditingField(null);
              }}
              className="text-sm font-semibold tracking-tight text-white bg-transparent border-b border-slate-500 outline-none w-56"
            />
          ) : (
            <button
              onClick={startEditName}
              className="text-sm font-semibold tracking-tight text-white hover:text-slate-300 transition-colors text-left"
              title="Click to edit company name"
            >
              {capTable.companyName}
            </button>
          )}
          <span className="text-xs text-slate-500">Cap Table</span>
        </div>
        <div className="flex items-center gap-3 md:gap-5 text-xs text-slate-500">
          <span className="hidden md:inline">
            <span className="text-slate-300">{totalPreShares.toLocaleString()}</span> shares issued
          </span>
          <span className="hidden md:inline">
            <span className="text-slate-300">${(totalCapital / 1e3).toFixed(0)}K</span> unpriced capital
          </span>
          <span className="hidden md:flex items-center gap-1">
            Auth:{' '}
            {editingField === 'auth' ? (
              <input
                ref={authInputRef}
                type="number"
                value={draftAuth}
                onChange={e => { setDraftAuth(e.target.value); setAuthError(false); }}
                onBlur={commitAuth}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitAuth();
                  if (e.key === 'Escape') setEditingField(null);
                }}
                className={`w-28 bg-transparent border-b outline-none tabular-nums text-slate-300 ${authError ? 'border-red-500 text-red-400' : 'border-slate-500'}`}
              />
            ) : (
              <button
                onClick={startEditAuth}
                className="text-slate-300 hover:text-white transition-colors tabular-nums"
                title="Click to edit authorized shares"
              >
                {capTable.authorizedShares.toLocaleString()}
              </button>
            )}
            {authError && <span className="text-red-400 text-[10px]">must exceed issued</span>}
          </span>
          <span className="hidden md:flex items-center gap-1">
            409A:{' '}
            {editingField === 'fmv' ? (
              <input
                ref={fmvInputRef}
                type="number"
                step="0.01"
                value={draftFMV}
                onChange={e => setDraftFMV(e.target.value)}
                onBlur={commitFMV}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitFMV();
                  if (e.key === 'Escape') setEditingField(null);
                }}
                className="w-20 bg-transparent border-b border-slate-500 outline-none tabular-nums text-amber-300"
                placeholder="0.00"
              />
            ) : (
              <button
                onClick={startEditFMV}
                className="tabular-nums transition-colors hover:text-white"
                title="Click to set current 409A fair market value per share"
              >
                {capTable.fmvPerShare
                  ? <span className="text-amber-400">${capTable.fmvPerShare.toFixed(2)}/sh</span>
                  : <span className="text-slate-600 hover:text-slate-400">not set</span>
                }
              </button>
            )}
          </span>
          {savedFlash && (
            <span className="text-[10px] text-emerald-500 transition-opacity">saved</span>
          )}
          <button
            onClick={handleShare}
            className={`px-3 py-1.5 rounded border text-xs transition-colors ${
              shareCopied
                ? 'border-emerald-600 text-emerald-400 bg-emerald-900/20'
                : 'border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white'
            }`}
          >
            {shareCopied ? 'Link copied!' : 'Share'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar nav — desktop only */}
        <nav className="hidden md:flex w-36 border-r border-slate-800 flex-col pt-4 px-2 gap-0.5 shrink-0">
          {NAV.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { setActivePanel(id); saveActivePanel(id); }}
              className={`text-left px-3 py-2.5 rounded text-xs transition-colors ${
                activePanel === id
                  ? 'bg-slate-700/70 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {label}
            </button>
          ))}

          {roundResult && (
            <div className="mt-4 px-3 py-2 border border-slate-700/50 rounded bg-slate-800/30">
              <p className="text-[10px] text-slate-500 mb-1">Last Sim</p>
              <p className="text-[10px] text-emerald-400">
                ${(roundResult.postMoneyValuation / 1e6).toFixed(1)}M post
              </p>
              <p className="text-[10px] text-slate-400">
                ${roundResult.pricePerShare.toFixed(4)}/sh
              </p>
            </div>
          )}
        </nav>

        {/* Main panel */}
        <main className="flex-1 p-3 md:p-6 overflow-y-auto pb-20 md:pb-6">
          <div className="max-w-5xl">
            {activePanel === 'ledger' && (
              <LedgerView capTable={capTable} onUpdate={updateCapTable} />
            )}
            {activePanel === 'simulator' && (
              <RoundSimulator
                capTable={capTable}
                onResult={(result, inputs) => {
                  setRoundResult(result);
                  setRoundInputs(inputs);
                }}
              />
            )}
            {activePanel === 'multisim' && (
              <MultiRoundSimulator
                baseCapTable={capTable}
                history={roundHistory}
                onHistoryChange={h => { setRoundHistory(h); saveRoundHistory(h); }}
              />
            )}
            {activePanel === 'waterfall' && (
              <WaterfallView
                capTable={capTable}
                roundResult={roundResult}
                roundInputs={roundInputs}
                roundHistory={roundHistory}
              />
            )}
            {activePanel === 'io' && (
              <ImportExport
                capTable={capTable}
                onImport={ct => {
                  const entry = makeImportEntry(ct.companyName);
                  const newLog = appendToLog(auditLog, [entry]);
                  setCapTable(ct);
                  saveCapTable(ct);
                  setAuditLog(newLog);
                  saveAuditLog(newLog);
                  setRoundResult(null);
                  setRoundInputs(null);
                }}
                onReset={resetToDefault}
                onNewCompany={startNewCompany}
              />
            )}
            {activePanel === 'audit' && (
              <AuditLogView
                log={auditLog}
                onClear={() => {
                  clearAuditLog();
                  setAuditLog([]);
                }}
              />
            )}
          </div>
        </main>
      </div>

      {/* Bottom tab bar — mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0b0d14] border-t border-slate-800 flex items-stretch z-40">
        {NAV.map(({ id, label }) => {
          const short: Record<string, string> = {
            ledger: 'Ledger', simulator: 'Sim', multisim: 'Rounds',
            waterfall: 'Waterfall', io: 'Export', audit: 'Audit',
          };
          return (
            <button
              key={id}
              onClick={() => { setActivePanel(id); saveActivePanel(id); }}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] transition-colors ${
                activePanel === id ? 'text-white' : 'text-slate-600'
              }`}
            >
              <div className={`w-1 h-1 rounded-full ${activePanel === id ? 'bg-sky-400' : 'bg-transparent'}`} />
              {short[id] ?? label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
