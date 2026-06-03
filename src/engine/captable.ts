// ─── Core Interfaces ──────────────────────────────────────────────────────────

export type SecurityType = 'common' | 'preferred' | 'option' | 'safe' | 'convertible_note';
export type SafeType = 'cap_only' | 'discount_only' | 'most_favorable' | 'post_money_safe';
export type PreferenceType = 'non_participating' | 'participating' | 'participating_capped';

export interface Stakeholder {
  id: string;
  name: string;
  type: 'founder' | 'employee' | 'angel' | 'vc' | 'option_pool';
}

export interface CommonStock {
  kind: 'common';
  id: string;
  stakeholderId: string;
  shares: number;
  grantDate: string;
  vestingMonths?: number;
  cliffMonths?: number;
}

export interface PreferredStock {
  kind: 'preferred';
  id: string;
  stakeholderId: string;
  shares: number;
  seriesName: string;
  originalIssuePricePerShare: number;
  liquidationPreferenceMultiple: number;
  preferenceType: PreferenceType;
  participationCap?: number;
  isAntiDilutionProtected: boolean;
  investmentAmount: number;
}

export interface StockOption {
  kind: 'option';
  id: string;
  stakeholderId: string;
  shares: number;
  strikePrice: number;
  grantDate: string;
  vestingMonths: number;
  cliffMonths: number;
  exercised: boolean;
}

export interface SAFE {
  kind: 'safe';
  id: string;
  stakeholderId: string;
  investmentAmount: number;
  safeType: SafeType;
  valuationCap?: number;
  discountRate?: number;
  mfnProtection?: boolean;
}

export interface ConvertibleNote {
  kind: 'convertible_note';
  id: string;
  stakeholderId: string;
  principalAmount: number;
  interestRate: number;
  issueDate: string;
  maturityDate: string;
  valuationCap?: number;
  discountRate?: number;
  compoundingFrequency: 'simple' | 'annual' | 'quarterly' | 'monthly';
}

export type Security = CommonStock | PreferredStock | StockOption | SAFE | ConvertibleNote;

export interface CapTable {
  companyName: string;
  authorizedShares: number;
  stakeholders: Stakeholder[];
  securities: Security[];
}

// ─── Pre-Round Snapshot ───────────────────────────────────────────────────────

export interface OwnershipRow {
  stakeholderId: string;
  stakeholderName: string;
  stakeholderType: Stakeholder['type'];
  securityKind: SecurityType;
  securityId: string;
  shares: number;
  ownership: number;
  dilutedOwnership: number;
  notes: string;
}

export function computeOwnership(capTable: CapTable): OwnershipRow[] {
  const { stakeholders, securities } = capTable;
  const stakeholderMap = new Map(stakeholders.map(s => [s.id, s]));

  // Fully diluted: common + options + option pool (unallocated)
  const totalFullyDiluted = securities.reduce((sum, sec) => {
    if (sec.kind === 'common') return sum + sec.shares;
    if (sec.kind === 'option') return sum + sec.shares;
    if (sec.kind === 'preferred') return sum + sec.shares;
    return sum;
  }, 0);

  const totalBasic = securities.reduce((sum, sec) => {
    if (sec.kind === 'common') return sum + sec.shares;
    if (sec.kind === 'preferred') return sum + sec.shares;
    return sum;
  }, 0);

  const rows: OwnershipRow[] = [];

  for (const sec of securities) {
    if (sec.kind === 'safe' || sec.kind === 'convertible_note') continue;
    const holder = stakeholderMap.get(sec.stakeholderId);
    if (!holder) continue;

    let notes = '';
    if (sec.kind === 'option') {
      notes = sec.exercised ? 'Exercised' : `Strike $${sec.strikePrice.toFixed(4)}`;
    } else if (sec.kind === 'preferred') {
      notes = `${sec.seriesName} · ${sec.liquidationPreferenceMultiple}x ${sec.preferenceType}`;
    }

    rows.push({
      stakeholderId: holder.id,
      stakeholderName: holder.name,
      stakeholderType: holder.type,
      securityKind: sec.kind,
      securityId: sec.id,
      shares: sec.shares,
      ownership: totalBasic > 0 ? sec.shares / totalBasic : 0,
      dilutedOwnership: totalFullyDiluted > 0 ? sec.shares / totalFullyDiluted : 0,
      notes,
    });
  }

  return rows;
}

