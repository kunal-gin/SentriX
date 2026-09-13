import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfrastructure, FleetHost } from '../../hooks/useServices';
import {
  Server,
  Activity,
  Cpu,
  CircuitBoard,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  ArrowUpRight,
  Terminal,
  Shield,
  Layers,
} from 'lucide-react';
import { Badge } from '../../components/ui/Primitives';

export function InfrastructurePage() {
  const { data: fleet, isLoading } = useInfrastructure();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filtered = (fleet || []).filter((h) => {
    if (statusFilter !== 'ALL' && h.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        h.name.toLowerCase().includes(q) ||
        h.hostname.toLowerCase().includes(q) ||
        h.os.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const onlineCount = (fleet || []).filter((h) => h.status === 'ONLINE').length;
  const suspectCount = (fleet || []).filter((h) => h.status === 'SUSPECT').length;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Infrastructure & Fleet Matrix
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary/20 text-primary-light border border-primary/30">
              {fleet?.length ?? 0} Nodes Discovered
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Automatic host discovery, kernel/OS detection, and agent version fleet tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/metrics"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface hover:bg-surface-elevated text-xs font-mono text-primary-light border border-border transition-colors"
          >
            <Activity size={14} />
            <span>Multi-Node Metrics</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4 border border-border">
          <div className="text-[11px] font-mono text-muted uppercase">Total Fleet Size</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{fleet?.length ?? 0} Nodes</div>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-healthy/30 bg-healthy/5">
          <div className="text-[11px] font-mono text-healthy uppercase flex items-center gap-1">
            <CheckCircle2 size={12} /> Online & Streaming
          </div>
          <div className="text-2xl font-bold text-healthy font-mono mt-1">{onlineCount}</div>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-warning/30 bg-warning/5">
          <div className="text-[11px] font-mono text-warning uppercase flex items-center gap-1">
            <AlertTriangle size={12} /> Degraded / Suspect
          </div>
          <div className="text-2xl font-bold text-warning font-mono mt-1">{suspectCount}</div>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-border">
          <div className="text-[11px] font-mono text-muted uppercase">Fleet Telemetry Protocol</div>
          <div className="text-base font-bold text-primary-light font-mono mt-1.5">TimescaleDB / Hypertable</div>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {['ALL', 'ONLINE', 'SUSPECT', 'OFFLINE'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-primary text-white shadow-glow-primary'
                  : 'bg-surface text-muted hover:text-white border border-border'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
          <input
            type="text"
            placeholder="Filter by hostname, OS, kernel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-border focus:border-primary rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-muted focus:outline-none"
          />
        </div>
      </div>

      {/* Fleet Discovery Table */}
      <div className="glass-card rounded-2xl border border-border overflow-hidden shadow-glass">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated/70 border-b border-border text-[11px] font-mono text-muted uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Node Name & Hostname</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold">Operating System & Kernel</th>
                <th className="py-3.5 px-4 font-semibold">Agent</th>
                <th className="py-3.5 px-4 font-semibold text-right">CPU</th>
                <th className="py-3.5 px-4 font-semibold text-right">Memory</th>
                <th className="py-3.5 px-4 font-semibold text-right">Disk</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted font-mono">
                    Discovering fleet telemetry topology...
                  </td>
                </tr>
              )}

              {filtered.map((host) => {
                const isOnline = host.status === 'ONLINE';
                const isSuspect = host.status === 'SUSPECT';

                return (
                  <tr key={host.id} className="hover:bg-surface-elevated/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-primary-light">
                          <Server size={14} />
                        </div>
                        <div>
                          <Link
                            to={`/servers/${host.id}`}
                            className="font-bold text-white hover:text-primary-light transition-colors"
                          >
                            {host.name}
                          </Link>
                          <div className="text-[11px] font-mono text-muted mt-0.5">
                            {host.hostname}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          isOnline
                            ? 'bg-healthy/15 text-healthy border-healthy/30'
                            : isSuspect
                            ? 'bg-warning/15 text-warning border-warning/30 animate-pulse'
                            : 'bg-critical/15 text-critical border-critical/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOnline ? 'bg-healthy' : isSuspect ? 'bg-warning' : 'bg-critical'
                          }`}
                        />
                        {host.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-text">
                      <div className="text-white">{host.os || 'Linux'}</div>
                      <div className="text-muted text-[10px]">{host.kernel || '6.8.0-generic'} ({host.arch || 'x86_64'})</div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-surface border border-border text-primary-light">
                        {host.agent_version || 'v1.2.4'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={host.cpu > 80 ? 'text-critical' : host.cpu > 60 ? 'text-warning' : 'text-white'}>
                        {host.cpu}%
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={host.memory > 80 ? 'text-critical' : host.memory > 60 ? 'text-warning' : 'text-white'}>
                        {host.memory}%
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={host.disk > 80 ? 'text-critical' : host.disk > 60 ? 'text-warning' : 'text-white'}>
                        {host.disk}%
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/servers/${host.id}`}
                        className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface transition-colors inline-block"
                        title="View Node Telemetry"
                      >
                        <ArrowUpRight size={15} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
