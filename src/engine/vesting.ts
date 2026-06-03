import type { CapTable, CommonStock, StockOption } from './captable';

export interface VestingGrant {
  id: string;
  stakeholderName: string;
  kind: 'common' | 'option';
  totalShares: number;
  vestedShares: number;
  unvestedShares: number;
  vestedFraction: number;
  cliffFraction: number;
  pastCliff: boolean;
  fullyVested: boolean;
  grantDate: string;
  cliffDate: string;
  fullyVestsDate: string;
  vestingMonths: number;
  cliffMonths: number;
  strikePrice?: number;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (30.4375 * 24 * 60 * 60 * 1000);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function computeVestingGrants(capTable: CapTable, asOf: Date = new Date()): VestingGrant[] {
  const stakeholderMap = new Map(capTable.stakeholders.map(s => [s.id, s]));
  const grants: VestingGrant[] = [];

  for (const sec of capTable.securities) {
    if (sec.kind !== 'common' && sec.kind !== 'option') continue;
    const s = sec as CommonStock | StockOption;
    const vestingMonths = s.vestingMonths ?? 0;
    if (vestingMonths === 0) continue;

    const holder = stakeholderMap.get(s.stakeholderId);
    if (!holder) continue;

    const cliffMonths = s.cliffMonths ?? 0;
    const grantDate = new Date(s.grantDate);
    const elapsed = Math.max(0, monthsBetween(grantDate, asOf));
    const pastCliff = elapsed >= cliffMonths;

    const vestedFraction = pastCliff ? Math.min(1, elapsed / vestingMonths) : 0;
    const vestedShares = Math.floor(s.shares * vestedFraction);
    const cliffDate = addMonths(grantDate, cliffMonths);
    const fullyVestsDate = addMonths(grantDate, vestingMonths);

    grants.push({
      id: s.id,
      stakeholderName: holder.name,
      kind: s.kind,
      totalShares: s.shares,
      vestedShares,
      unvestedShares: s.shares - vestedShares,
      vestedFraction,
      cliffFraction: vestingMonths > 0 ? cliffMonths / vestingMonths : 0,
      pastCliff,
      fullyVested: vestedFraction >= 1,
      grantDate: fmtDate(grantDate),
      cliffDate: fmtDate(cliffDate),
      fullyVestsDate: fmtDate(fullyVestsDate),
      vestingMonths,
      cliffMonths,
      strikePrice: sec.kind === 'option' ? sec.strikePrice : undefined,
    });
  }

  return grants;
}
