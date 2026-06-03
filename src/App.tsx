import { useState } from 'react';
import type { CapTable, RoundResult } from './engine/captable';
import { INITIAL_CAP_TABLE } from './data/mockData';
import LedgerView from './components/LedgerView';
import RoundSimulator from './components/RoundSimulator';
import type { SimulatorInputs } from './components/RoundSimulator';
import WaterfallView from './components/WaterfallView';
import ImportExport from './components/ImportExport';
type Panel = 'ledger' | 'simulator' | 'waterfall' | 'io';

const NAV: { id: Panel; label: string }[] = [
  { id: 'ledger', label: 'Ledger' },
  { id: 'simulator', label: 'Round Sim' },
  { id: 'waterfall', label: 'Waterfall' },
  { id: 'io', label: 'Import / Export' },
];

export default function App() {
  const [capTable, setCapTable] = useState<CapTable>(INITIAL_CAP_TABLE);
  const [activePanel, setActivePanel] = useState<Panel>('ledger');
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [roundInputs, setRoundInputs] = useState<SimulatorInputs | null>(null);

  const totalPreShares = capTable.securities.reduce((s, sec) => {
    if (sec.kind === 'common' || sec.kind === 'option' || sec.kind === 'preferred') return s + sec.shares;
    return s;
  }, 0);

  const totalCapital = capTable.securities.reduce((s, sec) => {
    if (sec.kind === 'safe') return s + sec.investmentAmount;
    if (sec.kind === 'convertible_note') return s + sec.principalAmount;
    return s;
  }, 0);

  return (
    <div className="min-h-screen bg-[#0b0d14] text-slate-200 font-mono flex flex-col">
      {/* Top bar */}
      <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="text-sm font-semibold tracking-tight text-white">
            {capTable.companyName}
          </span>
          <span className="text-xs text-slate-500">Cap Table</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-slate-500">
          <span>
            <span className="text-slate-300">{totalPreShares.toLocaleString()}</span> shares issued
          </span>
          <span>
            <span className="text-slate-300">${(totalCapital / 1e3).toFixed(0)}K</span> unpriced capital
          </span>
          <span>
            Auth: <span className="text-slate-300">{capTable.authorizedShares.toLocaleString()}</span>
          </span>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar nav */}
        <nav className="w-36 border-r border-slate-800 flex flex-col pt-4 px-2 gap-0.5 shrink-0">
          {NAV.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActivePanel(id)}
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
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-5xl">
            {activePanel === 'ledger' && (
              <LedgerView capTable={capTable} />
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
            {activePanel === 'waterfall' && (
              <WaterfallView
                capTable={capTable}
                roundResult={roundResult}
                roundInputs={roundInputs}
              />
            )}
            {activePanel === 'io' && (
              <ImportExport
                capTable={capTable}
                onImport={ct => {
                  setCapTable(ct);
                  setRoundResult(null);
                  setRoundInputs(null);
                }}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
