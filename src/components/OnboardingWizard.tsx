import { useState } from 'react';
import type { CapTable, SafeType } from '../engine/captable';

interface Props {
  onComplete: (ct: CapTable) => void;
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface FounderRow {
  id: string;
  name: string;
  shares: string;
  hasVesting: boolean;
  vestingMonths: string;
  cliffMonths: string;
}

interface SafeRow {
  id: string;
  holderName: string;
  amount: string;
  safeType: SafeType;
  cap: string;
  discount: string;
}

interface NoteRow {
  id: string;
  holderName: string;
  principal: string;
  rate: string;
  issueDate: string;
  cap: string;
  discount: string;
}

const inputCls = 'bg-slate-800/60 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-400 w-full tabular-nums transition-colors';
const labelCls = 'text-xs text-slate-400 mb-1 block';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(1);

  // Step 1
  const [companyName, setCompanyName] = useState('');
  const [authorizedShares, setAuthorizedShares] = useState('10000000');

  // Step 2
  const [founders, setFounders] = useState<FounderRow[]>([
    { id: uid(), name: '', shares: '4500000', hasVesting: true, vestingMonths: '48', cliffMonths: '12' },
    { id: uid(), name: '', shares: '4500000', hasVesting: true, vestingMonths: '48', cliffMonths: '12' },
  ]);

