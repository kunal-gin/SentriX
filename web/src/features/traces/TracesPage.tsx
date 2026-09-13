import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTraces, TraceDetail, Span } from '../../hooks/useTraces';
import {
  GitCommit,
  Clock,
  Search,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Code,
  FileText,
  Activity,
  ArrowUpRight,
  Layers,
  X,
  Server,
} from 'lucide-react';

export function TracesPage() {
  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedTraceId, setSelectedTraceId] = useState<string>('trc_9a8b7c6d5e4f');
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  const { data: traces, isLoading } = useTraces({
    service: serviceFilter,
    status: statusFilter,
  });

  const activeTrace = (traces || []).find((t) => t.trace_id === selectedTraceId) || (traces && traces[0]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Distributed Tracing & OpenTelemetry
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary/20 text-primary-light border border-primary/30">
              OTLP Compliant
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            End-to-end request propagation, microservice waterfall timing, and cross-signal correlation.
          </p>
        </div>

        {activeTrace && (
          <div className="flex items-center gap-2">
            <Link
              to={`/logs?trace_id=${activeTrace.trace_id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface hover:bg-surface-elevated text-xs font-mono text-primary-light border border-border transition-colors"
            >
              <FileText size={13} />
              <span>Correlated Logs</span>
            </Link>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-2xl p-4 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {['ALL', 'ERROR', 'OK'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                statusFilter === st
                  ? st === 'ERROR'
                    ? 'bg-critical text-white'
                    : 'bg-primary text-white shadow-glow-primary'
                  : 'bg-surface text-muted hover:text-white border border-border'
              }`}
            >
              {st === 'ALL' ? 'ALL TRACES' : st === 'ERROR' ? 'ERRORS ONLY' : 'HEALTHY'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:max-w-xs">
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
          >
            <option value="">All Microservices</option>
            <option value="edge-ingress">edge-ingress</option>
            <option value="payments-service">payments-service</option>
            <option value="auth-gateway">auth-gateway</option>
            <option value="worker-runner">worker-runner</option>
          </select>
        </div>
      </div>

      {/* Main Split View: Traces List & Interactive Waterfall */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Traces Explorer List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-mono text-muted uppercase tracking-wider px-1">
            Recorded Traces ({traces?.length ?? 0})
          </div>

          <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
            {isLoading && (
              <div className="py-12 text-center text-muted font-mono text-xs">
                Querying distributed trace index...
              </div>
            )}

            {(traces || []).map((t) => {
              const isSelected = activeTrace?.trace_id === t.trace_id;
              const isError = t.status === 'ERROR';

              return (
                <div
                  key={t.trace_id}
                  onClick={() => {
                    setSelectedTraceId(t.trace_id);
                    setSelectedSpan(null);
                  }}
                  className={`glass-card rounded-2xl p-4 border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary shadow-glow-primary bg-surface-elevated/70'
                      : 'border-border hover:border-border-bright hover:bg-surface-elevated/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        isError
                          ? 'bg-critical/15 text-critical border-critical/30'
                          : 'bg-healthy/15 text-healthy border-healthy/30'
                      }`}
                    >
                      {t.status}
                    </span>
                    <span className="text-xs font-mono font-bold text-white">
                      {t.duration_ms} ms
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <h4 className="text-sm font-bold text-white truncate">{t.root_operation}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted font-mono mt-1">
                      <span className="text-primary-light">{t.root_service}</span>
                      <span>•</span>
                      <span>{t.span_count} Spans</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted">
                    <span>{new Date(t.start_time).toLocaleTimeString()}</span>
                    <span className="text-text-dim text-[10px] truncate max-w-[120px]">
                      {t.trace_id}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Interactive Waterfall Canvas */}
        <div className="lg:col-span-7 space-y-4">
          {activeTrace ? (
            <div className="glass-card rounded-2xl p-6 border border-border shadow-glass space-y-6">
              {/* Waterfall Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-mono text-muted">
                    <span>Trace:</span>
                    <span className="text-white font-bold">{activeTrace.trace_id}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{activeTrace.root_operation}</h3>
                  <div className="flex items-center gap-3 text-xs font-mono text-muted">
                    <span>Total Latency: <strong className="text-white">{activeTrace.duration_ms} ms</strong></span>
                    <span>•</span>
                    <span>Spans: <strong className="text-white">{activeTrace.span_count}</strong></span>
                  </div>
                </div>

                <div className="text-right text-xs font-mono text-muted">
                  <div>Started: {new Date(activeTrace.start_time).toLocaleString()}</div>
                </div>
              </div>

              {/* Waterfall Timeline Visualization */}
              <div className="space-y-3">
                <div className="text-xs font-mono text-muted uppercase tracking-wider">
                  Microservice Span Waterfall Breakdown
                </div>

                <div className="space-y-2 font-mono text-xs">
                  {activeTrace.spans.map((span, idx) => {
                    const traceTotal = activeTrace.duration_ms || 1;
                    const spanStartOffset =
                      (new Date(span.start_time).getTime() -
                        new Date(activeTrace.start_time).getTime()) /
                      1;
                    const offsetPct = Math.max(0, Math.min(90, (spanStartOffset / traceTotal) * 100));
                    const widthPct = Math.max(8, Math.min(100 - offsetPct, (span.duration_ms / traceTotal) * 100));
                    const isSpanError = span.status === 'ERROR';

                    return (
                      <div
                        key={span.span_id}
                        onClick={() => setSelectedSpan(span)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                          selectedSpan?.span_id === span.span_id
                            ? 'bg-surface-elevated border-primary shadow-glow-primary'
                            : 'bg-background/60 border-border/80 hover:bg-surface-elevated/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isSpanError ? 'bg-critical' : 'bg-healthy'
                              }`}
                            />
                            <span className="font-bold text-white text-[11px] truncate">
                              {span.service_name}
                            </span>
                            <span className="text-muted text-[11px] truncate">
                              {span.operation}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px]">
                            {span.status_code && (
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] ${
                                  isSpanError ? 'text-critical' : 'text-healthy'
                                }`}
                              >
                                HTTP {span.status_code}
                              </span>
                            )}
                            <span className="font-bold text-white">{span.duration_ms} ms</span>
                          </div>
                        </div>

                        {/* Timing Bar */}
                        <div className="w-full bg-surface-highlight/70 h-2 rounded-full relative overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isSpanError
                                ? 'bg-critical shadow-glow-critical'
                                : idx === 0
                                ? 'bg-primary'
                                : 'bg-cyan'
                            }`}
                            style={{
                              marginLeft: `${offsetPct}%`,
                              width: `${widthPct}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Span Attributes Inspector Box */}
              {selectedSpan && (
                <div className="p-4 rounded-xl bg-surface/70 border border-primary/30 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <Code size={14} className="text-primary-light" />
                      <span className="text-white font-bold">Span Attributes:</span>
                      <span className="text-primary-light">{selectedSpan.operation}</span>
                    </div>
                    <button
                      onClick={() => setSelectedSpan(null)}
                      className="text-xs text-muted hover:text-white"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="text-muted">Span ID:</div>
                    <div className="text-white">{selectedSpan.span_id}</div>
                    <div className="text-muted">Parent Span:</div>
                    <div className="text-white">{selectedSpan.parent_span_id || 'root'}</div>
                    <div className="text-muted">Duration:</div>
                    <div className="text-white">{selectedSpan.duration_ms} ms</div>
                    {selectedSpan.attributes &&
                      Object.entries(selectedSpan.attributes).map(([k, v]) => (
                        <div key={k} className="contents">
                          <div className="text-muted">{k}:</div>
                          <div className="text-text-dim truncate">{String(v)}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-12 text-center text-muted font-mono text-xs">
              Select a trace on the left to inspect microservice waterfall timing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
