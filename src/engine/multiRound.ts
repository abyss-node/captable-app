import type { CapTable, RoundResult, RoundInputs, Security, Stakeholder, PreferredStock } from './captable';
import { simulateRound } from './captable';

export interface RoundRecord {
  id: string;
  name: string;
  inputs: Omit<RoundInputs, 'conversionDate'>;
  result: RoundResult;
  date: string;
}

export interface RoundHistory {
  rounds: RoundRecord[];
}

// Build a synthetic post-round CapTable from a base + a completed round,
// so the next round simulation can use it as its pre-money starting point.
export function applyRoundToCapTable(
  base: CapTable,
  record: RoundRecord,
): CapTable {
  const { result, inputs } = record;

  // Remove all SAFEs and convertible notes that converted in this round
  const convertedIds = new Set(result.conversions.map(c => c.securityId));
  const survivingSecurities = base.securities.filter(s => !convertedIds.has(s.id));

  // Expand the option pool in-place (find the option_pool security and increase it)
  const withExpandedPool = survivingSecurities.map(sec => {
    if (sec.kind === 'option') {
      const holder = base.stakeholders.find(s => s.id === sec.stakeholderId);
      if (holder?.type === 'option_pool') {
        return { ...sec, shares: sec.shares + Math.round(result.optionPoolExpansionShares) };
      }
    }
    return sec;
  });

  // Add new investor as preferred
  const newInvestorStakeholder: Stakeholder = {
    id: `investor-${record.id}`,
    name: inputs.newInvestorName,
    type: 'vc',
  };

  const newInvestorPreferred: PreferredStock = {
    kind: 'preferred',
    id: `preferred-${record.id}`,
    stakeholderId: `investor-${record.id}`,
    shares: Math.round(result.newInvestorShares),
    seriesName: record.name,
    originalIssuePricePerShare: result.pricePerShare,
    liquidationPreferenceMultiple: 1,
    preferenceType: 'non_participating',
    investmentAmount: inputs.newInvestmentAmount,
    isAntiDilutionProtected: false,
  };

  // Add converted SAFE/note holders as preferred
  const convertedPreferreds: PreferredStock[] = result.conversions.map(conv => {
    const originalSec = base.securities.find(s => s.id === conv.securityId);
    return {
      kind: 'preferred',
      id: `converted-${conv.securityId}`,
      stakeholderId: originalSec?.stakeholderId ?? conv.securityId,
      shares: Math.round(conv.sharesReceived),
      seriesName: `${record.name} (converted)`,
      originalIssuePricePerShare: conv.conversionPrice,
      liquidationPreferenceMultiple: 1,
      preferenceType: 'non_participating',
      investmentAmount: conv.accrued,
      isAntiDilutionProtected: false,
    };
  });

  const newStakeholders = [...base.stakeholders, newInvestorStakeholder];
  const newSecurities: Security[] = [
    ...withExpandedPool,
    newInvestorPreferred,
    ...convertedPreferreds,
  ];

  return {
    ...base,
    authorizedShares: Math.max(
      base.authorizedShares,
      newSecurities.reduce((s, sec) => {
        if (sec.kind === 'common' || sec.kind === 'preferred' || sec.kind === 'option') return s + sec.shares;
        return s;
      }, 0) * 1.5,
    ),
    stakeholders: newStakeholders,
    securities: newSecurities,
  };
}

export function simulateNextRound(
  baseCapTable: CapTable,
  history: RoundHistory,
  inputs: Omit<RoundInputs, 'conversionDate'>,
  roundName: string,
): RoundRecord {
  // Apply all previous rounds to get the current state
  let currentTable = baseCapTable;
  for (const record of history.rounds) {
    currentTable = applyRoundToCapTable(currentTable, record);
  }

  const result = simulateRound(currentTable, {
    ...inputs,
    conversionDate: new Date(),
  });

  return {
    id: `round-${Date.now()}`,
    name: roundName,
    inputs,
    result,
    date: new Date().toISOString().slice(0, 10),
  };
}
