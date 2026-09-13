import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { fetchJSON } from '../../lib/api';
import {
  Activity,
  Cpu,
  CircuitBoard,
  HardDrive,
  Wifi,
  RefreshCw,
  Server,
  Layers,
  Filter,
  BarChart3,
  TrendingUp,
} from 'lucide-react';

interface MetricPoint {
  time: string;
  value: number;
}

interface ServerSeries {
  server_id: string;
  server_name: string;
  status: string;
  points: MetricPoint[];
}

interface MetricsQueryResponse {
  metric: string;
  range: string;
  series: ServerSeries[];
}

const metricsList = [
  { key: 'cpu', label: 'CPU Utilization', icon: Cpu, unit: '%' },
  { key: 'memory', label: 'Memory Pressure', icon: CircuitBoard, unit: '%' },
  { key: 'disk', label: 'Storage I/O & Disk', icon: HardDrive, unit: '%' },
  { key: 'network', label: 'Network Throughput', icon: Wifi, unit: '%' },
];

const rangesList = [
  { key: '15m', label: '15m' },
  { key: '1h', label: '1h' },
  { key: '6h', label: '6h' },
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
];

const serverColors = ['#6366f1', '#f59e0b', '#06b6d4', '#10b981', '#ec4899', '#8b5cf6'];

export function MetricsExplorerPage() {
  const [selectedMetric, setSelectedMetric] = useState('cpu');
  const [selectedRange, setSelectedRange] = useState('1h');
  const [aggregation, setAggregation] = useState<'avg' | 'max' | 'min'>('avg');

  const { data: queryData, isLoading, refetch, isFetching } = useQuery<MetricsQueryResponse>({
    queryKey: ['metrics-query', selectedMetric, selectedRange],
    queryFn: () =>
      fetchJSON<MetricsQueryResponse>(
        `/metrics/query?metric=${selectedMetric}&range=${selectedRange}`
      ),
    refetchInterval: 10000,
  });

  const activeMetricObj = metricsList.find((m) => m.key === selectedMetric) || metricsList[0];

  // Re-shape series points into single timestamp-indexed dataset for multi-line Recharts
  const seriesMap: Record<number, any> = {};
  queryData?.series?.forEach((s) => {
    s.points?.forEach((p) => {
      const unix = new Date(p.time).getTime();
      if (!seriesMap[unix]) {
        seriesMap[unix] = { time: unix };
      }
      seriesMap[unix][s.server_name] = p.value;
    });
  });

  const chartData = Object.values(seriesMap).sort((a, b) => a.time - b.time);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Metrics Explorer</span>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary/20 text-primary-light border border-primary/30">
              Fleet Cross-Analysis
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Compare real-time and historical multi-node metrics across the distributed infrastructure fleet.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border hover:border-border-strong text-xs text-muted hover:text-white transition-all shadow-sm group"
        >
          <RefreshCw
            size={13}
            className={isFetching ? 'animate-spin text-primary' : 'group-hover:rotate-180 transition-transform duration-500'}
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* Control Bar: Metric Selector & Time Range */}
      <div className="glass-card p-4 rounded-2xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Metric Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {metricsList.map((m) => {
            const Icon = m.icon;
            const isSelected = selectedMetric === m.key;

            return (
              <button
                key={m.key}
                onClick={() => setSelectedMetric(m.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-primary text-white shadow-glow-primary'
                    : 'bg-surface border border-border text-muted hover:text-white'
                }`}
              >
                <Icon size={14} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Time Ranges & Aggregation */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border">
            {rangesList.map((r) => (
              <button
                key={r.key}
                onClick={() => setSelectedRange(r.key)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                  selectedRange === r.key
                    ? 'bg-surface-highlight text-white border border-border-strong shadow-sm'
                    : 'text-muted hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Multi-Node Comparison Chart Canvas */}
      <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <activeMetricObj.icon size={16} className="text-primary-light" />
            <span>
              {activeMetricObj.label} across All Server Nodes ({selectedRange} Window)
            </span>
          </div>
          <span className="text-xs font-mono text-muted">Unit: {activeMetricObj.unit}</span>
        </div>

        <div className="h-96 w-full">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-muted gap-2 text-xs font-mono">
              <Activity size={16} className="animate-spin text-primary-light" />
              <span>Fetching fleet metrics telemetry...</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted text-xs font-mono">
              No points available for the selected range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
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
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161922',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                  labelFormatter={(unix) => new Date(Number(unix)).toLocaleTimeString()}
                />
                <Legend
                  wrapperStyle={{
                    paddingTop: '12px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                />
                {queryData?.series?.map((s, idx) => (
                  <Line
                    key={s.server_id}
                    type="monotone"
                    dataKey={s.server_name}
                    stroke={serverColors[idx % serverColors.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Fleet Breakdown Statistics Table */}
      <div className="glass-card rounded-2xl border border-border overflow-hidden space-y-2 p-5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <BarChart3 size={15} className="text-primary-light" />
          <span>Fleet Performance Rollup ({activeMetricObj.label})</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface border-b border-border text-muted font-mono uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-2.5">Node Name</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Current</th>
                <th className="px-4 py-2.5">Minimum</th>
                <th className="px-4 py-2.5">Average</th>
                <th className="px-4 py-2.5">Peak (Max)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {queryData?.series?.map((s, idx) => {
                const vals = s.points?.map((p) => p.value) || [];
                const current = vals[vals.length - 1] ?? 0;
                const min = vals.length ? Math.min(...vals) : 0;
                const max = vals.length ? Math.max(...vals) : 0;
                const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

                return (
                  <tr key={s.server_id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: serverColors[idx % serverColors.length] }}
                      />
                      <span>{s.server_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          s.status === 'ONLINE'
                            ? 'bg-healthy/15 text-healthy border-healthy/30'
                            : 'bg-warning/15 text-warning border-warning/30'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-white">{current.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-muted">{min.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-primary-light">{avg.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-warning font-bold">{max.toFixed(1)}%</td>
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
