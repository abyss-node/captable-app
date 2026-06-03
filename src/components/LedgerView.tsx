import { useState } from 'react';
import type { CapTable, Security, Stakeholder } from '../engine/captable';
import { computeOwnership } from '../engine/captable';
import EditModal from './EditModal';
import SecurityForm from './SecurityForm';
import VestingSchedules from './VestingSchedules';

interface Props {
  capTable: CapTable;
  onUpdate?: (ct: CapTable) => void;
}

type GroupBy = 'stakeholder' | 'security';

const KIND_LABELS: Record<string, string> = {
  common: 'Common',
  preferred: 'Preferred',
  option: 'Options',
  safe: 'SAFE',
  convertible_note: 'Conv. Note',
};

const KIND_COLOR: Record<string, string> = {
  common: 'text-sky-400',
  preferred: 'text-violet-400',
  option: 'text-amber-400',
  safe: 'text-emerald-400',
  convertible_note: 'text-rose-400',
};

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function pct(n: number): string {
  return (n * 100).toFixed(2) + '%';
}

type ModalState =
  | { mode: 'add'; kind: Security['kind'] }
  | { mode: 'edit'; security: Security }
  | null;

export default function LedgerView({ capTable, onUpdate }: Props) {
  const [groupBy, setGroupBy] = useState<GroupBy>('stakeholder');
  const [modal, setModal] = useState<ModalState>(null);
  const rows = computeOwnership(capTable);

  const safes = capTable.securities.filter(s => s.kind === 'safe');
  const notes = capTable.securities.filter(s => s.kind === 'convertible_note');
  const totalShares = rows.reduce((s, r) => s + r.shares, 0);

  function handleSave(sec: Security, newStakeholder?: Stakeholder) {
    if (!onUpdate) return;
    const stakeholders = newStakeholder
      ? [...capTable.stakeholders, newStakeholder]
      : capTable.stakeholders;
    const exists = capTable.securities.some(s => s.id === sec.id);
    const securities = exists
      ? capTable.securities.map(s => s.id === sec.id ? sec : s)
      : [...capTable.securities, sec];
    onUpdate({ ...capTable, stakeholders, securities });
    setModal(null);
  }

  function handleDelete(secId: string) {
    if (!onUpdate) return;
    if (!confirm('Remove this security?')) return;
    onUpdate({ ...capTable, securities: capTable.securities.filter(s => s.id !== secId) });
  }

  const canEdit = !!onUpdate;

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 uppercase tracking-widest">Cap Table Ledger</span>
        <div className="flex gap-1">
          {(['stakeholder', 'security'] as GroupBy[]).map(g => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`px-3 py-1 text-xs rounded border transition-colors ${
                groupBy === g
                  ? 'bg-slate-600 border-slate-500 text-white'
                  : 'bg-transparent border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {g === 'stakeholder' ? 'By Holder' : 'By Type'}
            </button>
          ))}
        </div>
      </div>

      {/* Main table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 pr-4 text-slate-400 font-normal">Stakeholder</th>
              <th className="text-left py-2 pr-4 text-slate-400 font-normal">Type</th>
              <th className="text-right py-2 pr-4 text-slate-400 font-normal">Shares</th>
              <th className="text-right py-2 pr-4 text-slate-400 font-normal">Basic %</th>
              <th className="text-right py-2 text-slate-400 font-normal">Diluted %</th>
              {canEdit && <th className="w-14" />}
            </tr>
          </thead>
          <tbody>
            {rows
              .sort((a, b) =>
                groupBy === 'security'
                  ? a.securityKind.localeCompare(b.securityKind)
                  : b.shares - a.shares
              )
              .map((row, i) => {
                const sec = capTable.securities.find(s => s.id === row.securityId);
                return (
                  <tr
                    key={row.securityId}
                    className={`border-b border-slate-800 hover:bg-slate-800/40 transition-colors ${
                      i % 2 === 0 ? '' : 'bg-slate-900/30'
                    }`}
                  >
                    <td className="py-2 pr-4 text-slate-200 font-mono">{row.stakeholderName}</td>
                    <td className={`py-2 pr-4 font-mono ${KIND_COLOR[row.securityKind] ?? 'text-slate-400'}`}>
                      {KIND_LABELS[row.securityKind]}
                    </td>
                    <td className="py-2 pr-4 text-right text-slate-200 tabular-nums">{fmt(row.shares)}</td>
                    <td className="py-2 pr-4 text-right text-slate-300 tabular-nums">{pct(row.ownership)}</td>
                    <td className="py-2 text-right text-slate-300 tabular-nums">{pct(row.dilutedOwnership)}</td>
                    {canEdit && (
                      <td className="py-2 pl-3 text-right">
                        <span className="inline-flex gap-2">
                          <button
                            onClick={() => sec && setModal({ mode: 'edit', security: sec })}
                            className="text-slate-600 hover:text-slate-300 transition-colors text-[11px]"
                            title="Edit"
                          >✎</button>
                          <button
                            onClick={() => handleDelete(row.securityId)}
                            className="text-slate-600 hover:text-red-400 transition-colors text-[11px]"
                            title="Delete"
                          >✕</button>
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            <tr className="border-t border-slate-600">
              <td className="py-2 pr-4 text-slate-300 font-semibold">TOTAL</td>
              <td />
              <td className="py-2 pr-4 text-right text-white font-semibold tabular-nums">{fmt(totalShares)}</td>
              <td className="py-2 pr-4 text-right text-white font-semibold">100.00%</td>
              <td className="py-2 text-right text-white font-semibold">100.00%</td>
              {canEdit && <td />}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add security buttons */}
      {canEdit && (
        <div className="flex flex-wrap gap-2 pt-1">
          {(['common', 'preferred', 'option', 'safe', 'convertible_note'] as Security['kind'][]).map(k => (
            <button
              key={k}
              onClick={() => setModal({ mode: 'add', kind: k })}
              className="px-2.5 py-1 text-[10px] border border-slate-700 rounded text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
            >
              + {KIND_LABELS[k]}
            </button>
          ))}
        </div>
      )}

      {/* Unpriced instruments summary */}
      {(safes.length > 0 || notes.length > 0) && (
        <div className="mt-2 border border-slate-700/60 rounded p-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Unpriced Instruments (not yet converted)</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-1 pr-4 text-slate-500 font-normal">Name</th>
                <th className="text-left py-1 pr-4 text-slate-500 font-normal">Kind</th>
                <th className="text-right py-1 pr-4 text-slate-500 font-normal">Amount</th>
                <th className="text-left py-1 text-slate-500 font-normal">Terms</th>
              </tr>
            </thead>
            <tbody>
              {safes.map(s => {
                if (s.kind !== 'safe') return null;
                const holder = capTable.stakeholders.find(sh => sh.id === s.stakeholderId);
                const terms = s.safeType === 'cap_only'
                  ? `Cap $${(s.valuationCap! / 1e6).toFixed(1)}M`
                  : s.safeType === 'discount_only'
                  ? `${(s.discountRate! * 100).toFixed(0)}% disc`
                  : `Cap $${(s.valuationCap! / 1e6).toFixed(1)}M · ${(s.discountRate! * 100).toFixed(0)}% disc`;
                return (
                  <tr key={s.id} className="border-b border-slate-800">
                    <td className="py-1 pr-4 text-slate-300">{holder?.name}</td>
                    <td className="py-1 pr-4 text-emerald-400">SAFE</td>
                    <td className="py-1 pr-4 text-right text-slate-300 tabular-nums">${fmt(s.investmentAmount)}</td>
                    <td className="py-1 text-slate-400">{terms}</td>
                    {canEdit && (
                      <td className="py-1 pl-3">
                        <span className="inline-flex gap-2">
                          <button onClick={() => setModal({ mode: 'edit', security: s })} className="text-slate-600 hover:text-slate-300 text-[11px]">✎</button>
                          <button onClick={() => handleDelete(s.id)} className="text-slate-600 hover:text-red-400 text-[11px]">✕</button>
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
              {notes.map(n => {
                if (n.kind !== 'convertible_note') return null;
                const holder = capTable.stakeholders.find(sh => sh.id === n.stakeholderId);
                return (
                  <tr key={n.id} className="border-b border-slate-800">
                    <td className="py-1 pr-4 text-slate-300">{holder?.name}</td>
                    <td className="py-1 pr-4 text-rose-400">Conv. Note</td>
                    <td className="py-1 pr-4 text-right text-slate-300 tabular-nums">${fmt(n.principalAmount)}</td>
                    <td className="py-1 text-slate-400">
                      {(n.interestRate * 100).toFixed(0)}% {n.compoundingFrequency}
                      {n.valuationCap ? ` · Cap $${(n.valuationCap / 1e6).toFixed(1)}M` : ''}
                      {n.discountRate ? ` · ${(n.discountRate * 100).toFixed(0)}% disc` : ''}
                    </td>
                    {canEdit && (
                      <td className="py-1 pl-3">
                        <span className="inline-flex gap-2">
                          <button onClick={() => setModal({ mode: 'edit', security: n })} className="text-slate-600 hover:text-slate-300 text-[11px]">✎</button>
                          <button onClick={() => handleDelete(n.id)} className="text-slate-600 hover:text-red-400 text-[11px]">✕</button>
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <VestingSchedules capTable={capTable} />

      {/* Edit / Add modal */}
      {modal && (
        <EditModal
          title={modal.mode === 'add' ? `Add ${KIND_LABELS[modal.kind]}` : 'Edit security'}
          onClose={() => setModal(null)}
        >
          <SecurityForm
            kind={modal.mode === 'add' ? modal.kind : modal.security.kind}
            existing={modal.mode === 'edit' ? modal.security : undefined}
            stakeholders={capTable.stakeholders}
            fmvPerShare={capTable.fmvPerShare}
            onSave={handleSave}
            onCancel={() => setModal(null)}
          />
        </EditModal>
      )}
    </div>
  );
}
