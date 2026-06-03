import { useState } from 'react';
import type { CapTable } from '../engine/captable';
import type { RoundHistory } from '../engine/multiRound';
import { simulateNextRound, applyRoundToCapTable } from '../engine/multiRound';

interface Props {
  baseCapTable: CapTable;
  history: RoundHistory;
  onHistoryChange: (h: RoundHistory) => void;
}

const ROUND_PRESETS = ['Seed', 'Series A', 'Series B', 'Series C', 'Series D'];

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtM(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

const inputCls = 'bg-slate-800/60 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-slate-500 tabular-nums w-full';

export default function MultiRoundSimulator({ baseCapTable, history, onHistoryChange }: Props) {
  const [roundName, setRoundName] = useState('Series A');
  const [preMoney, setPreMoney]     = useState('12000000');
  const [investment, setInvestment] = useState('3000000');
  const [poolPct, setPoolPct]       = useState('15');
  const [investorName, setInvestorName] = useState('Lead Investor');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function handleAdd() {
    try {
      setError(null);
      const record = simulateNextRound(
        baseCapTable,
        history,
        {
          preMoneyValuation: Number(preMoney),
          newInvestmentAmount: Number(investment),
          targetPostMoneyOptionPoolPercent: Number(poolPct),
          newInvestorName: investorName,
        },
        roundName,
      );
      onHistoryChange({ rounds: [...history.rounds, record] });
      // Advance preset for next round
      const idx = ROUND_PRESETS.indexOf(roundName);
      if (idx >= 0 && idx < ROUND_PRESETS.length - 1) {
        setRoundName(ROUND_PRESETS[idx + 1]);
      }
    } catch (e) {
      setError(String(e));
    }
  }

  function handleRemoveLast() {
    onHistoryChange({ rounds: history.rounds.slice(0, -1) });
  }

  // Build cumulative ownership after all rounds
  function getCumulativeTable() {
    let ct = baseCapTable;
    for (const r of history.rounds) ct = applyRoundToCapTable(ct, r);
    return ct;
  }

  const totalShares = (ct: CapTable) =>
    ct.securities.reduce((s, sec) => {
      if (sec.kind === 'common' || sec.kind === 'preferred' || sec.kind === 'option') return s + sec.shares;
      return s;
    }, 0);

  const baseTotal = totalShares(baseCapTable);

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs text-slate-400 uppercase tracking-widest">Multi-Round Modeling</span>

      {/* Round input form */}
      <div className="border border-slate-700/60 rounded p-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Round name</label>
            <select
              value={roundName}
              onChange={e => setRoundName(e.target.value)}
              className={inputCls}
            >
              {ROUND_PRESETS.map(p => <option key={p}>{p}</option>)}
              <option value="Bridge">Bridge</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Lead investor</label>
            <input className={inputCls} value={investorName} onChange={e => setInvestorName(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Pre-money ($)</label>
            <input className={inputCls} type="number" value={preMoney} onChange={e => setPreMoney(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Investment ($)</label>
            <input className={inputCls} type="number" value={investment} onChange={e => setInvestment(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Option pool %</label>
            <input className={inputCls} type="number" value={poolPct} onChange={e => setPoolPct(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAdd}
            className="flex-1 py-2 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded transition-colors"
          >
            + Add {roundName}
          </button>
          {history.rounds.length > 0 && (
            <button
              onClick={handleRemoveLast}
              className="px-3 py-2 border border-slate-700 text-xs text-slate-400 hover:text-red-400 hover:border-red-800 rounded transition-colors"
            >
              Undo last
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-400 border border-red-800/50 rounded p-2">{error}</p>}
      </div>

      {history.rounds.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-4">
          Add rounds above to model a multi-round funding history.
          SAFEs and notes in the base cap table convert automatically in the first priced round.
        </p>
      )}

      {/* Round timeline */}
      {history.rounds.length > 0 && (
        <div className="flex flex-col gap-2">
          {history.rounds.map((record, i) => {
            const isOpen = expanded === record.id;
            const postMoney = record.result.postMoneyValuation;
            return (
              <div key={record.id} className="border border-slate-700/60 rounded overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-800/30 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : record.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500">Round {i + 1}</span>
                    <span className="text-xs text-white font-medium">{record.name}</span>
                    <span className="text-[10px] text-slate-400">{record.inputs.newInvestorName}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs tabular-nums">
                    <span className="text-slate-300">{fmtM(postMoney)} post</span>
                    <span className="text-slate-400">${record.result.pricePerShare.toFixed(4)}/sh</span>
                    <span className="text-slate-500">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-slate-700/40">
                    <div className="grid grid-cols-4 gap-2 mt-3 mb-4">
                      {[
                        ['Pre-money', fmtM(record.inputs.preMoneyValuation)],
                        ['Raised', fmtM(record.inputs.newInvestmentAmount)],
                        ['Post-money', fmtM(postMoney)],
                        ['Price/share', `$${record.result.pricePerShare.toFixed(4)}`],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-slate-800/30 rounded p-2">
                          <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
                          <p className="text-xs text-white tabular-nums">{value}</p>
                        </div>
                      ))}
                    </div>

                    {record.result.conversions.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Conversions</p>
                        {record.result.conversions.map(c => (
                          <p key={c.securityId} className="text-[10px] text-slate-400">
                            {c.stakeholderName} ({c.kind === 'safe' ? 'SAFE' : 'Note'}) → {fmt(Math.round(c.sharesReceived))} shares @ ${c.conversionPrice.toFixed(4)} · {c.conversionBasis}
                          </p>
                        ))}
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Dilution</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700">
                          {['Stakeholder', 'Pre %', 'Post %', 'Δ'].map(h => (
                            <th key={h} className="text-left py-1 pr-3 last:pr-0 text-slate-500 font-normal text-[10px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {record.result.dilutionMatrix.map((row, j) => (
                          <tr key={j} className="border-b border-slate-800">
                            <td className="py-1 pr-3 text-slate-300 text-[10px]">{row.stakeholderName}</td>
                            <td className="py-1 pr-3 tabular-nums text-slate-400 text-[10px]">{pct(row.preOwnership)}</td>
                            <td className="py-1 pr-3 tabular-nums text-white text-[10px]">{pct(row.postOwnership)}</td>
                            <td className={`py-1 tabular-nums text-[10px] ${row.preShares === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {row.preShares === 0 ? '+new' : `-${(row.dilutionPercent * 100).toFixed(1)}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cumulative ownership summary */}
      {history.rounds.length > 0 && (() => {
        const final = getCumulativeTable();
        const finalTotal = totalShares(final);
        const stakeholderMap = new Map(final.stakeholders.map(s => [s.id, s]));

        // Group by original stakeholder, sum shares
        const ownershipMap = new Map<string, { name: string; shares: number }>();
        for (const sec of final.securities) {
          if (sec.kind === 'safe' || sec.kind === 'convertible_note') continue;
          const holder = stakeholderMap.get(sec.stakeholderId);
          if (!holder) continue;
          const key = holder.id;
          const existing = ownershipMap.get(key);
          ownershipMap.set(key, {
            name: holder.name,
            shares: (existing?.shares ?? 0) + sec.shares,
          });
        }

        const rows = [...ownershipMap.values()].sort((a, b) => b.shares - a.shares);

        return (
          <div className="border border-slate-600/60 rounded p-4 bg-slate-800/20">
            <p className="text-xs text-slate-300 uppercase tracking-widest mb-3">
              Final ownership after {history.rounds.length} round{history.rounds.length > 1 ? 's' : ''}
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-1 pr-4 text-slate-400 font-normal">Stakeholder</th>
                  <th className="text-right py-1 pr-4 text-slate-400 font-normal">Shares</th>
                  <th className="text-right py-1 pr-4 text-slate-400 font-normal">Ownership</th>
                  <th className="text-right py-1 text-slate-400 font-normal">vs. pre-seed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const baseShares = baseCapTable.securities
                    .filter(s => {
                      const h = baseCapTable.stakeholders.find(sh => sh.id === s.stakeholderId);
                      return h?.name === r.name && (s.kind === 'common' || s.kind === 'option' || s.kind === 'preferred');
                    })
                    .reduce((s, sec) => {
                      if (sec.kind === 'common' || sec.kind === 'option' || sec.kind === 'preferred') return s + sec.shares;
                      return s;
                    }, 0);
                  const baseOwnership = baseTotal > 0 ? baseShares / baseTotal : 0;
                  const finalOwnership = finalTotal > 0 ? r.shares / finalTotal : 0;
                  const delta = finalOwnership - baseOwnership;
                  return (
                    <tr key={r.name} className="border-b border-slate-800">
                      <td className="py-1.5 pr-4 text-slate-200">{r.name}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums text-slate-300">{fmt(r.shares)}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums text-white font-medium">{pct(finalOwnership)}</td>
                      <td className={`py-1.5 text-right tabular-nums text-xs ${delta < -0.001 ? 'text-red-400' : delta > 0.001 ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {baseShares === 0 ? '+new' : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-slate-600">
                  <td className="py-1.5 pr-4 text-slate-300 font-semibold">TOTAL</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums text-white font-semibold">{fmt(finalTotal)}</td>
                  <td className="py-1.5 pr-4 text-right text-white font-semibold">100.0%</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}
