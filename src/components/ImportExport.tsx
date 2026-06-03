import React, { useRef, useState } from 'react';
import type { CapTable } from '../engine/captable';
import { serializeCapTable, deserializeCapTable } from '../engine/captable';

interface Props {
  capTable: CapTable;
  onImport: (ct: CapTable) => void;
}

export default function ImportExport({ capTable, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleCopy = async () => {
    const json = serializeCapTable(capTable);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: create textarea
      const ta = document.createElement('textarea');
      ta.value = json;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const json = serializeCapTable(capTable);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${capTable.companyName.replace(/\s+/g, '_')}_captable.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const ct = deserializeCapTable(ev.target?.result as string);
        onImport(ct);
      } catch {
        setImportError('Invalid JSON payload. Ensure it matches the CapTable schema.');
      }
    };
    reader.readAsText(file);
    // reset so same file can be re-imported
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs text-slate-400 uppercase tracking-widest">Import / Export</span>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleCopy}
          className={`py-2 rounded border text-xs transition-colors ${
            copied
              ? 'border-emerald-600 text-emerald-400 bg-emerald-900/20'
              : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
          }`}
        >
          {copied ? 'Copied!' : 'Copy JSON'}
        </button>

        <button
          onClick={handleDownload}
          className="py-2 rounded border border-slate-700 text-xs text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
        >
          Download .json
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          className="py-2 rounded border border-slate-700 text-xs text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
        >
          Upload JSON
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      {importError && (
        <p className="text-xs text-red-400 border border-red-800/50 rounded p-2">{importError}</p>
      )}

      {/* Compact JSON preview */}
      <div className="border border-slate-700/50 rounded p-2 bg-slate-900/50 max-h-40 overflow-y-auto">
        <pre className="text-[10px] text-slate-500 whitespace-pre-wrap break-all leading-relaxed">
          {serializeCapTable(capTable)}
        </pre>
      </div>
    </div>
  );
}
