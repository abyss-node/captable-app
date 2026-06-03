import type { AuditLog, AuditAction } from '../engine/audit';

interface Props {
  log: AuditLog;
  onClear: () => void;
}

const ACTION_LABELS: Record<AuditAction, string> = {
  add_security:           'Added',
  edit_security:          'Edited',
  delete_security:        'Deleted',
  edit_company_name:      'Renamed',
  edit_authorized_shares: 'Auth shares',
  import:                 'Imported',
  reset:                  'Reset',
};

const ACTION_COLORS: Record<AuditAction, string> = {
  add_security:           'bg-emerald-900/50 text-emerald-400',
  edit_security:          'bg-sky-900/50 text-sky-400',
  delete_security:        'bg-red-900/50 text-red-400',
  edit_company_name:      'bg-violet-900/50 text-violet-400',
  edit_authorized_shares: 'bg-amber-900/50 text-amber-400',
  import:                 'bg-slate-700/60 text-slate-300',
  reset:                  'bg-slate-700/60 text-slate-400',
};

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function absoluteTime(isoString: string): string {
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function AuditLogView({ log, onClear }: Props) {
  const reversed = [...log].reverse();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 uppercase tracking-widest">Audit Log</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-600">{log.length} entries</span>
          {log.length > 0 && (
            <button
              onClick={() => { if (confirm('Clear the entire audit log?')) onClear(); }}
              className="text-[10px] text-red-500/60 hover:text-red-400 transition-colors"
            >
              Clear log
            </button>
          )}
        </div>
      </div>

      {log.length === 0 ? (
        <div className="border border-slate-700/50 rounded p-8 text-center">
          <p className="text-xs text-slate-500">No activity yet.</p>
          <p className="text-[10px] text-slate-600 mt-1">
            Every edit, addition, deletion, import, and reset will appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {reversed.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-start gap-3 px-3 py-2.5 border-b border-slate-800 hover:bg-slate-800/30 transition-colors ${
                i === 0 ? 'border-t border-slate-800' : ''
              }`}
            >
              {/* Timeline dot */}
              <div className="mt-1 shrink-0 flex flex-col items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${ACTION_COLORS[entry.action]}`}>
                    {ACTION_LABELS[entry.action]}
                  </span>
                  <span className="text-xs text-slate-300 truncate">{entry.description}</span>
                </div>
              </div>

              {/* Timestamp */}
              <span
                className="text-[10px] text-slate-600 shrink-0 tabular-nums mt-0.5"
                title={absoluteTime(entry.timestamp)}
              >
                {relativeTime(entry.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}

      {log.length > 0 && (
        <p className="text-[10px] text-slate-600 text-center">
          Showing {Math.min(log.length, 500)} of up to 500 entries · stored in localStorage
        </p>
      )}
    </div>
  );
}