// ─── Convertible Note Accrued Amount ─────────────────────────────────────────

export function computeNoteAccruedAmount(note: ConvertibleNote, asOf: Date): number {
  const issue = new Date(note.issueDate);
  const years = (asOf.getTime() - issue.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

  switch (note.compoundingFrequency) {
    case 'simple':
      return note.principalAmount * (1 + note.interestRate * years);
    case 'annual':
      return note.principalAmount * Math.pow(1 + note.interestRate, years);
    case 'quarterly':
      return note.principalAmount * Math.pow(1 + note.interestRate / 4, 4 * years);
    case 'monthly':
      return note.principalAmount * Math.pow(1 + note.interestRate / 12, 12 * years);
    default:
      return note.principalAmount;
  }
}

// ─── Round Simulation Inputs ──────────────────────────────────────────────────

export interface RoundInputs {
  preMoneyValuation: number;
  newInvestmentAmount: number;
  targetPostMoneyOptionPoolPercent: number;
  conversionDate: Date;
  newInvestorName: string;
}

// ─── Round Simulation Outputs ─────────────────────────────────────────────────

export interface ConversionDetail {
  securityId: string;
  stakeholderName: string;
  kind: 'safe' | 'convertible_note';
  investmentAmount: number;
  accrued: number;
  conversionPrice: number;
  sharesReceived: number;
  conversionBasis: string;
}

export interface DilutionRow {
  stakeholderId: string;
  stakeholderName: string;
  securityKind: SecurityType;
  preShares: number;
  preOwnership: number;
  postShares: number;
  postOwnership: number;
  dilutionPercent: number;
}

export interface RoundResult {
  pricePerShare: number;
  optionPoolExpansionShares: number;
  totalNewShares: number;
  postMoneyValuation: number;
  postMoneyTotalShares: number;
  conversions: ConversionDetail[];
  dilutionMatrix: DilutionRow[];
  newInvestorShares: number;
  newInvestorOwnership: number;
}

// ─── Main Round Simulator ─────────────────────────────────────────────────────

export function simulateRound(capTable: CapTable, inputs: RoundInputs): RoundResult {
  const { stakeholders, securities } = capTable;
  const stakeholderMap = new Map(stakeholders.map(s => [s.id, s]));

  // 1. Pre-round fully diluted share count
  const preRoundShares = securities.reduce((sum, sec) => {
    if (sec.kind === 'common' || sec.kind === 'option' || sec.kind === 'preferred') {
      return sum + sec.shares;
    }
    return sum;
  }, 0);

  // 2. Existing unallocated option pool (option pool stakeholder)
  const optionPoolSecurity = securities.find(
    s => s.kind === 'option' &&
    stakeholders.find(sh => sh.id === s.stakeholderId)?.type === 'option_pool'
  );
  const existingPoolShares = optionPoolSecurity?.kind === 'option' ? optionPoolSecurity.shares : 0;

  // 3. Iterative solver: find expansion shares so that post-money pool% is met
  //    Pre-money shares after expansion = preRoundShares + expansionShares
  //    pricePerShare = preMoneyValuation / (preRoundShares + expansionShares)
  //    newInvestorShares = newInvestmentAmount / pricePerShare
  //    postMoneyTotal = preRoundShares + expansionShares + newInvestorShares + conversionShares
  //    (existingPoolShares + expansionShares) / postMoneyTotal = targetPoolPercent

  // We'll run a fixed-point iteration. Start with expansion = 0.
  const targetPool = inputs.targetPostMoneyOptionPoolPercent / 100;
  let expansionShares = 0;

  for (let iter = 0; iter < 50; iter++) {
    const preMoneyShaesWithExpansion = preRoundShares + expansionShares;
    const pricePerShare = inputs.preMoneyValuation / preMoneyShaesWithExpansion;
    const newInvestorShares = inputs.newInvestmentAmount / pricePerShare;

    // Approximate conversion shares (we'll compute properly below, use 0 for pool solve)
    // For accuracy, include SAFE/note conversions here
    const totalPostApprox = preMoneyShaesWithExpansion + newInvestorShares;
    const targetPoolShares = targetPool * totalPostApprox;
    const newExpansion = Math.max(0, targetPoolShares - existingPoolShares);

    if (Math.abs(newExpansion - expansionShares) < 0.01) break;
    expansionShares = newExpansion;
  }

  // 4. Final price per share
  const preMoneySharesWithExpansion = preRoundShares + expansionShares;
  const pricePerShare = inputs.preMoneyValuation / preMoneySharesWithExpansion;

  // 5. Compute SAFE & note conversions
  const conversions: ConversionDetail[] = [];

  for (const sec of securities) {
    const holder = stakeholderMap.get(sec.stakeholderId);
    if (!holder) continue;

    if (sec.kind === 'safe') {
      let conversionPrice: number;
      let basis: string;

      if (sec.safeType === 'cap_only') {
        conversionPrice = sec.valuationCap! / preMoneySharesWithExpansion;
        basis = `Cap: $${sec.valuationCap!.toLocaleString()}`;
      } else if (sec.safeType === 'discount_only') {
        conversionPrice = pricePerShare * (1 - sec.discountRate!);
        basis = `Discount: ${(sec.discountRate! * 100).toFixed(0)}%`;
      } else {
        // most_favorable: whichever gives more shares (lower price)
        const capPrice = sec.valuationCap ? sec.valuationCap / preMoneySharesWithExpansion : Infinity;
        const discountPrice = sec.discountRate ? pricePerShare * (1 - sec.discountRate) : Infinity;
        if (capPrice <= discountPrice) {
          conversionPrice = capPrice;
          basis = `Cap (favorable): $${sec.valuationCap!.toLocaleString()}`;
        } else {
          conversionPrice = discountPrice;
          basis = `Discount (favorable): ${(sec.discountRate! * 100).toFixed(0)}%`;
        }
      }

      const sharesReceived = sec.investmentAmount / conversionPrice;
      conversions.push({
        securityId: sec.id,
        stakeholderName: holder.name,
        kind: 'safe',
        investmentAmount: sec.investmentAmount,
        accrued: sec.investmentAmount,
        conversionPrice,
        sharesReceived,
        conversionBasis: basis,
      });
    }

    if (sec.kind === 'convertible_note') {
      const accrued = computeNoteAccruedAmount(sec, inputs.conversionDate);
      const capPrice = sec.valuationCap ? sec.valuationCap / preMoneySharesWithExpansion : Infinity;
      const discountPrice = sec.discountRate ? pricePerShare * (1 - sec.discountRate) : pricePerShare;
      const conversionPrice = Math.min(capPrice, discountPrice);

      let basis: string;
      if (conversionPrice === capPrice && sec.valuationCap) {
        basis = `Cap: $${sec.valuationCap.toLocaleString()}`;
      } else if (sec.discountRate) {
        basis = `Discount: ${(sec.discountRate * 100).toFixed(0)}%`;
      } else {
        basis = 'Priced round rate';
      }

      const sharesReceived = accrued / conversionPrice;
      conversions.push({
        securityId: sec.id,
        stakeholderName: holder.name,
        kind: 'convertible_note',
        investmentAmount: sec.principalAmount,
        accrued,
        conversionPrice,
        sharesReceived,
        conversionBasis: basis,
      });
    }
  }

  const totalConversionShares = conversions.reduce((s, c) => s + c.sharesReceived, 0);
  const newInvestorShares = inputs.newInvestmentAmount / pricePerShare;
  const totalNewShares = newInvestorShares + totalConversionShares + expansionShares;
  const postMoneyTotalShares = preRoundShares + totalNewShares;
  const postMoneyValuation = inputs.preMoneyValuation + inputs.newInvestmentAmount;

  // 6. Build dilution matrix
  const dilutionMatrix: DilutionRow[] = [];

  const buildRow = (
    stakeholderId: string,
    stakeholderName: string,
    securityKind: SecurityType,
    preShares: number,
    postShares: number
  ): DilutionRow => ({
    stakeholderId,
    stakeholderName,
    securityKind,
    preShares,
    preOwnership: preRoundShares > 0 ? preShares / preRoundShares : 0,
    postShares,
    postOwnership: postMoneyTotalShares > 0 ? postShares / postMoneyTotalShares : 0,
    dilutionPercent:
      preRoundShares > 0 && postMoneyTotalShares > 0
        ? (preShares / preRoundShares - postShares / postMoneyTotalShares) /
          (preShares / preRoundShares || 1)
        : 0,
  });

  // Existing securities
  for (const sec of securities) {
    if (sec.kind === 'safe' || sec.kind === 'convertible_note') continue;
    const holder = stakeholderMap.get(sec.stakeholderId);
    if (!holder) continue;
    dilutionMatrix.push(buildRow(holder.id, holder.name, sec.kind, sec.shares, sec.shares));
  }

  // Option pool expansion row
  if (expansionShares > 0) {
    dilutionMatrix.push(buildRow('option_pool_expansion', 'Option Pool (New)', 'option', 0, expansionShares));
  }

  // Conversion rows
  for (const conv of conversions) {
    const sec = securities.find(s => s.id === conv.securityId);
    if (!sec) continue;
    const holder = stakeholderMap.get(sec.stakeholderId);
    if (!holder) continue;
    dilutionMatrix.push(buildRow(
      holder.id,
      `${holder.name} (converted)`,
      'preferred',
      0,
      conv.sharesReceived,
    ));
  }

  // New investor
  dilutionMatrix.push(buildRow(
    'new_investor',
    inputs.newInvestorName,
    'preferred',
    0,
    newInvestorShares,
  ));

  return {
    pricePerShare,
    optionPoolExpansionShares: expansionShares,
    totalNewShares,
    postMoneyValuation,
    postMoneyTotalShares,
    conversions,
    dilutionMatrix,
    newInvestorShares,
    newInvestorOwnership: newInvestorShares / postMoneyTotalShares,
  };
}

// ─── Liquidation Waterfall ─────────────────────────────────────────────────────

export interface WaterfallInput {
  exitValuation: number;
  roundResult?: RoundResult;
}

export interface WaterfallRow {
  stakeholderId: string;
  stakeholderName: string;
  securityKind: SecurityType;
  preferenceAmount: number;
  participationAmount: number;
  totalPayout: number;
  ownership: number;
}

export function computeWaterfall(
  capTable: CapTable,
  roundResult: RoundResult | null,
  exitValuation: number,
  roundInputs?: RoundInputs,
): WaterfallRow[] {
  const { stakeholders, securities } = capTable;
  const stakeholderMap = new Map(stakeholders.map(s => [s.id, s]));

  // Build the post-round security list
  type InternalSec =
    | { kind: 'common'; stakeholderId: string; name: string; shares: number; investment: number }
    | {
        kind: 'preferred';
        stakeholderId: string;
        name: string;
        shares: number;
        investment: number;
        liquidationMultiple: number;
        prefType: PreferenceType;
        participationCap?: number;
      };

  const internalSecurities: InternalSec[] = [];

  for (const sec of securities) {
    if (sec.kind === 'safe' || sec.kind === 'convertible_note') continue;
    const holder = stakeholderMap.get(sec.stakeholderId);
    if (!holder) continue;
    if (sec.kind === 'common') {
      internalSecurities.push({
        kind: 'common',
        stakeholderId: sec.stakeholderId,
        name: holder.name,
        shares: sec.shares,
        investment: 0,
      });
    } else if (sec.kind === 'option') {
      internalSecurities.push({
        kind: 'common',
        stakeholderId: sec.stakeholderId,
        name: `${holder.name} (options)`,
        shares: sec.shares,
        investment: 0,
      });
    } else if (sec.kind === 'preferred') {
      internalSecurities.push({
        kind: 'preferred',
        stakeholderId: sec.stakeholderId,
        name: `${holder.name} (${sec.seriesName})`,
        shares: sec.shares,
        investment: sec.investmentAmount,
        liquidationMultiple: sec.liquidationPreferenceMultiple,
        prefType: sec.preferenceType,
        participationCap: sec.participationCap,
      });
    }
  }

  // Add round result preferred
  if (roundResult && roundInputs) {
    // New investor
    internalSecurities.push({
      kind: 'preferred',
      stakeholderId: 'new_investor',
      name: roundInputs.newInvestorName,
      shares: roundResult.newInvestorShares,
      investment: roundInputs.newInvestmentAmount,
      liquidationMultiple: 1,
      prefType: 'non_participating',
    });
    // Converted SAFEs and notes
    for (const conv of roundResult.conversions) {
      const sec = capTable.securities.find(s => s.id === conv.securityId);
      if (!sec) continue;
      internalSecurities.push({
        kind: 'preferred',
        stakeholderId: sec.stakeholderId,
        name: `${conv.stakeholderName} (converted)`,
        shares: conv.sharesReceived,
        investment: conv.accrued,
        liquidationMultiple: 1,
        prefType: 'non_participating',
      });
    }
  }

  const totalShares = internalSecurities.reduce((s, sec) => s + sec.shares, 0);
  if (totalShares === 0) return [];

  let remaining = exitValuation;
  const results: WaterfallRow[] = internalSecurities.map(sec => ({
    stakeholderId: sec.stakeholderId,
    stakeholderName: sec.name,
    securityKind: sec.kind,
    preferenceAmount: 0,
    participationAmount: 0,
    totalPayout: 0,
    ownership: sec.shares / totalShares,
  }));

  // Phase 1: Liquidation preferences for preferred
  const preferred = internalSecurities.filter(s => s.kind === 'preferred') as Extract<InternalSec, { kind: 'preferred' }>[];
  for (let i = 0; i < preferred.length; i++) {
    const sec = preferred[i];
    const idx = internalSecurities.indexOf(sec);
    const prefPayout = Math.min(remaining, sec.investment * sec.liquidationMultiple);
    results[idx].preferenceAmount = prefPayout;
    remaining -= prefPayout;
  }

  if (remaining <= 0) {
    results.forEach(r => { r.totalPayout = r.preferenceAmount; });
    return results;
  }

  // Phase 1b: Non-participating preferred conversion check.
  // Each holder independently decides: keep liquidation preference OR convert to
  // common (whichever yields more). Converters return their preference to the pool
  // BEFORE phase 2 distribution so the returned capital flows to all participants.
  const converting = new Set<number>(); // indices of converting preferred holders
  for (let i = 0; i < internalSecurities.length; i++) {
    const sec = internalSecurities[i];
    if (sec.kind !== 'preferred') continue;
    const p = sec as Extract<InternalSec, { kind: 'preferred' }>;
    if (p.prefType !== 'non_participating') continue;

    // Pro-rata of the full exit (what they'd receive as common)
    const asCommon = exitValuation * sec.shares / totalShares;
    if (asCommon > results[i].preferenceAmount) {
      remaining += results[i].preferenceAmount; // return preference to pool
      results[i].preferenceAmount = 0;
      converting.add(i);
    }
  }

  // Phase 2: Distribute `remaining` to common + converting preferred + participating preferred.
  // Non-converting preferred already took their preference and are excluded here.
  let phase2Shares = 0;
  for (let i = 0; i < internalSecurities.length; i++) {
    const sec = internalSecurities[i];
    if (sec.kind === 'common') {
      phase2Shares += sec.shares;
    } else {
      const p = sec as Extract<InternalSec, { kind: 'preferred' }>;
      if (p.prefType === 'non_participating' && converting.has(i)) {
        phase2Shares += sec.shares;
      } else if (p.prefType === 'participating' || p.prefType === 'participating_capped') {
        phase2Shares += sec.shares;
      }
    }
  }

  if (phase2Shares > 0) {
    for (let i = 0; i < internalSecurities.length; i++) {
      const sec = internalSecurities[i];
      const proRata = remaining * (sec.shares / phase2Shares);

      if (sec.kind === 'common') {
        results[i].participationAmount = proRata;
      } else {
        const p = sec as Extract<InternalSec, { kind: 'preferred' }>;
        if (p.prefType === 'non_participating' && converting.has(i)) {
          results[i].participationAmount = proRata;
        } else if (p.prefType === 'participating') {
          results[i].participationAmount = proRata;
        } else if (p.prefType === 'participating_capped') {
          const cap = (p.participationCap ?? 2) * p.investment;
          const alreadyPaid = results[i].preferenceAmount;
          results[i].participationAmount = Math.max(0, Math.min(proRata, cap - alreadyPaid));
        }
      }
    }
  }

  results.forEach(r => { r.totalPayout = r.preferenceAmount + r.participationAmount; });
  return results;
}

// ─── JSON Serialization ───────────────────────────────────────────────────────

export function serializeCapTable(capTable: CapTable): string {
  return JSON.stringify(capTable, null, 2);
}

export function deserializeCapTable(json: string): CapTable {
  return JSON.parse(json) as CapTable;
}
