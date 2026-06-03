import { useState, useMemo } from 'react';
import type { CapTable, RoundResult } from '../engine/captable';
import { computeWaterfall } from '../engine/captable';
import type { SimulatorInputs } from './RoundSimulator';
import type { RoundHistory } from '../engine/multiRound';
import { applyRoundToCapTable } from '../engine/multiRound';

interface Props {
  capTable: CapTable;
  roundResult: RoundResult | null;
  roundInputs: SimulatorInputs | null;
  roundHistory: RoundHistory;
}

function fmtM(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

const COLORS = [
  'bg-sky-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-pink-500',
];

const MAX_EXIT = 100_000_000;

export default function WaterfallView({ capTable, roundResult, roundInputs, roundHistory }: Props) {
  const [exitValuation, setExitValuation] = useState(20_000_000);

  const hasMultiRound = roundHistory.rounds.length > 0;

  // When multi-round history exists, apply all rounds to get the final cap table
  // and pass it directly — no separate roundResult needed since all preferred
  // series are already represented as securities in the final table.
  const finalCapTable = useMemo(() => {
    if (!hasMultiRound) return capTable;
    let ct = capTable;
    for (const r of roundHistory.rounds) ct = applyRoundToCapTable(ct, r);
    return ct;
  }, [capTable, roundHistory, hasMultiRound]);

  const rows = useMemo(
    () =>
      hasMultiRound
        ? computeWaterfall(finalCapTable, null, exitValuation)
        : computeWaterfall(
            capTable,
            roundResult,
            exitValuation,
            roundInputs ? { ...roundInputs, conversionDate: new Date() } : undefined,
          ),
    [capTable, finalCapTable, roundResult, roundInputs, roundHistory, exitValuation, hasMultiRound],
  );

  const totalPayout = rows.reduce((s, r) => s + r.totalPayout, 0);
  const activeRows = rows.filter(r => r.totalPayout > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 uppercase tracking-widest">Liquidation Waterfall</span>
        <span className="text-[10px] text-slate-500">
          {hasMultiRound
            ? `${roundHistory.rounds.length} round${roundHistory.rounds.length > 1 ? 's' : ''} · ${roundHistory.rounds.map(r => r.name).join(' → ')}`
            : roundResult
            ? 'Series A sim'
            : 'Pre-round (common only)'}
        </span>
      </div>

      {/* Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Exit Valuation</span>
          <span className="text-white font-semibold tabular-nums">{fmtM(exitValuation)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={MAX_EXIT}
          step={250_000}
          value={exitValuation}
          onChange={e => setExitValuation(Number(e.target.value))}
          className="w-full accent-slate-400 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-600">
          <span>$0</span>
          <span>$25M</span>
          <span>$50M</span>
          <span>$75M</span>
          <span>$100M</span>
        </div>
      </div>

      {/* Stacked bar */}
      {activeRows.length > 0 && totalPayout > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex h-5 w-full rounded overflow-hidden">
            {activeRows.map((row, i) => (
              <div
                key={`${row.stakeholderId}-${i}`}
                className={`${COLORS[i % COLORS.length]} transition-all duration-150`}
                style={{ width: `${(row.totalPayout / totalPayout) * 100}%` }}
                title={`${row.stakeholderName}: ${fmtM(row.totalPayout)}`}
              />
            ))}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {activeRows.map((row, i) => (
              <div key={`leg-${i}`} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-sm ${COLORS[i % COLORS.length]}`} />
                <span className="text-[10px] text-slate-400 truncate max-w-[100px]">{row.stakeholderName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-700">
            {['Stakeholder', 'Type', 'Preference', 'Participation', 'Total Payout', '% of Exit', 'MOIC'].map(h => (
              <th key={h} className="text-left py-1.5 pr-3 last:pr-0 text-slate-500 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-center text-slate-500 text-xs">
                Run the Round Simulator first to include converted securities, or view founder/employee payouts directly.
              </td>
            </tr>
          )}
          {rows.map((row, i) => {
            const moic = row.investmentAmount > 0
              ? row.totalPayout / row.investmentAmount
              : null;
            const moicColor = moic === null ? ''
              : moic >= 3 ? 'text-emerald-400'
              : moic >= 1 ? 'text-sky-400'
              : 'text-red-400';
            return (
              <tr key={`${row.stakeholderId}-${i}`} className={`border-b border-slate-800 ${row.totalPayout === 0 ? 'opacity-40' : ''}`}>
                <td className="py-1.5 pr-3 text-slate-200">{row.stakeholderName}</td>
                <td className="py-1.5 pr-3">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    row.securityKind === 'preferred' ? 'bg-violet-900/50 text-violet-300' : 'bg-sky-900/50 text-sky-300'
                  }`}>
                    {row.securityKind}
                  </span>
                </td>
                <td className="py-1.5 pr-3 tabular-nums text-slate-300">
                  {row.preferenceAmount > 0 ? fmtM(row.preferenceAmount) : '—'}
                </td>
                <td className="py-1.5 pr-3 tabular-nums text-slate-300">
                  {row.participationAmount > 0 ? fmtM(row.participationAmount) : '—'}
                </td>
                <td className="py-1.5 pr-3 tabular-nums text-white font-medium">{fmtM(row.totalPayout)}</td>
                <td className="py-1.5 pr-3 tabular-nums text-slate-400">
                  {exitValuation > 0 ? pct(row.totalPayout / exitValuation) : '—'}
                </td>
                <td className={`py-1.5 tabular-nums font-medium ${moicColor}`}>
                  {moic !== null ? `${moic.toFixed(2)}×` : '—'}
                </td>
              </tr>
            );
          })}
          {rows.length > 0 && (
            <tr className="border-t border-slate-600">
              <td colSpan={4} className="py-1.5 text-slate-400 font-medium">Total Distributed</td>
              <td className="py-1.5 tabular-nums text-white font-semibold">{fmtM(totalPayout)}</td>
              <td className="py-1.5 tabular-nums text-slate-400">
                {exitValuation > 0 ? pct(totalPayout / exitValuation) : '—'}
              </td>
              <td />
            </tr>
          )}
        </tbody>
      </table>

      {/* Undistributed note */}
      {exitValuation > totalPayout && rows.length > 0 && (
        <p className="text-[10px] text-slate-600">
          {fmtM(exitValuation - totalPayout)} retained by company / transaction costs not modeled.
        </p>
      )}
    </div>
  );
}
