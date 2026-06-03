import type { CapTable } from '../engine/captable';

export const INITIAL_CAP_TABLE: CapTable = {
  companyName: 'Acme Technologies, Inc.',
  authorizedShares: 15_000_000,
  stakeholders: [
    { id: 'founder-alice', name: 'Alice Chen', type: 'founder' },
    { id: 'founder-bob', name: 'Bob Reyes', type: 'founder' },
    { id: 'option-pool', name: 'Option Pool', type: 'option_pool' },
    { id: 'angel-sofia', name: 'Sofia Papadopoulos', type: 'angel' },
    { id: 'angel-james', name: 'James Okafor', type: 'angel' },
    { id: 'angel-liu', name: 'Liu Wei', type: 'angel' },
    { id: 'vc-bridge', name: 'Bridge Capital', type: 'vc' },
  ],
  securities: [
    // Founder common stock
    {
      kind: 'common',
      id: 'common-alice',
      stakeholderId: 'founder-alice',
      shares: 4_500_000,
      grantDate: '2022-01-15',
      vestingMonths: 48,
      cliffMonths: 12,
    },
    {
      kind: 'common',
      id: 'common-bob',
      stakeholderId: 'founder-bob',
      shares: 3_500_000,
      grantDate: '2022-01-15',
      vestingMonths: 48,
      cliffMonths: 12,
    },
    // Option pool (unallocated)
    {
      kind: 'option',
      id: 'option-pool-unallocated',
      stakeholderId: 'option-pool',
      shares: 1_000_000,
      strikePrice: 0.001,
      grantDate: '2022-01-15',
      vestingMonths: 0,
      cliffMonths: 0,
      exercised: false,
    },
    // Angel SAFE 1: Cap only — $6M cap
    {
      kind: 'safe',
      id: 'safe-sofia',
      stakeholderId: 'angel-sofia',
      investmentAmount: 150_000,
      safeType: 'cap_only',
      valuationCap: 6_000_000,
    },
    // Angel SAFE 2: Discount only — 20% discount
    {
      kind: 'safe',
      id: 'safe-james',
      stakeholderId: 'angel-james',
      investmentAmount: 100_000,
      safeType: 'discount_only',
      discountRate: 0.20,
    },
    // Angel SAFE 3: Most favorable — $8M cap, 15% discount
    {
      kind: 'safe',
      id: 'safe-liu',
      stakeholderId: 'angel-liu',
      investmentAmount: 200_000,
      safeType: 'most_favorable',
      valuationCap: 8_000_000,
      discountRate: 0.15,
    },
    // Institutional Convertible Note — $500K, 8% annual, $10M cap, 20% discount
    {
      kind: 'convertible_note',
      id: 'note-bridge',
      stakeholderId: 'vc-bridge',
      principalAmount: 500_000,
      interestRate: 0.08,
      issueDate: '2023-03-01',
      maturityDate: '2025-03-01',
      valuationCap: 10_000_000,
      discountRate: 0.20,
      compoundingFrequency: 'annual',
    },
  ],
};

export const DEFAULT_ROUND_INPUTS = {
  preMoneyValuation: 12_000_000,
  newInvestmentAmount: 3_000_000,
  targetPostMoneyOptionPoolPercent: 15,
  newInvestorName: 'Sequoia Seed',
};
