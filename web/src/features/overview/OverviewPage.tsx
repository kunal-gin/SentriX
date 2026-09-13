import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboardSummary, useServers, Server } from '../../hooks/useDashboard';
import { EnrollServerModal } from './EnrollServerModal';
import {
  Server as ServerIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  Search,
  Cpu,
  HardDrive,
  CircuitBoard,
  Copy,
  Check,
  RefreshCw,
  Plus,
} from 'lucide-react';

function StatusPill({ status }: { status: string }) {
  const config = {
    ONLINE: {
      bg: 'bg-healthy/15',
      text: 'text-healthy',
      border: 'border-healthy/30',
      dot: 'bg-healthy animate-pulse-glow shadow-glow-healthy',
      label: 'ONLINE',
    },
    SUSPECT: {
      bg: 'bg-warning/15',
      text: 'text-warning',
      border: 'border-warning/30',
      dot: 'bg-warning animate-pulse shadow-glow-warning',
      label: 'HIGH LOAD',
    },
    OFFLINE: {
      bg: 'bg-critical/15',
      text: 'text-critical',
      border: 'border-critical/30',
      dot: 'bg-critical',
      label: 'OFFLINE',
    },
  }[status] || {
    bg: 'bg-offline/15',
    text: 'text-offline',
    border: 'border-offline/30',
    dot: 'bg-offline',
    label: status,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border ${config.bg} ${config.text} ${config.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function MetricBar({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-text-dim text-xs font-mono">—</span>;
  }

  const rounded = Math.round(value * 10) / 10;

  // Dynamic gradient based on percentage
  let barGradient = 'from-emerald-500 to-teal-400';
  let badgeColor = 'text-healthy';
  if (rounded >= 85) {
    barGradient = 'from-rose-500 to-amber-500';
    badgeColor = 'text-critical font-bold';
  } else if (rounded >= 70) {
    barGradient = 'from-amber-500 to-yellow-400';
    badgeColor = 'text-warning font-semibold';
  }

  return (
    <div className="flex items-center gap-2.5 w-32">
      <div className="flex-1 h-2 bg-surface-highlight rounded-full overflow-hidden p-0.5 border border-border">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barGradient} transition-all duration-700`}
          style={{ width: `${Math.min(rounded, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-mono w-10 text-right ${badgeColor}`}>
        {rounded.toFixed(0)}%
      </span>
    </div>
  );
}

export function OverviewPage() {
  const { data: summary, isLoading: summaryLoading, refetch } = useDashboardSummary();
  const { data: servers, isLoading: serversLoading } = useServers();
  const [filter, setFilter] = useState<'ALL' | 'ONLINE' | 'SUSPECT' | 'OFFLINE'>('ALL');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filteredServers = (servers || []).filter((s) => {
    if (filter !== 'ALL' && s.status !== filter) return false;
    if (
      search &&
      !s.name.toLowerCase().includes(search.toLowerCase()) &&
      !s.hostname.toLowerCase().includes(search.toLowerCase()) &&
      !s.platform.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Hero Title & Live Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Infrastructure Fleet
            <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-primary/20 text-primary-light border border-primary/30">
              Live Observability
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Real-time telemetry, capacity utilization, and node status across all clusters.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setEnrollOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary via-primary to-primary-hover hover:opacity-95 text-xs font-semibold text-white shadow-glow-primary transition-all duration-200 active:scale-95"
          >
            <Plus size={14} />
            <span>Enroll Node</span>
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border hover:border-border-strong text-xs text-muted hover:text-white transition-all shadow-sm group"
          >
            <RefreshCw size={13} className="group-hover:rotate-180 transition-transform duration-500 text-primary-light" />
            <span>Sync Now</span>
          </button>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface/60 border border-border text-xs text-muted">
            <Clock size={13} className="text-healthy" />
            <span className="font-mono text-[11px]">Heartbeat: 5s</span>
          </div>
        </div>
      </div>

      <EnrollServerModal isOpen={enrollOpen} onClose={() => setEnrollOpen(false)} />

      {/* Bento Grid: 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Nodes */}
        <div className="glass-card-interactive rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-primary/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted font-medium">
                Total Fleet Nodes
              </span>
              <div className="text-3xl font-extrabold text-white mt-1.5 tracking-tight">
                {summaryLoading ? '—' : summary?.servers.total ?? 0}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary-light shadow-sm">
              <ServerIcon size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted font-mono">
            <span>All Clusters</span>
            <span className="text-primary-light flex items-center gap-1 font-semibold">
              100% Monitored <ArrowUpRight size={13} />
            </span>
          </div>
        </div>

        {/* Healthy Nodes */}
        <div className="glass-card-interactive rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-healthy/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-healthy/90 font-medium">
                Healthy & Nominal
              </span>
              <div className="text-3xl font-extrabold text-healthy mt-1.5 tracking-tight">
                {summaryLoading ? '—' : summary?.servers.online ?? 0}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-healthy/10 border border-healthy/20 text-healthy shadow-sm">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted font-mono">
            <span>Optimal State</span>
            <span className="text-healthy font-semibold">
              {summary?.servers.total
                ? Math.round(((summary.servers.online) / summary.servers.total) * 100)
                : 100}%
            </span>
          </div>
        </div>

        {/* Warning / Suspect Nodes */}
        <div className="glass-card-interactive rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-warning/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-warning/90 font-medium">
                High Load / Warnings
              </span>
              <div className="text-3xl font-extrabold text-warning mt-1.5 tracking-tight">
                {summaryLoading ? '—' : summary?.servers.suspect ?? 0}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-warning/10 border border-warning/20 text-warning shadow-sm">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted font-mono">
            <span>Threshold Exceeded</span>
            <span className="text-warning font-semibold">Action Advised</span>
          </div>
        </div>

        {/* Offline Nodes */}
        <div className="glass-card-interactive rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-critical/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted font-medium">
                Degraded / Offline
              </span>
              <div className="text-3xl font-extrabold text-white mt-1.5 tracking-tight">
                {summaryLoading ? '—' : summary?.servers.offline ?? 0}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-highlight border border-border text-muted shadow-sm">
              <XCircle size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted font-mono">
            <span>Critical Failures</span>
            <span className="text-healthy font-semibold">None Reported</span>
          </div>
        </div>
      </div>

      {/* Server Fleet Section */}
      <div className="glass-card rounded-2xl border border-border overflow-hidden shadow-glass">
        {/* Controls Toolbar */}
        <div className="p-5 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/40">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-background/70 p-1 rounded-xl border border-border">
            {(['ALL', 'ONLINE', 'SUSPECT', 'OFFLINE'] as const).map((tab) => {
              const isActive = filter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-glow-primary'
                      : 'text-muted hover:text-white hover:bg-surface'
                  }`}
                >
                  {tab === 'ALL'
                    ? `ALL (${servers?.length ?? 0})`
                    : tab === 'ONLINE'
                    ? `HEALTHY (${summary?.servers.online ?? 0})`
                    : tab === 'SUSPECT'
                    ? `WARNING (${summary?.servers.suspect ?? 0})`
                    : `OFFLINE (${summary?.servers.offline ?? 0})`}
                </button>
              );
            })}
          </div>

          {/* Table Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={14} />
            <input
              type="text"
              placeholder="Filter by name, host, OS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background/80 border border-border focus:border-primary/50 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
            />
          </div>
        </div>

        {/* Server Fleet Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50 text-[11px] font-mono text-muted uppercase tracking-wider">
                <th className="px-6 py-3.5 font-semibold">Node Status</th>
                <th className="px-6 py-3.5 font-semibold">Server & Hostname</th>
                <th className="px-6 py-3.5 font-semibold">Platform</th>
                <th className="px-6 py-3.5 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <Cpu size={13} /> CPU
                  </div>
                </th>
                <th className="px-6 py-3.5 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <CircuitBoard size={13} /> Memory
                  </div>
                </th>
                <th className="px-6 py-3.5 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <HardDrive size={13} /> Disk
                  </div>
                </th>
                <th className="px-6 py-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {serversLoading && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-primary-light" />
                      <span>Scanning infrastructure nodes...</span>
                    </div>
                  </td>
                </tr>
              )}

              {!serversLoading && filteredServers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-white">No matching nodes found</p>
                      <p className="text-xs">Adjust your search or status filter to see servers.</p>
                    </div>
                  </td>
                </tr>
              )}

              {filteredServers.map((server: Server) => (
                <tr
                  key={server.id}
                  className="hover:bg-surface-elevated/60 transition-colors duration-150 group"
                >
                  {/* Status Pill */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusPill status={server.status} />
                  </td>

                  {/* Server Details */}
                  <td className="px-6 py-4">
                    <div className="space-y-0.5">
                      <Link
                        to={`/servers/${server.id}`}
                        className="font-semibold text-white hover:text-primary-light transition-colors flex items-center gap-1.5 group-hover:translate-x-0.5 transform duration-150"
                      >
                        <span>{server.name}</span>
                        <ArrowUpRight size={13} className="text-muted group-hover:text-primary-light transition-colors" />
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-muted font-mono">
                        <span>{server.hostname}</span>
                        <button
                          onClick={() => copyText(server.hostname, server.id)}
                          title="Copy hostname"
                          className="text-text-dim hover:text-white transition-colors"
                        >
                          {copiedId === server.id ? (
                            <Check size={12} className="text-healthy" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Platform */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-surface border border-border text-muted font-mono">
                      {server.platform}
                    </span>
                  </td>

                  {/* CPU Metric */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <MetricBar value={server.cpu} />
                  </td>

                  {/* Memory Metric */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <MetricBar value={server.memory} />
                  </td>

                  {/* Disk Metric */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <MetricBar value={server.disk} />
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Link
                      to={`/servers/${server.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-highlight/70 hover:bg-primary hover:text-white text-xs text-muted font-medium border border-border hover:border-primary transition-all duration-150"
                    >
                      <span>Telemetry</span>
                      <ArrowUpRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
