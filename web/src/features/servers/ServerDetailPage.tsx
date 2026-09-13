import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useServers } from '../../hooks/useDashboard';
import { useServerMetrics } from '../../hooks/useMetrics';
import { fetchJSON, mutateJSON } from '../../lib/api';
import { MaintenanceModal } from './MaintenanceModal';
import {
  ArrowLeft,
  Server as ServerIcon,
  Cpu,
  CircuitBoard,
  HardDrive,
  Clock,
  Copy,
  Check,
  Activity,
  Terminal,
  Trash2,
  AlertCircle,
  Sliders,
  CheckCircle2,
  Search,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';

const ranges = [
  { key: '15m', label: '15m' },
  { key: '1h', label: '1h' },
  { key: '6h', label: '6h' },
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
];

const metricTabs = [
  { key: 'cpu', label: 'CPU Utilization', icon: Cpu, color: '#6366f1', gradient: 'colorCpu' },
  { key: 'memory', label: 'Memory Pressure', icon: CircuitBoard, color: '#f59e0b', gradient: 'colorMem' },
  { key: 'disk', label: 'Storage I/O & Disk', icon: HardDrive, color: '#06b6d4', gradient: 'colorDisk' },
];

interface ProcessItem {
  pid: number;
  name: string;
  user: string;
  cpu: number;
  memory_rss: string;
  state: string;
}

interface LogItem {
  timestamp: string;
  level: string;
  unit: string;
  message: string;
}

interface SilenceItem {
  id: string;
  server_id?: string;
  reason: string;
  ends_at: string;
  active: boolean;
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-surface-highlight border border-border p-3 rounded-xl shadow-xl space-y-1 font-mono text-xs">
        <div className="text-text-dim">{new Date(data.time).toLocaleTimeString()}</div>
        <div className="text-white font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].color }} />
          <span>{data.value.toFixed(1)}%</span>
        </div>
      </div>
    );
  }
  return null;
}

