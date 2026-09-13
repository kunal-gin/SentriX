import { useState } from 'react';
import { useCentralLogs, StructuredLogEntry } from '../../hooks/useCentralLogs';
import {
  FileText,
  Search,
  Radio,
  Pause,
  Play,
  Filter,
  Layers,
  Server,
  Code,
  X,
  Copy,
  Check,
  ChevronRight,
  Clock,
  Terminal,
} from 'lucide-react';

export function CentralLogsPage() {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<string>('ALL');
  const [service, setService] = useState<string>('');
  const [liveTail, setLiveTail] = useState<boolean>(true);
  const [selectedLog, setSelectedLog] = useState<StructuredLogEntry | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useCentralLogs(
    {
      query,
      level,
      service,
    },
    liveTail
  );

  const logs = data?.logs || [];

  function handleCopyJSON() {
    if (!selectedLog) return;
    navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Centralized Log Platform
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary/20 text-primary-light border border-primary/30">
              {logs.length} Events
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Structured full-text log search with live tail and request/trace correlation.
          </p>
        </div>

        {/* Live Tail Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLiveTail(!liveTail)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold border transition-all ${
              liveTail
                ? 'bg-healthy/10 text-healthy border-healthy/30 shadow-glow-healthy'
                : 'bg-surface text-muted border-border hover:text-white'
            }`}
          >
            {liveTail ? <Pause size={13} /> : <Play size={13} />}
            <span>{liveTail ? 'LIVE STREAM ACTIVE' : 'STREAM PAUSED'}</span>
            {liveTail && <span className="w-2 h-2 rounded-full bg-healthy animate-ping" />}
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card rounded-2xl p-4 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Severity Level Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevel(lvl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                level === lvl
                  ? lvl === 'ERROR'
                    ? 'bg-critical text-white'
                    : lvl === 'WARN'
                    ? 'bg-warning text-black'
                    : 'bg-primary text-white shadow-glow-primary'
                  : 'bg-surface text-muted hover:text-white border border-border'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Search & Service Filter */}
        <div className="flex items-center gap-3 w-full md:max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
            <input
              type="text"
              placeholder="Search phrase, message, request ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-background border border-border focus:border-primary rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-muted focus:outline-none"
            />
          </div>

          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="bg-background border border-border focus:border-primary rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
          >
            <option value="">All Services</option>
            <option value="telemetry-engine">telemetry-engine</option>
            <option value="payments-service">payments-service</option>
            <option value="auth-gateway">auth-gateway</option>
            <option value="edge-ingress">edge-ingress</option>
            <option value="worker-runner">worker-runner</option>
          </select>
        </div>
      </div>

      {/* Terminal-like Central Log Console */}
      <div className="glass-card rounded-2xl border border-border overflow-hidden shadow-glass">
        <div className="p-3 bg-surface-elevated/80 border-b border-border flex items-center justify-between text-xs font-mono text-muted">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-primary-light" />
            <span className="text-white font-semibold">Structured Log Streams</span>
            <span>(Click any line to open JSON details)</span>
          </div>
          <div>Page size: {logs.length} records</div>
        </div>

        <div className="divide-y divide-border/40 font-mono text-xs max-h-[650px] overflow-y-auto">
          {isLoading && (
            <div className="py-16 text-center text-muted font-mono">
              Connecting to log ingestion stream...
            </div>
          )}

          {!isLoading && logs.length === 0 && (
            <div className="py-16 text-center text-muted font-mono">
              No matching log records found for active filters.
            </div>
          )}

          {logs.map((log) => {
            const isError = log.level === 'ERROR';
            const isWarn = log.level === 'WARN';

            return (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="p-3 hover:bg-surface-elevated/60 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center gap-3 group"
              >
                {/* Timestamp & Level */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-muted text-[11px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      isError
                        ? 'bg-critical/15 text-critical border-critical/30'
                        : isWarn
                        ? 'bg-warning/15 text-warning border-warning/30'
                        : 'bg-primary/10 text-primary-light border-primary/20'
                    }`}
                  >
                    {log.level}
                  </span>
                </div>

                {/* Service & Server Tags */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] text-text-dim group-hover:text-primary-light transition-colors">
                    {log.service}
                  </span>
                  <span className="text-text-dim text-[11px] hidden lg:inline">
                    @{log.server}
                  </span>
                </div>

                {/* Log Message */}
                <div className="flex-1 text-text text-xs truncate group-hover:text-white transition-colors">
                  {log.message}
                </div>

                {/* Request / Trace correlation badges */}
                {(log.request_id || log.trace_id) && (
                  <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                    {log.trace_id && (
                      <span className="px-1.5 py-0.5 rounded bg-surface-highlight text-primary-light border border-primary/20">
                        {log.trace_id}
                      </span>
                    )}
                    {log.request_id && (
                      <span className="px-1.5 py-0.5 rounded bg-surface text-muted border border-border">
                        {log.request_id}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* JSON Viewer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-card rounded-2xl p-6 border border-primary/40 shadow-glow-primary max-w-2xl w-full space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-mono text-xs">
                <Code size={16} className="text-primary-light" />
                <span className="text-white font-bold">Log Record Payload</span>
                <span className="px-2 py-0.5 rounded bg-surface text-muted">
                  {selectedLog.id}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyJSON}
                  className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface transition-colors"
                  title="Copy JSON"
                >
                  {copied ? <Check size={14} className="text-healthy" /> : <Copy size={14} />}
                </button>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Formatted JSON */}
            <div className="p-4 rounded-xl bg-background/90 border border-border font-mono text-xs text-text overflow-x-auto max-h-96">
              <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-elevated text-xs font-semibold text-white border border-border"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
