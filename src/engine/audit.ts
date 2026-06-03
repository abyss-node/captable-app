import type { CapTable, Security } from './captable';

export type AuditAction =
  | 'add_security'
  | 'edit_security'
  | 'delete_security'
  | 'edit_company_name'
  | 'edit_authorized_shares'
  | 'import'
  | 'reset';

export interface AuditEntry {
  id: string;
  timestamp: string; // ISO 8601
  action: AuditAction;
  description: string;
  meta?: Record<string, unknown>;
}

export type AuditLog = AuditEntry[];

const MAX_ENTRIES = 500;
const STORAGE_KEY = 'captable-app-audit';

// ─── Security summary for descriptions ───────────────────────────────────────

function secLabel(sec: Security, stakeholderName: string): string {
  switch (sec.kind) {
    case 'common':
      return `Common · ${stakeholderName} · ${sec.shares.toLocaleString()} shares`;
    case 'preferred':
      return `Preferred (${sec.seriesName}) · ${stakeholderName} · ${sec.shares.toLocaleString()} shares`;
    case 'option':
      return `Option · ${stakeholderName} · ${sec.shares.toLocaleString()} shares @ $${sec.strikePrice}`;
    case 'safe':
      return `SAFE · ${stakeholderName} · $${sec.investmentAmount.toLocaleString()}`;
    case 'convertible_note':
      return `Conv. Note · ${stakeholderName} · $${sec.principalAmount.toLocaleString()}`;
  }
}

function getStakeholderName(capTable: CapTable, stakeholderId: string): string {
  return capTable.stakeholders.find(s => s.id === stakeholderId)?.name ?? stakeholderId;
}

function makeId(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ─── Diff two cap tables and return audit entries ─────────────────────────────

export function diffCapTables(prev: CapTable, next: CapTable): AuditEntry[] {
  const entries: AuditEntry[] = [];
  const now = new Date().toISOString();

  // Company name
  if (prev.companyName !== next.companyName) {
    entries.push({
      id: makeId(),
      timestamp: now,
      action: 'edit_company_name',
      description: `Renamed company "${prev.companyName}" → "${next.companyName}"`,
      meta: { from: prev.companyName, to: next.companyName },
    });
  }

  // Authorized shares
  if (prev.authorizedShares !== next.authorizedShares) {
    entries.push({
      id: makeId(),
      timestamp: now,
      action: 'edit_authorized_shares',
      description: `Authorized shares ${prev.authorizedShares.toLocaleString()} → ${next.authorizedShares.toLocaleString()}`,
      meta: { from: prev.authorizedShares, to: next.authorizedShares },
    });
  }

  // Securities
  const prevMap = new Map(prev.securities.map(s => [s.id, s]));
  const nextMap = new Map(next.securities.map(s => [s.id, s]));

  // Added
  for (const [id, sec] of nextMap) {
    if (!prevMap.has(id)) {
      const name = getStakeholderName(next, sec.stakeholderId);
      entries.push({
        id: makeId(),
        timestamp: now,
        action: 'add_security',
        description: `Added ${secLabel(sec, name)}`,
        meta: { securityId: id, kind: sec.kind },
      });
    }
  }

  // Deleted
  for (const [id, sec] of prevMap) {
    if (!nextMap.has(id)) {
      const name = getStakeholderName(prev, sec.stakeholderId);
      entries.push({
        id: makeId(),
        timestamp: now,
        action: 'delete_security',
        description: `Deleted ${secLabel(sec, name)}`,
        meta: { securityId: id, kind: sec.kind },
      });
    }
  }

  // Edited
  for (const [id, nextSec] of nextMap) {
    const prevSec = prevMap.get(id);
    if (!prevSec) continue;
    if (JSON.stringify(prevSec) !== JSON.stringify(nextSec)) {
      const name = getStakeholderName(next, nextSec.stakeholderId);
      entries.push({
        id: makeId(),
        timestamp: now,
        action: 'edit_security',
        description: `Edited ${secLabel(nextSec, name)}`,
        meta: { securityId: id, kind: nextSec.kind },
      });
    }
  }

  return entries;
}

export function makeImportEntry(companyName: string): AuditEntry {
  return {
    id: makeId(),
    timestamp: new Date().toISOString(),
    action: 'import',
    description: `Imported cap table for "${companyName}"`,
  };
}

export function makeResetEntry(): AuditEntry {
  return {
    id: makeId(),
    timestamp: new Date().toISOString(),
    action: 'reset',
    description: 'Reset to default sandbox',
  };
}

// ─── localStorage persistence ─────────────────────────────────────────────────

export function loadAuditLog(): AuditLog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAuditLog(log: AuditLog): void {
  try {
    const trimmed = log.slice(-MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

export function appendToLog(log: AuditLog, entries: AuditEntry[]): AuditLog {
  return [...log, ...entries].slice(-MAX_ENTRIES);
}

export function clearAuditLog(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