  // Step 3
  const [safes, setSafes] = useState<SafeRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);

  // ── Step 1 validation ──────────────────────────────────────────────────────
  const step1Valid = companyName.trim().length > 0;

  // ── Step 2 validation ──────────────────────────────────────────────────────
  const step2Valid = founders.some(f => f.name.trim() && Number(f.shares) > 0);

  // ── Founder helpers ────────────────────────────────────────────────────────
  function updateFounder(id: string, patch: Partial<FounderRow>) {
    setFounders(fs => fs.map(f => f.id === id ? { ...f, ...patch } : f));
  }

  function addFounder() {
    setFounders(fs => [...fs, { id: uid(), name: '', shares: '1000000', hasVesting: true, vestingMonths: '48', cliffMonths: '12' }]);
  }

  function removeFounder(id: string) {
    setFounders(fs => fs.filter(f => f.id !== id));
  }

  // ── SAFE helpers ───────────────────────────────────────────────────────────
  function addSafe() {
    setSafes(ss => [...ss, { id: uid(), holderName: '', amount: '100000', safeType: 'cap_only', cap: '8000000', discount: '20' }]);
  }

  function updateSafe(id: string, patch: Partial<SafeRow>) {
    setSafes(ss => ss.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  function removeSafe(id: string) {
    setSafes(ss => ss.filter(s => s.id !== id));
  }

  // ── Note helpers ───────────────────────────────────────────────────────────
  function addNote() {
    const today = new Date().toISOString().slice(0, 10);
    setNotes(ns => [...ns, { id: uid(), holderName: '', principal: '250000', rate: '8', issueDate: today, cap: '10000000', discount: '20' }]);
  }

  function updateNote(id: string, patch: Partial<NoteRow>) {
    setNotes(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n));
  }

  function removeNote(id: string) {
    setNotes(ns => ns.filter(n => n.id !== id));
  }

  // ── Build CapTable and finish ──────────────────────────────────────────────
  function handleComplete() {
    const today = new Date().toISOString().slice(0, 10);
    const stakeholders = [];
    const securities = [];

    // Founders
    for (const f of founders) {
      if (!f.name.trim() || !Number(f.shares)) continue;
      const shId = `founder-${f.id}`;
      stakeholders.push({ id: shId, name: f.name.trim(), type: 'founder' as const });
      securities.push({
        kind: 'common' as const,
        id: `common-${f.id}`,
        stakeholderId: shId,
        shares: Number(f.shares),
        grantDate: today,
        ...(f.hasVesting ? { vestingMonths: Number(f.vestingMonths), cliffMonths: Number(f.cliffMonths) } : {}),
      });
    }

    // Option pool (10% of authorized)
    const poolId = `option-pool-${uid()}`;
    const poolShares = Math.round(Number(authorizedShares) * 0.10);
    stakeholders.push({ id: poolId, name: 'Option Pool', type: 'option_pool' as const });
    securities.push({
      kind: 'option' as const,
      id: `pool-${uid()}`,
      stakeholderId: poolId,
      shares: poolShares,
      strikePrice: 0.001,
      grantDate: today,
      vestingMonths: 0,
      cliffMonths: 0,
      exercised: false,
    });

    // SAFEs
    for (const s of safes) {
      if (!s.holderName.trim() || !Number(s.amount)) continue;
      const shId = `angel-${s.id}`;
      stakeholders.push({ id: shId, name: s.holderName.trim(), type: 'angel' as const });
      securities.push({
        kind: 'safe' as const,
        id: `safe-${s.id}`,
        stakeholderId: shId,
        investmentAmount: Number(s.amount),
        safeType: s.safeType,
        ...(s.safeType !== 'discount_only' ? { valuationCap: Number(s.cap) } : {}),
        ...(s.safeType !== 'cap_only' ? { discountRate: Number(s.discount) / 100 } : {}),
      });
    }

    // Notes
    for (const n of notes) {
      if (!n.holderName.trim() || !Number(n.principal)) continue;
      const shId = `investor-${n.id}`;
      stakeholders.push({ id: shId, name: n.holderName.trim(), type: 'vc' as const });
      const maturity = new Date(Date.now() + 2 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      securities.push({
        kind: 'convertible_note' as const,
        id: `note-${n.id}`,
        stakeholderId: shId,
        principalAmount: Number(n.principal),
        interestRate: Number(n.rate) / 100,
        issueDate: n.issueDate,
        maturityDate: maturity,
        valuationCap: Number(n.cap),
        discountRate: Number(n.discount) / 100,
        compoundingFrequency: 'annual' as const,
      });
    }

    const ct: CapTable = {
      companyName: companyName.trim(),
      authorizedShares: Number(authorizedShares),
      stakeholders,
      securities,
    };

    onComplete(ct);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const steps = ['Company', 'Founders', 'Capital'];

  return (
    <div className="fixed inset-0 z-50 bg-[#0b0d14] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-sky-400" />
            <span className="text-xs text-slate-500 uppercase tracking-widest">Cap Table Setup</span>
          </div>
          <div className="flex items-center gap-3">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className={`flex items-center gap-1.5 ${i + 1 === step ? 'text-white' : i + 1 < step ? 'text-slate-500' : 'text-slate-700'}`}>
                  <div className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center ${i + 1 === step ? 'bg-sky-500 text-white' : i + 1 < step ? 'bg-slate-700 text-slate-400' : 'border border-slate-700 text-slate-700'}`}>
                    {i + 1 < step ? '✓' : i + 1}
                  </div>
                  <span className="text-xs">{s}</span>
                </div>
                {i < steps.length - 1 && <div className="w-8 h-px bg-slate-700" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex flex-col gap-5">

          {/* ── Step 1 ── */}
          {step === 1 && (
            <>
              <div>
                <h2 className="text-lg text-white font-semibold mb-1">Your company</h2>
                <p className="text-sm text-slate-400">This takes about 2 minutes. You can edit everything later.</p>
              </div>
              <Field label="Company legal name">
                <input
                  className={inputCls}
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Acme Technologies, Inc."
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && step1Valid) setStep(2); }}
                />
              </Field>
              <Field label="Authorized shares">
                <input
                  className={inputCls}
                  type="number"
                  value={authorizedShares}
                  onChange={e => setAuthorizedShares(e.target.value)}
                />
                <p className="text-[10px] text-slate-600 mt-1">Default 10,000,000 — typical for a Delaware C-Corp at formation</p>
              </Field>
            </>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <>
              <div>
                <h2 className="text-lg text-white font-semibold mb-1">Founders & common stock</h2>
                <p className="text-sm text-slate-400">Enter each founder's name and share count.</p>
              </div>
              <div className="flex flex-col gap-3">
                {founders.map((f, i) => (
                  <div key={f.id} className="border border-slate-700/60 rounded p-3 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={`Founder ${i + 1} name`}>
                        <input
                          className={inputCls}
                          value={f.name}
                          onChange={e => updateFounder(f.id, { name: e.target.value })}
                          placeholder="Alice Chen"
                          autoFocus={i === 0 && step === 2}
                        />
                      </Field>
                      <Field label="Shares">
                        <input
                          className={inputCls}
                          type="number"
                          value={f.shares}
                          onChange={e => updateFounder(f.id, { shares: e.target.value })}
                        />
                      </Field>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={f.hasVesting}
                        onChange={e => updateFounder(f.id, { hasVesting: e.target.checked })}
                        className="accent-sky-400"
                      />
                      Standard 4-year vesting with 1-year cliff
                    </label>

                    {f.hasVesting && (
                      <div className="grid grid-cols-2 gap-3 pl-5">
                        <Field label="Vesting (months)">
                          <input className={inputCls} type="number" value={f.vestingMonths} onChange={e => updateFounder(f.id, { vestingMonths: e.target.value })} />
                        </Field>
                        <Field label="Cliff (months)">
                          <input className={inputCls} type="number" value={f.cliffMonths} onChange={e => updateFounder(f.id, { cliffMonths: e.target.value })} />
                        </Field>
                      </div>
                    )}

                    {founders.length > 1 && (
                      <button onClick={() => removeFounder(f.id)} className="text-[10px] text-red-500/50 hover:text-red-400 self-start transition-colors">
                        Remove
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={addFounder}
                  className="text-xs text-slate-500 hover:text-slate-300 border border-dashed border-slate-700 rounded py-2 transition-colors"
                >
                  + Add another founder
                </button>
              </div>
            </>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <>
              <div>
                <h2 className="text-lg text-white font-semibold mb-1">Unpriced capital</h2>
                <p className="text-sm text-slate-400">Add any SAFEs or convertible notes. Skip if none.</p>
              </div>

              {/* SAFEs */}
              <div className="flex flex-col gap-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider">SAFEs</p>
                {safes.map(s => (
                  <div key={s.id} className="border border-slate-700/60 rounded p-3 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Investor name">
                        <input className={inputCls} value={s.holderName} onChange={e => updateSafe(s.id, { holderName: e.target.value })} placeholder="Sofia Papadopoulos" />
                      </Field>
                      <Field label="Investment ($)">
                        <input className={inputCls} type="number" value={s.amount} onChange={e => updateSafe(s.id, { amount: e.target.value })} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Type">
                        <select className={inputCls} value={s.safeType} onChange={e => updateSafe(s.id, { safeType: e.target.value as SafeType })}>
                          <option value="cap_only">Cap only</option>
                          <option value="discount_only">Discount only</option>
                          <option value="most_favorable">Most favorable</option>
                        </select>
                      </Field>
                      {s.safeType !== 'discount_only' && (
                        <Field label="Valuation cap ($)">
                          <input className={inputCls} type="number" value={s.cap} onChange={e => updateSafe(s.id, { cap: e.target.value })} />
                        </Field>
                      )}
                      {s.safeType !== 'cap_only' && (
                        <Field label="Discount (%)">
                          <input className={inputCls} type="number" value={s.discount} onChange={e => updateSafe(s.id, { discount: e.target.value })} />
                        </Field>
                      )}
                    </div>
                    <button onClick={() => removeSafe(s.id)} className="text-[10px] text-red-500/50 hover:text-red-400 self-start transition-colors">Remove</button>
                  </div>
                ))}
                <button onClick={addSafe} className="text-xs text-slate-500 hover:text-slate-300 border border-dashed border-slate-700 rounded py-2 transition-colors">
                  + Add SAFE
                </button>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Convertible Notes</p>
                {notes.map(n => (
                  <div key={n.id} className="border border-slate-700/60 rounded p-3 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Investor name">
                        <input className={inputCls} value={n.holderName} onChange={e => updateNote(n.id, { holderName: e.target.value })} placeholder="Bridge Capital" />
                      </Field>
                      <Field label="Principal ($)">
                        <input className={inputCls} type="number" value={n.principal} onChange={e => updateNote(n.id, { principal: e.target.value })} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Interest rate (%)">
                        <input className={inputCls} type="number" step="0.1" value={n.rate} onChange={e => updateNote(n.id, { rate: e.target.value })} />
                      </Field>
                      <Field label="Valuation cap ($)">
                        <input className={inputCls} type="number" value={n.cap} onChange={e => updateNote(n.id, { cap: e.target.value })} />
                      </Field>
                      <Field label="Discount (%)">
                        <input className={inputCls} type="number" value={n.discount} onChange={e => updateNote(n.id, { discount: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="Issue date">
                      <input className={inputCls} type="date" value={n.issueDate} onChange={e => updateNote(n.id, { issueDate: e.target.value })} />
                    </Field>
                    <button onClick={() => removeNote(n.id)} className="text-[10px] text-red-500/50 hover:text-red-400 self-start transition-colors">Remove</button>
                  </div>
                ))}
                <button onClick={addNote} className="text-xs text-slate-500 hover:text-slate-300 border border-dashed border-slate-700 rounded py-2 transition-colors">
                  + Add convertible note
                </button>
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div>
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
                ← Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step === 3 && (
              <button onClick={handleComplete} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Skip & finish
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 ? !step1Valid : !step2Valid}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm rounded transition-colors"
              >
                Build my cap table →
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-700">
          Everything stays in your browser. No account required.
        </p>
      </div>
    </div>
  );
}