export function ServerDetailPage() {
  const { serverId } = useParams<{ serverId: string }>();
  const [activeViewTab, setActiveViewTab] = useState<'metrics' | 'processes' | 'logs'>('metrics');
  const [metric, setMetric] = useState('cpu');
  const [range, setRange] = useState('1h');
  const [copied, setCopied] = useState(false);

  // Modals & Actions
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Search & Filter
  const [processSearch, setProcessSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState('ALL');

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: servers, isLoading: serversLoading } = useServers();
  const { data: metrics, isLoading: metricsLoading } = useServerMetrics(serverId, metric, range);

  // Silences query
  const { data: silences } = useQuery<SilenceItem[]>({
    queryKey: ['silences'],
    queryFn: () => fetchJSON<SilenceItem[]>('/silences'),
    refetchInterval: 15000,
  });

  // Top processes query
  const { data: processesData, isLoading: processesLoading, refetch: refetchProcesses } = useQuery<{
    count: number;
    processes: ProcessItem[];
  }>({
    queryKey: ['server-processes', serverId],
    queryFn: () => fetchJSON<{ count: number; processes: ProcessItem[] }>(`/servers/${serverId}/processes`),
    enabled: activeViewTab === 'processes',
    refetchInterval: 5000,
  });

  // Logs query
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery<LogItem[]>({
    queryKey: ['server-logs', serverId],
    queryFn: () => fetchJSON<LogItem[]>(`/servers/${serverId}/logs`),
    enabled: activeViewTab === 'logs',
    refetchInterval: 5000,
  });

  const server = servers?.find((s) => s.id === serverId);
  const activeSilence = silences?.find((s) => s.server_id === serverId && s.active);

  async function handleDeleteServer() {
    if (!serverId) return;
    setDeleting(true);
    try {
      await mutateJSON(`/servers/${serverId}`, 'DELETE');
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      navigate('/');
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  }

  async function handleEndSilence(silenceId: string) {
    try {
      await mutateJSON(`/silences/${silenceId}`, 'DELETE');
      queryClient.invalidateQueries({ queryKey: ['silences'] });
    } catch (err) {
      console.error('Failed to cancel silence', err);
    }
  }

  function copyServerId() {
    if (serverId) {
      navigator.clipboard.writeText(serverId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (serversLoading) {
    return (
      <div className="max-w-7xl mx-auto py-16 text-center text-muted">
        <div className="inline-flex items-center gap-2.5">
          <Activity size={18} className="animate-spin text-primary-light" />
          <span>Loading node telemetry...</span>
        </div>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="max-w-7xl mx-auto space-y-4 py-16 text-center">
        <div className="text-lg font-semibold text-white">Server Node Not Found</div>
        <p className="text-sm text-muted">The requested node ID does not exist in the active fleet.</p>
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-xs font-semibold text-white hover:border-primary transition-colors"
          >
            <ArrowLeft size={14} /> Back to Overview
          </Link>
        </div>
      </div>
    );
  }

  const chartData =
    metrics?.points?.map((p) => ({
      time: new Date(p.time).getTime(),
      value: p.value,
    })) ?? [];

  const activeMetricConfig =
    metricTabs.find((m) => m.key === metric) || metricTabs[0];

  const filteredProcesses = processesData?.processes?.filter((p) => {
    return (
      processSearch === '' ||
      p.name.toLowerCase().includes(processSearch.toLowerCase()) ||
      p.user.toLowerCase().includes(processSearch.toLowerCase()) ||
      p.pid.toString().includes(processSearch)
    );
  });

  const filteredLogs = logsData?.filter((l) => {
    const matchesLevel = logLevelFilter === 'ALL' || l.level === logLevelFilter;
    const matchesText =
      logSearch === '' ||
      l.message.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.unit.toLowerCase().includes(logSearch.toLowerCase());
    return matchesLevel && matchesText;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-white transition-colors group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          <span>Fleet Overview</span>
        </Link>
      </div>

      {/* Active Maintenance Mode Banner */}
      {activeSilence && (
        <div className="p-4 rounded-2xl bg-warning/10 border border-warning/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-glow-warning">
          <div className="flex items-center gap-3">
            <Sliders className="text-warning flex-shrink-0" size={20} />
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Maintenance Mode Active</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-warning/20 text-warning border border-warning/40">
                  Until {new Date(activeSilence.ends_at).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-xs text-muted mt-0.5">{activeSilence.reason}</div>
            </div>
          </div>
          <button
            onClick={() => handleEndSilence(activeSilence.id)}
            className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-warning/20 hover:bg-warning/30 border border-warning/40 text-warning text-xs font-semibold transition-colors"
          >
            End Silence
          </button>
        </div>
      )}

      {/* Hero Server Information Header */}
      <div className="glass-card rounded-2xl p-6 border border-border">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary-light flex-shrink-0">
              <ServerIcon size={24} />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {server.name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border ${
                    server.status === 'ONLINE'
                      ? 'bg-healthy/15 text-healthy border-healthy/30'
                      : server.status === 'SUSPECT'
                      ? 'bg-warning/15 text-warning border-warning/30'
                      : 'bg-critical/15 text-critical border-critical/30'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {server.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted">
                <span>{server.hostname}</span>
                <span>•</span>
                <span>{server.platform}</span>
                <span>•</span>
                <button
                  onClick={copyServerId}
                  className="flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <span>ID: {server.id.substring(0, 8)}...</span>
                  {copied ? <Check size={12} className="text-healthy" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions & Maintenance Toggle */}
          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
            <button
              onClick={() => setMaintenanceOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-surface border border-border hover:border-warning/50 text-muted hover:text-warning text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Schedule planned maintenance window"
            >
              <Sliders size={13} />
              <span>Silence Alerts</span>
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-3.5 py-2 rounded-xl bg-critical/10 border border-critical/30 hover:bg-critical/20 text-critical text-xs font-mono flex items-center gap-1.5 transition-colors"
              title="Decommission this server node"
            >
              <Trash2 size={13} />
              <span>Decommission</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          onClick={() => setActiveViewTab('metrics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeViewTab === 'metrics'
              ? 'bg-primary text-white shadow-glow-primary'
              : 'text-muted hover:text-white hover:bg-surface'
          }`}
        >
          <Activity size={14} />
          <span>Telemetry & Metrics</span>
        </button>

        <button
          onClick={() => setActiveViewTab('processes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeViewTab === 'processes'
              ? 'bg-primary text-white shadow-glow-primary'
              : 'text-muted hover:text-white hover:bg-surface'
          }`}
        >
          <Cpu size={14} />
          <span>Top Processes</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/20">
            {processesData?.count ?? 7}
          </span>
        </button>

        <button
          onClick={() => setActiveViewTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeViewTab === 'logs'
              ? 'bg-primary text-white shadow-glow-primary'
              : 'text-muted hover:text-white hover:bg-surface'
          }`}
        >
          <Terminal size={14} />
          <span>System Logs</span>
        </button>
      </div>

      {/* TAB 1: Metrics Charts */}
      {activeViewTab === 'metrics' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 3 Live Metric Gauges Bento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CPU Box */}
            <div
              onClick={() => setMetric('cpu')}
              className={`glass-card-interactive rounded-2xl p-5 cursor-pointer relative overflow-hidden ${
                metric === 'cpu' ? 'border-primary shadow-glow-primary bg-primary/5' : ''
              }`}
            >
              <div className="flex justify-between items-center text-xs text-muted">
                <span className="font-mono uppercase font-semibold flex items-center gap-1.5">
                  <Cpu size={14} className="text-primary-light" /> CPU Utilization
                </span>
                <span className="text-xs font-mono font-bold text-primary-light">
                  {server.cpu?.toFixed(1) ?? '—'}%
                </span>
              </div>
              <div className="mt-3">
                <div className="h-2 bg-surface-highlight rounded-full overflow-hidden p-0.5 border border-border">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, server.cpu || 0))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Memory Box */}
            <div
              onClick={() => setMetric('memory')}
              className={`glass-card-interactive rounded-2xl p-5 cursor-pointer relative overflow-hidden ${
                metric === 'memory' ? 'border-warning shadow-glow-warning bg-warning/5' : ''
              }`}
            >
              <div className="flex justify-between items-center text-xs text-muted">
                <span className="font-mono uppercase font-semibold flex items-center gap-1.5">
                  <CircuitBoard size={14} className="text-warning" /> Memory Pressure
                </span>
                <span className="text-xs font-mono font-bold text-warning">
                  {server.memory?.toFixed(1) ?? '—'}%
                </span>
              </div>
              <div className="mt-3">
                <div className="h-2 bg-surface-highlight rounded-full overflow-hidden p-0.5 border border-border">
                  <div
                    className="h-full bg-warning rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, server.memory || 0))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Disk Box */}
            <div
              onClick={() => setMetric('disk')}
              className={`glass-card-interactive rounded-2xl p-5 cursor-pointer relative overflow-hidden ${
                metric === 'disk' ? 'border-cyan-500 shadow-sm bg-cyan-500/5' : ''
              }`}
            >
              <div className="flex justify-between items-center text-xs text-muted">
                <span className="font-mono uppercase font-semibold flex items-center gap-1.5">
                  <HardDrive size={14} className="text-cyan-400" /> Storage Capacity
                </span>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {server.disk?.toFixed(1) ?? '—'}%
                </span>
              </div>
              <div className="mt-3">
                <div className="h-2 bg-surface-highlight rounded-full overflow-hidden p-0.5 border border-border">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, server.disk || 0))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Time Series Recharts Card */}
          <div className="glass-card rounded-2xl p-6 border border-border space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <activeMetricConfig.icon size={18} style={{ color: activeMetricConfig.color }} />
                  <span>{activeMetricConfig.label}</span>
                </h2>
                <p className="text-xs text-muted">
                  High-frequency time-series telemetry sampled directly from host kernel.
                </p>
              </div>

              {/* Time Range Selector */}
              <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border self-start sm:self-auto">
                {ranges.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRange(r.key)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                      range === r.key
                        ? 'bg-surface-highlight text-white border border-border-strong shadow-sm'
                        : 'text-muted hover:text-white'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart Canvas */}
            <div className="h-80 w-full">
              {metricsLoading ? (
                <div className="h-full flex items-center justify-center text-muted gap-2 text-xs font-mono">
                  <Activity size={16} className="animate-spin text-primary-light" />
                  <span>Fetching time-series stream...</span>
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted text-xs font-mono">
                  No historical points in the selected range.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={activeMetricConfig.color} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={activeMetricConfig.color} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="time"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(unix) =>
                        new Date(unix).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      }
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={activeMetricConfig.color}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#metricGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Top Host Processes */}
      {activeViewTab === 'processes' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 glass-card p-3 rounded-2xl border border-border">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search processes by PID, name, or user..."
                value={processSearch}
                onChange={(e) => setProcessSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-xs text-white placeholder-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <button
              onClick={() => refetchProcesses()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface border border-border text-xs text-muted hover:text-white transition-colors"
            >
              <RefreshCw size={13} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="glass-card rounded-2xl border border-border overflow-hidden">
            {processesLoading ? (
              <div className="p-12 text-center text-xs text-muted">Sampling host processes via /proc...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface border-b border-border text-muted font-mono uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-5 py-3">PID</th>
                      <th className="px-5 py-3">Process Command</th>
                      <th className="px-5 py-3">User</th>
                      <th className="px-5 py-3">CPU %</th>
                      <th className="px-5 py-3">Memory RSS</th>
                      <th className="px-5 py-3">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono">
                    {filteredProcesses?.map((p) => (
                      <tr key={p.pid} className="hover:bg-surface/50 transition-colors">
                        <td className="px-5 py-3.5 text-primary-light font-bold">{p.pid}</td>
                        <td className="px-5 py-3.5 text-white font-medium">{p.name}</td>
                        <td className="px-5 py-3.5 text-muted">{p.user}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`font-semibold ${
                              p.cpu > 25
                                ? 'text-critical'
                                : p.cpu > 10
                                ? 'text-warning'
                                : 'text-white/90'
                            }`}
                          >
                            {p.cpu.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted">{p.memory_rss}</td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-surface border border-border text-healthy">
                            {p.state}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: System Logs Terminal */}
      {activeViewTab === 'logs' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 glass-card p-3 rounded-2xl border border-border">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Filter syslog & journald stream..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-xs text-white placeholder-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={logLevelFilter}
                onChange={(e) => setLogLevelFilter(e.target.value)}
                className="bg-background border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
              >
                <option value="ALL">All Severities</option>
                <option value="INFO">INFO only</option>
                <option value="WARN">WARN only</option>
                <option value="ERROR">ERROR only</option>
              </select>

              <button
                onClick={() => refetchLogs()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface border border-border text-xs text-muted hover:text-white transition-colors"
              >
                <RefreshCw size={13} />
                <span>Fetch Latest</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black border border-border font-mono text-xs space-y-2 h-96 overflow-y-auto shadow-2xl">
            {logsLoading ? (
              <div className="text-muted p-8 text-center">Connecting to host journald stream...</div>
            ) : filteredLogs?.length === 0 ? (
              <div className="text-muted p-8 text-center">No log messages matched filter.</div>
            ) : (
              filteredLogs?.map((l, idx) => (
                <div key={idx} className="flex items-start gap-3 hover:bg-white/5 py-1 px-1.5 rounded transition-colors">
                  <span className="text-muted/60 text-[11px] whitespace-nowrap">
                    {new Date(l.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                      l.level === 'ERROR'
                        ? 'bg-critical/20 text-critical'
                        : l.level === 'WARN'
                        ? 'bg-warning/20 text-warning'
                        : 'bg-primary/20 text-primary-light'
                    }`}
                  >
                    {l.level}
                  </span>
                  <span className="text-primary-light text-[11px] font-bold whitespace-nowrap">
                    [{l.unit}]
                  </span>
                  <span className="text-white/90 flex-1">{l.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Maintenance Scheduling Modal */}
      <MaintenanceModal
        isOpen={maintenanceOpen}
        onClose={() => setMaintenanceOpen(false)}
        serverId={server.id}
        serverName={server.name}
      />

      {/* Decommission Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-critical">
              <AlertCircle size={24} />
              <h3 className="font-bold text-white text-base">Decommission Node?</h3>
            </div>
            <p className="text-xs text-muted">
              This will remove <strong className="text-white">{server.name}</strong> from the fleet overview and purge its active status.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl bg-surface border border-border text-xs text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteServer}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-critical hover:bg-critical/80 text-xs font-semibold text-white transition-colors"
              >
                {deleting ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
