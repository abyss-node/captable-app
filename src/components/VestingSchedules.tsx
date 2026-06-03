import type { CapTable } from '../engine/captable';
import { computeVestingGrants } from '../engine/vesting';

interface Props {
  capTable: CapTable;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function VestingSchedules({ capTable }: Props) {
  const grants = computeVestingGrants(capTable, new Date());
  if (grants.length === 0) return null;

  const asOfLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="mt-3 border border-slate-700/60 rounded p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 uppercase tracking-widest">Vesting Schedules</p>
        <p className="text-[10px] text-slate-600">as of {asOfLabel}</p>
      </div>

      {grants.map(g => {
        const barColor = g.kind === 'option' ? 'bg-amber-500' : 'bg-sky-500';
        const pct = (g.vestedFraction * 100).toFixed(1);

        return (
          <div key={g.id} className="flex flex-col gap-1.5">
            {/* Header */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-200">{g.stakeholderName}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${g.kind === 'option' ? 'bg-amber-900/40 text-amber-400' : 'bg-sky-900/40 text-sky-400'}`}>
                  {g.kind === 'option' ? `Options · $${g.strikePrice?.toFixed(4)}` : 'Common'}
                </span>
                {g.fullyVested && (
                  <span className="text-[10px] text-emerald-400">Fully vested</span>
                )}
              </div>
              <span className="tabular-nums text-slate-300">
                {fmt(g.vestedShares)} <span className="text-slate-500">/ {fmt(g.totalShares)} shares</span>
              </span>
            </div>

            {/* Progress bar */}
            <div className="relative h-3 bg-slate-800 rounded overflow-hidden">
              {/* Vested fill */}
              <div
                className={`absolute inset-y-0 left-0 ${barColor} rounded transition-all`}
                style={{ width: `${g.vestedFraction * 100}%` }}
              />
              {/* Cliff marker */}
              {!g.fullyVested && g.cliffFraction > 0 && g.cliffFraction < 1 && (
                <div
                  className="absolute inset-y-0 w-px bg-white/40"
                  style={{ left: `${g.cliffFraction * 100}%` }}
                  title={`Cliff: ${g.cliffDate}`}
                />
              )}
            </div>

            {/* Key dates */}
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Grant: {g.grantDate}</span>
              {g.cliffMonths > 0 && (
                <span className={g.pastCliff ? 'text-slate-600' : 'text-amber-500/70'}>
                  {g.pastCliff ? `Cliff passed: ${g.cliffDate}` : `Cliff: ${g.cliffDate}`}
                </span>
              )}
              <span className={g.fullyVested ? 'text-emerald-600' : 'text-slate-400'}>
                {g.fullyVested ? `Vested: ${g.fullyVestsDate}` : `Fully vests: ${g.fullyVestsDate}`}
              </span>
              <span className="tabular-nums text-slate-400 font-medium">{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
