import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { 
  Box, Cpu, HardDrive, RefreshCw, Activity, ArrowDownLeft, ArrowUpRight, 
  RotateCw, AlertTriangle, CheckCircle2, Search, Filter, Server
} from 'lucide-react';
import { MetricCard, EmptyState, LoadingState } from '../../components/ui/Primitives';

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  server_id: string;
  server_name: string;
  cpu_usage_pct: float64;
  memory_usage_bytes: number;
  memory_limit_bytes: number;
  net_rx_bytes: number;
  net_tx_bytes: number;
  restart_count: number;
  oom_killed: boolean;
  created_at: string;
}

type float64 = number;

export const ContainersPage: React.FC = () => {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchContainers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/containers');
      setContainers(res.data);
    } catch (err) {
      console.error('Failed to load containers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return (mb / 1024).toFixed(1) + ' GB';
    }
    return Math.round(mb) + ' MB';
  };

  const filtered = containers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                          c.image.toLowerCase().includes(search.toLowerCase()) ||
                          c.server_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCPU = containers.reduce((acc, c) => acc + c.cpu_usage_pct, 0);
  const totalMem = containers.reduce((acc, c) => acc + c.memory_usage_bytes, 0);
  const runningCount = containers.filter(c => c.status === 'RUNNING').length;
  const oomKillsCount = containers.filter(c => c.oom_killed || c.restart_count > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Container Observability</h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              Docker Engine & OCI
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Real-time telemetry, OOM kill tracking, CPU/memory saturation, and container lifecycle across infrastructure hosts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchContainers}
            className="flex items-center gap-2 px-3 py-2 bg-[#1b1e24] hover:bg-[#252932] border border-[#2e3440] text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Containers"
          value={runningCount}
          subtitle={`Out of ${containers.length} provisioned`}
          icon={<Box className="w-5 h-5 text-cyan-400" />}
        />
        <MetricCard
          title="Aggregate CPU Saturation"
          value={`${totalCPU.toFixed(1)}%`}
          subtitle="Across Host Cores"
          icon={<Cpu className="w-5 h-5 text-indigo-400" />}
        />
        <MetricCard
          title="Allocated Container RAM"
          value={formatBytes(totalMem)}
          subtitle="Total Working Set RSS"
          icon={<HardDrive className="w-5 h-5 text-emerald-400" />}
        />
        <MetricCard
          title="Restarts / Unstable"
          value={oomKillsCount}
          subtitle="CrashLoop or OOM Events"
          icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-[#13161b] p-3 rounded-xl border border-[#232730]">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by container name, image, or host..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#181c23] border border-[#2e3440] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          {['ALL', 'RUNNING', 'EXITED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-cyan-600 text-white'
                  : 'bg-[#181c23] text-gray-400 hover:text-white border border-[#2e3440]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Container Cards Grid */}
      {loading ? (
        <LoadingState message="Polling container cgroups and network sockets..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Containers Found"
          description="No Docker or OCI containers match your active filter."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => {
            const memPct = Math.round((c.memory_usage_bytes / c.memory_limit_bytes) * 100) || 0;
            return (
              <div key={c.id} className="bg-[#13161b] border border-[#232730] hover:border-[#2e3440] rounded-xl p-5 space-y-4 shadow-xl transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Box className="w-4 h-4 text-cyan-400" />
                      <h3 className="font-semibold text-white text-sm truncate max-w-[200px]" title={c.name}>
                        {c.name}
                      </h3>
                    </div>
                    <div className="font-mono text-[11px] text-gray-400 truncate max-w-[240px]" title={c.image}>
                      {c.image}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                    c.status === 'RUNNING'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {c.status}
                  </span>
                </div>

                {/* Host */}
                <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-[#171a21] p-2 rounded-lg border border-[#232730]">
                  <Server className="w-3.5 h-3.5 text-gray-500" />
                  <span className="font-mono text-gray-300">{c.server_name}</span>
                </div>

                {/* Utilization Bars */}
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400 flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-indigo-400" /> CPU
                      </span>
                      <span className="font-mono text-white font-medium">{c.cpu_usage_pct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-[#1e222a] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          c.cpu_usage_pct > 80 ? 'bg-rose-500' : c.cpu_usage_pct > 50 ? 'bg-amber-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${Math.min(100, c.cpu_usage_pct)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400 flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-emerald-400" /> Memory
                      </span>
                      <span className="font-mono text-white font-medium">
                        {formatBytes(c.memory_usage_bytes)} / {formatBytes(c.memory_limit_bytes)} ({memPct}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#1e222a] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          memPct > 85 ? 'bg-rose-500' : memPct > 65 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, memPct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Network & Restarts */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1e222a] text-xs">
                  <div className="flex items-center gap-1 text-gray-400">
                    <ArrowDownLeft className="w-3 h-3 text-cyan-400" />
                    <span className="font-mono text-gray-300">{formatBytes(c.net_rx_bytes)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <ArrowUpRight className="w-3 h-3 text-blue-400" />
                    <span className="font-mono text-gray-300">{formatBytes(c.net_tx_bytes)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                  <div className="flex items-center gap-1.5">
                    <RotateCw className="w-3 h-3 text-gray-400" />
                    <span>Restarts: {c.restart_count}</span>
                  </div>
                  {c.oom_killed && (
                    <span className="text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                      OOM KILLED
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
