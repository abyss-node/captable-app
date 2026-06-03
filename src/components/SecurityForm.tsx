import { useState } from 'react';
import type {
  Security, Stakeholder, CommonStock, PreferredStock,
  StockOption, SAFE, ConvertibleNote, SafeType, PreferenceType,
} from '../engine/captable';

type SecurityKind = Security['kind'];

interface Props {
  kind: SecurityKind;
  existing?: Security;
  stakeholders: Stakeholder[];
  onSave: (sec: Security, newStakeholder?: Stakeholder) => void;
  onCancel: () => void;
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const KIND_LABELS: Record<SecurityKind, string> = {
  common: 'Common Stock',
  preferred: 'Preferred Stock',
  option: 'Stock Option',
  safe: 'SAFE',
  convertible_note: 'Convertible Note',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'bg-slate-800/60 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-slate-500 tabular-nums w-full';
const selectCls = inputCls;

export default function SecurityForm({ kind, existing, stakeholders, onSave, onCancel }: Props) {
  const isNew = !existing;

  // ── Stakeholder selection ──────────────────────────────────────────────────
  const [stakeholderId, setStakeholderId] = useState(existing?.stakeholderId ?? '');
  const [newHolderName, setNewHolderName] = useState('');
  const [newHolderType, setNewHolderType] = useState<Stakeholder['type']>('founder');
  const isNewHolder = stakeholderId === '__new__';

  // ── Common ─────────────────────────────────────────────────────────────────
  const c = existing?.kind === 'common' ? existing : null;
  const [cShares, setCShares]             = useState(String(c?.shares ?? 1_000_000));
  const [cGrantDate, setCGrantDate]       = useState(c?.grantDate ?? new Date().toISOString().slice(0, 10));
  const [cVesting, setCVesting]           = useState(String(c?.vestingMonths ?? 48));
  const [cCliff, setCCliff]               = useState(String(c?.cliffMonths ?? 12));

  // ── Preferred ──────────────────────────────────────────────────────────────
  const p = existing?.kind === 'preferred' ? existing : null;
  const [pShares, setPShares]             = useState(String(p?.shares ?? 0));
  const [pSeries, setPSeries]             = useState(p?.seriesName ?? 'Series A');
  const [pOIP, setPOIP]                   = useState(String(p?.originalIssuePricePerShare ?? 1));
  const [pMultiple, setPMultiple]         = useState(String(p?.liquidationPreferenceMultiple ?? 1));
  const [pPrefType, setPPrefType]         = useState<PreferenceType>(p?.preferenceType ?? 'non_participating');
  const [pInvestment, setPInvestment]     = useState(String(p?.investmentAmount ?? 0));
  const [pAntiDilution, setPAntiDilution] = useState(p?.isAntiDilutionProtected ?? false);
  const [pParticipationCap, setPParticipationCap] = useState(String(p?.participationCap ?? 3));

  // ── Option ─────────────────────────────────────────────────────────────────
  const o = existing?.kind === 'option' ? existing : null;
  const [oShares, setOShares]       = useState(String(o?.shares ?? 100_000));
  const [oStrike, setOStrike]       = useState(String(o?.strikePrice ?? 0.10));
  const [oGrant, setOGrant]         = useState(o?.grantDate ?? new Date().toISOString().slice(0, 10));
  const [oVesting, setOVesting]     = useState(String(o?.vestingMonths ?? 48));
  const [oCliff, setOCliff]         = useState(String(o?.cliffMonths ?? 12));
  const [oExercised, setOExercised] = useState(o?.exercised ?? false);

  // ── SAFE ───────────────────────────────────────────────────────────────────
  const s = existing?.kind === 'safe' ? existing : null;
  const [sAmount, setSAmount]         = useState(String(s?.investmentAmount ?? 100_000));
  const [sType, setSType]             = useState<SafeType>(s?.safeType ?? 'cap_only');
  const [sCap, setSCap]               = useState(String(s?.valuationCap ?? 8_000_000));
  const [sDiscount, setSDiscount]     = useState(String(s != null && s.discountRate != null ? s.discountRate * 100 : 20));

  // ── Convertible Note ───────────────────────────────────────────────────────
  const n = existing?.kind === 'convertible_note' ? existing : null;
  const [nPrincipal, setNPrincipal]   = useState(String(n?.principalAmount ?? 250_000));
  const [nRate, setNRate]             = useState(String(n != null ? n.interestRate * 100 : 8));
  const [nIssue, setNIssue]           = useState(n?.issueDate ?? new Date().toISOString().slice(0, 10));
  const [nMaturity, setNMaturity]     = useState(n?.maturityDate ?? '');
  const [nCap, setNCap]               = useState(String(n?.valuationCap ?? 10_000_000));
  const [nDiscount, setNDiscount]     = useState(String(n != null && n.discountRate != null ? n.discountRate * 100 : 20));
  const [nCompounding, setNCompounding] = useState<ConvertibleNote['compoundingFrequency']>(n?.compoundingFrequency ?? 'annual');

  // ── Save ───────────────────────────────────────────────────────────────────
  function handleSave() {
    const holderId = isNewHolder ? `holder-${uid()}` : stakeholderId;
    if (!holderId && !isNewHolder) return;

    const id = existing?.id ?? `${kind}-${uid()}`;
    let sec: Security;

    if (kind === 'common') {
      sec = { kind, id, stakeholderId: holderId, shares: Number(cShares), grantDate: cGrantDate, vestingMonths: Number(cVesting), cliffMonths: Number(cCliff) } satisfies CommonStock;
    } else if (kind === 'preferred') {
      sec = { kind, id, stakeholderId: holderId, shares: Number(pShares), seriesName: pSeries, originalIssuePricePerShare: Number(pOIP), liquidationPreferenceMultiple: Number(pMultiple), preferenceType: pPrefType, investmentAmount: Number(pInvestment), isAntiDilutionProtected: pAntiDilution, ...(pPrefType === 'participating_capped' ? { participationCap: Number(pParticipationCap) } : {}) } satisfies PreferredStock;
    } else if (kind === 'option') {
      sec = { kind, id, stakeholderId: holderId, shares: Number(oShares), strikePrice: Number(oStrike), grantDate: oGrant, vestingMonths: Number(oVesting), cliffMonths: Number(oCliff), exercised: oExercised } satisfies StockOption;
    } else if (kind === 'safe') {
      sec = { kind, id, stakeholderId: holderId, investmentAmount: Number(sAmount), safeType: sType, ...(sType !== 'discount_only' ? { valuationCap: Number(sCap) } : {}), ...(sType !== 'cap_only' ? { discountRate: Number(sDiscount) / 100 } : {}) } satisfies SAFE;
    } else {
      sec = { kind, id, stakeholderId: holderId, principalAmount: Number(nPrincipal), interestRate: Number(nRate) / 100, issueDate: nIssue, maturityDate: nMaturity, valuationCap: Number(nCap), discountRate: Number(nDiscount) / 100, compoundingFrequency: nCompounding } satisfies ConvertibleNote;
    }

    const newStakeholder: Stakeholder | undefined = isNewHolder && newHolderName.trim()
      ? { id: holderId, name: newHolderName.trim(), type: newHolderType }
      : undefined;

    onSave(sec, newStakeholder);
  }

  const needsCap     = sType === 'cap_only' || sType === 'most_favorable' || sType === 'post_money_safe';
  const needsDiscount = sType === 'discount_only' || sType === 'most_favorable';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-400">{KIND_LABELS[kind]}</p>

      {/* Stakeholder */}
      <Field label="Stakeholder">
        <select value={stakeholderId} onChange={e => setStakeholderId(e.target.value)} className={selectCls}>
          <option value="">— select —</option>
          {stakeholders.map(sh => (
            <option key={sh.id} value={sh.id}>{sh.name} ({sh.type})</option>
          ))}
          <option value="__new__">+ New stakeholder</option>
        </select>
      </Field>

      {isNewHolder && (
        <div className="grid grid-cols-2 gap-3 pl-3 border-l border-slate-700">
          <Field label="Name">
            <input className={inputCls} value={newHolderName} onChange={e => setNewHolderName(e.target.value)} placeholder="Alice Chen" />
          </Field>
          <Field label="Type">
            <select className={selectCls} value={newHolderType} onChange={e => setNewHolderType(e.target.value as Stakeholder['type'])}>
              {['founder','employee','angel','vc','option_pool'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
      )}

      {/* Kind-specific fields */}
      {kind === 'common' && <>
        <Field label="Shares"><input className={inputCls} type="number" value={cShares} onChange={e => setCShares(e.target.value)} /></Field>
        <Field label="Grant date"><input className={inputCls} type="date" value={cGrantDate} onChange={e => setCGrantDate(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vesting (months)"><input className={inputCls} type="number" value={cVesting} onChange={e => setCVesting(e.target.value)} /></Field>
          <Field label="Cliff (months)"><input className={inputCls} type="number" value={cCliff} onChange={e => setCCliff(e.target.value)} /></Field>
        </div>
      </>}

      {kind === 'preferred' && <>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Series name"><input className={inputCls} value={pSeries} onChange={e => setPSeries(e.target.value)} /></Field>
          <Field label="Investment ($)"><input className={inputCls} type="number" value={pInvestment} onChange={e => setPInvestment(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Shares"><input className={inputCls} type="number" value={pShares} onChange={e => setPShares(e.target.value)} /></Field>
          <Field label="Issue price / share ($)"><input className={inputCls} type="number" step="0.0001" value={pOIP} onChange={e => setPOIP(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Liquidation multiple">
            <select className={selectCls} value={pMultiple} onChange={e => setPMultiple(e.target.value)}>
              {['1','1.5','2','2.5','3'].map(v => <option key={v} value={v}>{v}×</option>)}
            </select>
          </Field>
          <Field label="Preference type">
            <select className={selectCls} value={pPrefType} onChange={e => setPPrefType(e.target.value as PreferenceType)}>
              <option value="non_participating">Non-participating</option>
              <option value="participating">Participating</option>
              <option value="participating_capped">Participating (capped)</option>
            </select>
          </Field>
        </div>
        {pPrefType === 'participating_capped' && (
          <Field label="Participation cap (×)"><input className={inputCls} type="number" step="0.5" value={pParticipationCap} onChange={e => setPParticipationCap(e.target.value)} /></Field>
        )}
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input type="checkbox" checked={pAntiDilution} onChange={e => setPAntiDilution(e.target.checked)} className="accent-slate-400" />
          Anti-dilution protection
        </label>
      </>}

      {kind === 'option' && <>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Shares"><input className={inputCls} type="number" value={oShares} onChange={e => setOShares(e.target.value)} /></Field>
          <Field label="Strike price ($)"><input className={inputCls} type="number" step="0.0001" value={oStrike} onChange={e => setOStrike(e.target.value)} /></Field>
        </div>
        <Field label="Grant date"><input className={inputCls} type="date" value={oGrant} onChange={e => setOGrant(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vesting (months)"><input className={inputCls} type="number" value={oVesting} onChange={e => setOVesting(e.target.value)} /></Field>
          <Field label="Cliff (months)"><input className={inputCls} type="number" value={oCliff} onChange={e => setOCliff(e.target.value)} /></Field>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input type="checkbox" checked={oExercised} onChange={e => setOExercised(e.target.checked)} className="accent-slate-400" />
          Already exercised
        </label>
      </>}

      {kind === 'safe' && <>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Investment ($)"><input className={inputCls} type="number" value={sAmount} onChange={e => setSAmount(e.target.value)} /></Field>
          <Field label="SAFE type">
            <select className={selectCls} value={sType} onChange={e => setSType(e.target.value as SafeType)}>
              <option value="cap_only">Cap only</option>
              <option value="discount_only">Discount only</option>
              <option value="most_favorable">Most favorable</option>
              <option value="post_money_safe">Post-money SAFE</option>
            </select>
          </Field>
        </div>
        {needsCap && (
          <Field label="Valuation cap ($)"><input className={inputCls} type="number" value={sCap} onChange={e => setSCap(e.target.value)} /></Field>
        )}
        {needsDiscount && (
          <Field label="Discount rate (%)"><input className={inputCls} type="number" min="0" max="100" value={sDiscount} onChange={e => setSDiscount(e.target.value)} /></Field>
        )}
      </>}

      {kind === 'convertible_note' && <>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Principal ($)"><input className={inputCls} type="number" value={nPrincipal} onChange={e => setNPrincipal(e.target.value)} /></Field>
          <Field label="Interest rate (%)"><input className={inputCls} type="number" step="0.1" value={nRate} onChange={e => setNRate(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Issue date"><input className={inputCls} type="date" value={nIssue} onChange={e => setNIssue(e.target.value)} /></Field>
          <Field label="Maturity date"><input className={inputCls} type="date" value={nMaturity} onChange={e => setNMaturity(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valuation cap ($)"><input className={inputCls} type="number" value={nCap} onChange={e => setNCap(e.target.value)} /></Field>
          <Field label="Discount rate (%)"><input className={inputCls} type="number" min="0" max="100" value={nDiscount} onChange={e => setNDiscount(e.target.value)} /></Field>
        </div>
        <Field label="Compounding">
          <select className={selectCls} value={nCompounding} onChange={e => setNCompounding(e.target.value as ConvertibleNote['compoundingFrequency'])}>
            <option value="simple">Simple</option>
            <option value="annual">Annual</option>
            <option value="quarterly">Quarterly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>
      </>}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-slate-700/60">
        <button
          onClick={handleSave}
          disabled={!stakeholderId || (isNewHolder && !newHolderName.trim())}
          className="flex-1 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
        >
          {isNew ? 'Add' : 'Save changes'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-slate-700 text-xs text-slate-400 hover:text-slate-200 rounded transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
