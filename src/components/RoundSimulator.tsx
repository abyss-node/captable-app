import { useState } from 'react';
import type { CapTable, RoundResult } from '../engine/captable';
import { simulateRound } from '../engine/captable';

interface Props {
  capTable: CapTable;
  onResult: (result: RoundResult, inputs: SimulatorInputs) => void;
}

export interface SimulatorInputs {
  preMoneyValuation: number;
  newInvestmentAmount: number;
  targetPostMoneyOptionPoolPercent: number;
  newInvestorName: string;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtM(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function pct(n: number): string {
  return (n * 100).toFixed(2) + '%';
}

const KIND_BADGE: Record<string, string> = {
  common: 'bg-sky-900/50 text-sky-300',
  preferred: 'bg-violet-900/50 text-violet-300',
  option: 'bg-amber-900/50 text-amber-300',
};

export default function RoundSimulator({ capTable, onResult }: Props) {
  const [inputs, setInputs] = useState<SimulatorInputs>({
    preMoneyValuation: 12_000_000,
    newInvestmentAmount: 3_000_000,
    targetPostMoneyOptionPoolPercent: 15,
    newInvestorName: 'Sequoia Seed',
  });
  const [result, setResult] = useState<RoundResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = () => {
    try {
      setError(null);
      const r = simulateRound(capTable, {
        ...inputs,
        conversionDate: new Date(),
      });
      setResult(r);
      onResult(r, inputs);
    } catch (e) {
      setError(String(e));
    }
  };

  const field = (
    label: string,
    key: keyof SimulatorInputs,
    prefix = '$',
    suffix = '',
    isText = false,
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-400">{label}</label>
      <div className="flex items-center border border-slate-700 rounded bg-slate-800/50 focus-within:border-slate-500 transition-colors">
        {prefix && !isText && <span className="px-2 text-slate-500 text-xs select-none">{prefix}</span>}
        <input
          type={isText ? 'text' : 'number'}
          value={inputs[key]}
          onChange={e =>
            setInputs(prev => ({
              ...prev,
              [key]: isText ? e.target.value : Number(e.target.value),
            }))
          }
          className="flex-1 bg-transparent text-xs text-slate-200 py-2 px-2 outline-none tabular-nums w-full"
        />
        {suffix && <span className="px-2 text-slate-500 text-xs select-none">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs text-slate-400 uppercase tracking-widest">Series A Round Simulator</span>

      {/* Input grid */}
      <div className="grid grid-cols-2 gap-3">
        {field('Pre-Money Valuation', 'preMoneyValuation')}
        {field('New Investment Amount', 'newInvestmentAmount')}
        {field('Target Post-Money Option Pool', 'targetPostMoneyOptionPoolPercent', '', '%')}
        {field('New Lead Investor', 'newInvestorName', '', '', true)}
      </div>

      <button
        onClick={handleSimulate}
        className="w-full py-2.5 bg-slate-600 hover:bg-slate-500 active:bg-slate-700 text-white text-xs rounded transition-colors tracking-widest uppercase"
      >
        Simulate Round
      </button>

      {error && (
        <div className="text-xs text-red-400 border border-red-800/50 rounded p-2">{error}</div>
      )}

      {result && (
        <div className="flex flex-col gap-4 mt-1">
          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Price / Share', `$${result.pricePerShare.toFixed(4)}`],
              ['Post-Money Val.', fmtM(result.postMoneyValuation)],
              ['Total Post Shares', fmt(result.postMoneyTotalShares)],
            ].map(([label, value]) => (
              <div key={label} className="border border-slate-700 rounded p-2 bg-slate-800/30">
                <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                <p className="text-sm text-white tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          {/* Conversion details */}
          {result.conversions.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">SAFE / Note Conversions</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Investor', 'Kind', 'Accrued', 'Conv. Price', 'Shares', 'Basis'].map(h => (
                      <th key={h} className="text-left py-1 pr-3 text-slate-500 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.conversions.map(c => (
                    <tr key={c.securityId} className="border-b border-slate-800">
                      <td className="py-1 pr-3 text-slate-200">{c.stakeholderName}</td>
                      <td className="py-1 pr-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${c.kind === 'safe' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-rose-900/50 text-rose-300'}`}>
                          {c.kind === 'safe' ? 'SAFE' : 'Note'}
                        </span>
                      </td>
                      <td className="py-1 pr-3 tabular-nums text-slate-300">{fmtM(c.accrued)}</td>
                      <td className="py-1 pr-3 tabular-nums text-slate-300">${c.conversionPrice.toFixed(4)}</td>
                      <td className="py-1 pr-3 tabular-nums text-slate-300">{fmt(c.sharesReceived)}</td>
                      <td className="py-1 text-slate-400 text-[10px]">{c.conversionBasis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Dilution matrix */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Pre / Post Dilution Matrix</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-1 pr-3 text-slate-500 font-normal">Stakeholder</th>
                  <th className="text-left py-1 pr-3 text-slate-500 font-normal">Type</th>
                  <th className="text-right py-1 pr-3 text-slate-500 font-normal">Pre Shares</th>
                  <th className="text-right py-1 pr-3 text-slate-500 font-normal">Pre %</th>
                  <th className="text-right py-1 pr-3 text-slate-500 font-normal">Post Shares</th>
                  <th className="text-right py-1 pr-3 text-slate-500 font-normal">Post %</th>
                  <th className="text-right py-1 text-slate-500 font-normal">Δ Dilution</th>
                </tr>
              </thead>
              <tbody>
                {result.dilutionMatrix.map((row, i) => (
                  <tr key={`${row.stakeholderId}-${i}`} className={`border-b border-slate-800 ${i % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
                    <td className="py-1 pr-3 text-slate-200">{row.stakeholderName}</td>
                    <td className="py-1 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${KIND_BADGE[row.securityKind] ?? 'bg-slate-700 text-slate-300'}`}>
                        {row.securityKind}
                      </span>
                    </td>
                    <td className="py-1 pr-3 text-right tabular-nums text-slate-300">{fmt(row.preShares)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums text-slate-400">{pct(row.preOwnership)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums text-white font-medium">{fmt(row.postShares)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums text-white font-medium">{pct(row.postOwnership)}</td>
                    <td className={`py-1 text-right tabular-nums text-[11px] ${row.dilutionPercent > 0.01 ? 'text-red-400' : row.preShares === 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {row.preShares === 0 ? '+new' : `-${(row.dilutionPercent * 100).toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.optionPoolExpansionShares > 0 && (
              <p className="text-[10px] text-slate-500 mt-1.5">
                * Option pool expanded by {fmt(result.optionPoolExpansionShares)} shares (pre-money shuffle)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
