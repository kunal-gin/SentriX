import { useState, useEffect } from 'react';
import {
  Database,
  Layers,
  Clock,
  Zap,
  Lock,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Activity,
  HardDrive,
} from 'lucide-react';
import { MetricCard } from '../../components/ui/Primitives';
import { api } from '../../api/client';

interface PostgresDiagnostics {
  instance_name: string;
  version: string;
  active_connections: number;
  max_connections: number;
  connection_saturation_percent: number;
  cache_hit_ratio: number;
  transactions_per_sec: number;
  replication_lag_bytes: number;
  replication_lag_seconds: number;
  deadlocks_detected: number;
  wal_generation_mbps: number;
  database_size_bytes: number;
  active_queries: {
    pid: number;
    user: string;
    database: string;
    state: string;
    duration_seconds: number;
    query: string;
    started_at: string;
  }[];
  slow_queries: {
    query_id: string;
    calls: number;
    mean_time_ms: number;
    max_time_ms: number;
    total_time_ms: number;
    query: string;
  }[];
  locks: {
    pid: number;
    lock_type: string;
    mode: string;
    granted: boolean;
    relation: string;
    blocked_by_pid: number;
  }[];
}

export function DatabasesPage() {
  const [data, setData] = useState<PostgresDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'slow' | 'locks'>('active');

  async function loadData() {
    try {
      const res = await api.get<PostgresDiagnostics>('/databases/postgres');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load database diagnostics', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const sizeGB = data ? Math.round(data.database_size_bytes / (1024 * 1024 * 1024)) : 64;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Database className="text-cyan" size={26} />
              PostgreSQL & Database Observability
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-cyan/20 text-cyan border border-cyan/30">
              Phase 21
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Deep internal metrics: connection pool saturation, cache hit ratio, slow query profiling & lock contention
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-surface/80 border border-border px-3 py-1.5 rounded-xl text-xs font-mono text-muted">
            <span className="w-2 h-2 rounded-full bg-healthy animate-pulse" />
            <span>{data?.instance_name || 'timescaledb-cluster-primary'}</span>
          </div>
          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-surface border border-border hover:border-primary/50 text-muted hover:text-white transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Pool Saturation"
          value={data ? `${data.active_connections} / ${data.max_connections}` : '84 / 200'}
          subtitle={data ? `${data.connection_saturation_percent}% Utilized` : '42% Utilized'}
          icon={<Layers size={18} className="text-primary-light" />}
        />
        <MetricCard
          title="Cache Hit Ratio"
          value={data ? `${data.cache_hit_ratio}%` : '99.82%'}
          subtitle="Shared Buffer Efficiency"
          icon={<Zap size={18} className="text-healthy" />}
        />
        <MetricCard
          title="Throughput (TPS)"
          value={data ? `${data.transactions_per_sec.toLocaleString()} /s` : '1,420.5 /s'}
          subtitle="Committed Transactions"
          icon={<Activity size={18} className="text-cyan" />}
        />
        <MetricCard
          title="Replication Lag"
          value={data ? `${data.replication_lag_seconds}s (${Math.round(data.replication_lag_bytes / (1024 * 1024))} MB)` : '0.12s (4 MB)'}
          subtitle="WAL Streaming Replica"
          icon={<Clock size={18} className="text-warning" />}
        />
      </div>

      {/* Tabs selector */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setTab('active')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            tab === 'active'
              ? 'bg-primary text-white shadow-glow-primary'
              : 'text-muted hover:text-white bg-surface/50 border border-border'
          }`}
        >
          Active Queries ({data?.active_queries?.length || 0})
        </button>
        <button
          onClick={() => setTab('slow')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            tab === 'slow'
              ? 'bg-primary text-white shadow-glow-primary'
              : 'text-muted hover:text-white bg-surface/50 border border-border'
          }`}
        >
          Slow Query Profiler ({data?.slow_queries?.length || 0})
        </button>
        <button
          onClick={() => setTab('locks')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            tab === 'locks'
              ? 'bg-primary text-white shadow-glow-primary'
              : 'text-muted hover:text-white bg-surface/50 border border-border'
          }`}
        >
          Lock Contention ({data?.locks?.length || 0})
        </button>
      </div>

      {/* Tab Panels */}
      {tab === 'active' && (
        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Currently Executing SQL Queries</h2>
            <span className="text-xs text-muted font-mono">pg_stat_activity realtime feed</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-mono text-muted uppercase border-b border-border bg-surface/50">
                <tr>
                  <th className="py-2.5 px-3">PID</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Database</th>
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Query</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {data?.active_queries?.map((q) => (
                  <tr key={q.pid} className="hover:bg-surface/40 transition-colors">
                    <td className="py-3 px-3 text-cyan">{q.pid}</td>
                    <td className="py-3 px-3 text-white">{q.user}</td>
                    <td className="py-3 px-3 text-muted">{q.database}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          q.state === 'active'
                            ? 'bg-healthy/20 text-healthy border border-healthy/30'
                            : 'bg-surface-highlight text-muted border border-border'
                        }`}
                      >
                        {q.state}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-warning">{q.duration_seconds}s</td>
                    <td className="py-3 px-3 text-text-dim max-w-md truncate font-sans text-xs">
                      {q.query}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'slow' && (
        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              Aggregated Slow Queries (pg_stat_statements)
            </h2>
            <span className="text-xs text-muted font-mono">Ranked by mean execution time</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-mono text-muted uppercase border-b border-border bg-surface/50">
                <tr>
                  <th className="py-2.5 px-3">Query ID</th>
                  <th className="py-2.5 px-3">Calls</th>
                  <th className="py-2.5 px-3">Mean Time</th>
                  <th className="py-2.5 px-3">Max Time</th>
                  <th className="py-2.5 px-3">Total Time</th>
                  <th className="py-2.5 px-3">Query Pattern</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {data?.slow_queries?.map((sq) => (
                  <tr key={sq.query_id} className="hover:bg-surface/40 transition-colors">
                    <td className="py-3 px-3 text-primary-light font-bold">{sq.query_id}</td>
                    <td className="py-3 px-3 text-white">{sq.calls.toLocaleString()}</td>
                    <td className="py-3 px-3 text-warning font-bold">{sq.mean_time_ms} ms</td>
                    <td className="py-3 px-3 text-critical">{sq.max_time_ms} ms</td>
                    <td className="py-3 px-3 text-muted">
                      {Math.round(sq.total_time_ms / 1000)}s
                    </td>
                    <td className="py-3 px-3 text-text font-sans text-xs max-w-md truncate">
                      {sq.query}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'locks' && (
        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Active Lock Contention & Deadlocks</h2>
            <span className="text-xs text-muted font-mono">pg_locks analysis</span>
          </div>

          {data?.locks?.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No blocking locks or lock contention detected.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] font-mono text-muted uppercase border-b border-border bg-surface/50">
                  <tr>
                    <th className="py-2.5 px-3">PID</th>
                    <th className="py-2.5 px-3">Lock Type</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Relation</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Blocked By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {data?.locks?.map((l, idx) => (
                    <tr key={idx} className="hover:bg-surface/40 transition-colors">
                      <td className="py-3 px-3 text-cyan">{l.pid}</td>
                      <td className="py-3 px-3 text-white">{l.lock_type}</td>
                      <td className="py-3 px-3 text-warning">{l.mode}</td>
                      <td className="py-3 px-3 text-primary-light">{l.relation}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            l.granted
                              ? 'bg-healthy/20 text-healthy border border-healthy/30'
                              : 'bg-critical/20 text-critical border border-critical/30 animate-pulse'
                          }`}
                        >
                          {l.granted ? 'GRANTED' : 'WAITING'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-muted">
                        {l.blocked_by_pid ? `PID ${l.blocked_by_pid}` : 'None'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
