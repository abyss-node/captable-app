import type { CapTable } from './captable';
import { computeOwnership } from './captable';
import { computeVestingGrants } from './vesting';

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function pct(n: number): string {
  return (n * 100).toFixed(2) + '%';
}

const KIND_LABELS: Record<string, string> = {
  common: 'Common', preferred: 'Preferred', option: 'Options',
  safe: 'SAFE', convertible_note: 'Conv. Note',
};

export function generateAndPrintPDF(capTable: CapTable): void {
  const rows = computeOwnership(capTable);
  const vestingGrants = computeVestingGrants(capTable, new Date());
  const safes = capTable.securities.filter(s => s.kind === 'safe');
  const notes = capTable.securities.filter(s => s.kind === 'convertible_note');
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const totalShares = rows.reduce((s, r) => s + r.shares, 0);
  const totalCapital = [...safes, ...notes].reduce((s, sec) => {
    if (sec.kind === 'safe') return s + sec.investmentAmount;
    if (sec.kind === 'convertible_note') return s + sec.principalAmount;
    return s;
  }, 0);

  const ledgerRows = [...rows]
    .sort((a, b) => b.shares - a.shares)
    .map(r => `
      <tr>
        <td>${r.stakeholderName}</td>
        <td>${KIND_LABELS[r.securityKind] ?? r.securityKind}</td>
        <td class="num">${fmt(r.shares)}</td>
        <td class="num">${pct(r.ownership)}</td>
        <td class="num">${pct(r.dilutedOwnership)}</td>
        <td>${r.notes}</td>
      </tr>
    `).join('');

  const unpricedRows = [
    ...safes.map(s => {
      if (s.kind !== 'safe') return '';
      const holder = capTable.stakeholders.find(h => h.id === s.stakeholderId);
      const terms = s.safeType === 'cap_only'
        ? `Cap $${(s.valuationCap! / 1e6).toFixed(1)}M`
        : s.safeType === 'discount_only'
        ? `${(s.discountRate! * 100).toFixed(0)}% discount`
        : `Cap $${(s.valuationCap! / 1e6).toFixed(1)}M · ${(s.discountRate! * 100).toFixed(0)}% discount`;
      return `<tr><td>${holder?.name ?? ''}</td><td>SAFE</td><td class="num">$${fmt(s.investmentAmount)}</td><td>${terms}</td></tr>`;
    }),
    ...notes.map(n => {
      if (n.kind !== 'convertible_note') return '';
      const holder = capTable.stakeholders.find(h => h.id === n.stakeholderId);
      const terms = `${(n.interestRate * 100).toFixed(0)}% ${n.compoundingFrequency}${n.valuationCap ? ` · Cap $${(n.valuationCap / 1e6).toFixed(1)}M` : ''}`;
      return `<tr><td>${holder?.name ?? ''}</td><td>Conv. Note</td><td class="num">$${fmt(n.principalAmount)}</td><td>${terms}</td></tr>`;
    }),
  ].join('');

  const vestingRows = vestingGrants.map(g => `
    <tr>
      <td>${g.stakeholderName}</td>
      <td>${g.kind === 'option' ? 'Option' : 'Common'}</td>
      <td class="num">${fmt(g.vestedShares)} / ${fmt(g.totalShares)}</td>
      <td class="num">${(g.vestedFraction * 100).toFixed(1)}%</td>
      <td>${g.fullyVested ? `Fully vested ${g.fullyVestsDate}` : `Vests ${g.fullyVestsDate}`}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${capTable.companyName} · Cap Table</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 10pt;
    color: #111;
    padding: 28mm 20mm;
    line-height: 1.4;
  }
  .header { margin-bottom: 20pt; border-bottom: 2px solid #111; padding-bottom: 10pt; }
  .header h1 { font-size: 18pt; font-weight: 700; letter-spacing: -0.5px; }
  .header .meta { font-size: 9pt; color: #555; margin-top: 3pt; display: flex; gap: 20pt; }
  .section { margin-bottom: 18pt; }
  .section h2 { font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 6pt; border-bottom: 1px solid #ddd; padding-bottom: 3pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { text-align: left; font-weight: 600; color: #555; border-bottom: 1px solid #ccc; padding: 4pt 6pt 4pt 0; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 3.5pt 6pt 3.5pt 0; border-bottom: 1px solid #eee; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  tr:last-child td { border-bottom: none; }
  .total-row td { border-top: 2px solid #111; font-weight: 700; padding-top: 5pt; }
  .stats { display: flex; gap: 20pt; margin-bottom: 18pt; }
  .stat { flex: 1; border: 1px solid #ddd; border-radius: 4px; padding: 8pt 10pt; }
  .stat .label { font-size: 8pt; color: #777; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat .value { font-size: 13pt; font-weight: 700; margin-top: 2pt; }
  .footer { margin-top: 24pt; border-top: 1px solid #ddd; padding-top: 8pt; font-size: 8pt; color: #aaa; display: flex; justify-content: space-between; }
  .progress { display: inline-block; width: 80pt; height: 5pt; background: #eee; border-radius: 2pt; vertical-align: middle; }
  .progress-fill { height: 100%; border-radius: 2pt; background: #4a90d9; }
  @media print {
    body { padding: 0; }
    @page { margin: 18mm 15mm; size: A4; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>${capTable.companyName}</h1>
  <div class="meta">
    <span>Cap Table</span>
    <span>As of ${today}</span>
    ${capTable.fmvPerShare ? `<span>409A FMV: $${capTable.fmvPerShare.toFixed(4)}/share</span>` : ''}
  </div>
</div>

<div class="stats">
  <div class="stat">
    <div class="label">Shares Issued</div>
    <div class="value">${fmt(totalShares)}</div>
  </div>
  <div class="stat">
    <div class="label">Authorized</div>
    <div class="value">${fmt(capTable.authorizedShares)}</div>
  </div>
  <div class="stat">
    <div class="label">Unpriced Capital</div>
    <div class="value">${totalCapital > 0 ? '$' + (totalCapital >= 1e6 ? (totalCapital / 1e6).toFixed(2) + 'M' : (totalCapital / 1e3).toFixed(0) + 'K') : '—'}</div>
  </div>
  <div class="stat">
    <div class="label">Stakeholders</div>
    <div class="value">${capTable.stakeholders.filter(s => s.type !== 'option_pool').length}</div>
  </div>
</div>

<div class="section">
  <h2>Share Ledger</h2>
  <table>
    <thead>
      <tr>
        <th>Stakeholder</th><th>Type</th>
        <th class="num">Shares</th>
        <th class="num">Basic %</th>
        <th class="num">Diluted %</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${ledgerRows}
      <tr class="total-row">
        <td>TOTAL</td><td></td>
        <td class="num">${fmt(totalShares)}</td>
        <td class="num">100.00%</td>
        <td class="num">100.00%</td>
        <td></td>
      </tr>
    </tbody>
  </table>
</div>

${(safes.length > 0 || notes.length > 0) ? `
<div class="section">
  <h2>Unpriced Instruments</h2>
  <table>
    <thead><tr><th>Investor</th><th>Kind</th><th class="num">Amount</th><th>Terms</th></tr></thead>
    <tbody>${unpricedRows}</tbody>
  </table>
</div>` : ''}

${vestingGrants.length > 0 ? `
<div class="section">
  <h2>Vesting Schedules</h2>
  <table>
    <thead><tr><th>Grantee</th><th>Kind</th><th class="num">Vested / Total</th><th class="num">%</th><th>Status</th></tr></thead>
    <tbody>${vestingRows}</tbody>
  </table>
</div>` : ''}

<div class="footer">
  <span>Generated by captable-app · captable-app-ten.vercel.app</span>
  <span>${today}</span>
</div>

<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
