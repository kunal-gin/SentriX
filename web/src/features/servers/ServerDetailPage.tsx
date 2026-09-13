import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
  ShieldCheck,
  Terminal,
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

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const timeStr = new Date(label).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const dateStr = new Date(label).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
    const value = payload[0].value;

    return (
      <div className="glass-card px-3.5 py-2.5 rounded-xl border border-border shadow-2xl text-xs space-y-1">
        <div className="text-[11px] font-mono text-muted">
          {dateStr} • {timeStr}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: payload[0].color }}
          />
          <span className="font-bold text-white text-sm font-mono">
            {value.toFixed(1)}%
          </span>
        </div>
      </div>
    );
  }
  return null;
}

export function ServerDetailPage() {
  const { serverId } = useParams<{ serverId: string }>();
  const [metric, setMetric] = useState('cpu');
  const [range, setRange] = useState('1h');
  const [copied, setCopied] = useState(false);

  const { data: servers, isLoading: serversLoading } = useServers();
  const { data: metrics, isLoading: metricsLoading } = useServerMetrics(
    serverId,
    metric,
    range
  );

  const server = servers?.find((s) => s.id === serverId);

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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold shadow-glow-primary hover:bg-primary-hover transition-colors"
          >
            <ArrowLeft size={14} /> Back to Fleet Overview
          </Link>
        </div>
      </div>
    );
  }

  const activeMetricConfig = metricTabs.find((m) => m.key === metric) || metricTabs[0];

  const chartData =
    metrics?.points.map((point) => ({
      time: new Date(point.time).getTime(),
      value: Number(point.value),
    })) ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Top Breadcrumbs & Quick Back */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-white transition-colors group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Fleet Overview</span>
        </Link>

        <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
          <span className="w-2 h-2 rounded-full bg-healthy animate-pulse-glow" />
          <span>Streaming Telemetry Engine</span>
        </div>
      </div>

      {/* Hero Server Spec Banner */}
      <div className="glass-card rounded-2xl p-6 relative overflow-hidden shadow-glass border border-border">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-surface-highlight to-surface flex items-center justify-center text-primary-light border border-border shadow-inner">
              <ServerIcon size={24} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">{server.name}</h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                    server.status === 'ONLINE'
                      ? 'bg-healthy/15 text-healthy border-healthy/30 shadow-glow-healthy'
                      : server.status === 'SUSPECT'
                      ? 'bg-warning/15 text-warning border-warning/30 shadow-glow-warning'
                      : 'bg-critical/15 text-critical border-critical/30'
                  }`}
                >
                  {server.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted font-mono">
                <span className="text-white">{server.hostname}</span>
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

          {/* Quick Specs Badges */}
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <div className="px-3 py-2 rounded-xl bg-background/60 border border-border space-y-0.5">
              <span className="text-[10px] uppercase text-text-dim block">Arch</span>
              <span className="text-white font-semibold">x86_64</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-background/60 border border-border space-y-0.5">
              <span className="text-[10px] uppercase text-text-dim block">Agent</span>
              <span className="text-primary-light font-semibold">v0.6.0-c</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-background/60 border border-border space-y-0.5">
              <span className="text-[10px] uppercase text-text-dim block">Heartbeat</span>
              <span className="text-healthy font-semibold flex items-center gap-1">
                <Clock size={11} /> 5s Live
              </span>
            </div>
          </div>
        </div>
      </div>

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
                className="h-full rounded-full bg-gradient-to-r from-primary to-cyan transition-all duration-500"
                style={{ width: `${Math.min(server.cpu ?? 0, 100)}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted mt-2 font-mono">Real-time delta computation from /proc/stat</p>
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
              <CircuitBoard size={14} className="text-warning" /> Memory Load
            </span>
            <span className="text-xs font-mono font-bold text-warning">
              {server.memory?.toFixed(1) ?? '—'}%
            </span>
          </div>
          <div className="mt-3">
            <div className="h-2 bg-surface-highlight rounded-full overflow-hidden p-0.5 border border-border">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                style={{ width: `${Math.min(server.memory ?? 0, 100)}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted mt-2 font-mono">Dynamic cache & available ram calculation</p>
        </div>

        {/* Disk Box */}
        <div
          onClick={() => setMetric('disk')}
          className={`glass-card-interactive rounded-2xl p-5 cursor-pointer relative overflow-hidden ${
            metric === 'disk' ? 'border-cyan shadow-glow-cyan bg-cyan/5' : ''
          }`}
        >
          <div className="flex justify-between items-center text-xs text-muted">
            <span className="font-mono uppercase font-semibold flex items-center gap-1.5">
              <HardDrive size={14} className="text-cyan" /> Root Volume
            </span>
            <span className="text-xs font-mono font-bold text-cyan">
              {server.disk?.toFixed(1) ?? '—'}%
            </span>
          </div>
          <div className="mt-3">
            <div className="h-2 bg-surface-highlight rounded-full overflow-hidden p-0.5 border border-border">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan to-teal-400 transition-all duration-500"
                style={{ width: `${Math.min(server.disk ?? 0, 100)}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted mt-2 font-mono">Mount point "/" filesystem block usage</p>
        </div>
      </div>

      {/* Main Telemetry Chart Section */}
      <div className="glass-card rounded-2xl p-6 border border-border shadow-glass space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-background/80 p-1 rounded-xl border border-border">
            {metricTabs.map((tab) => {
              const isActive = metric === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setMetric(tab.key)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-glow-primary'
                      : 'text-muted hover:text-white hover:bg-surface'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-background/80 p-1 rounded-xl border border-border">
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
  );
}
