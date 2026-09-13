import { FormEvent, useState } from 'react';
import { useDashboards, useCreateDashboard, Dashboard, DashboardWidget } from '../../hooks/useDashboards';
import {
  LayoutDashboard,
  Plus,
  Activity,
  AlertTriangle,
  FileText,
  Clock,
  Sparkles,
  Layers,
  BarChart2,
  Trash2,
  TrendingUp,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

// Synthetic sample points for dashboard charts
const sampleCpuData = [
  { time: '10:00', value: 34 },
  { time: '10:10', value: 38 },
  { time: '10:20', value: 42 },
  { time: '10:30', value: 78 },
  { time: '10:40', value: 85 },
  { time: '10:50', value: 52 },
  { time: '11:00', value: 36 },
];

const sampleDiskData = [
  { time: '10:00', value: 72 },
  { time: '10:10', value: 73 },
  { time: '10:20', value: 74 },
  { time: '10:30', value: 76 },
  { time: '10:40', value: 81 },
  { time: '10:50', value: 82 },
  { time: '11:00', value: 82 },
];

export function DashboardsPage() {
  const { data: dashboards, isLoading } = useDashboards();
  const createDashboard = useCreateDashboard();

  const [activeDashboardId, setActiveDashboardId] = useState<string>('dash-primary');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddWidgetModal, setShowAddWidgetModal] = useState(false);

  const [dashTitle, setDashTitle] = useState('');
  const [dashDescription, setDashDescription] = useState('');

  // Add widget form
  const [widgetTitle, setWidgetTitle] = useState('');
  const [widgetType, setWidgetType] = useState<DashboardWidget['type']>('METRIC_LINE');
  const [widgetMetric, setWidgetMetric] = useState('system.cpu.utilization');
  const [widgetColSpan, setWidgetColSpan] = useState(2);

  const activeDashboard =
    (dashboards || []).find((d) => d.id === activeDashboardId) ||
    (dashboards && dashboards[0]);

  async function handleCreateDashboard(e: FormEvent) {
    e.preventDefault();
    await createDashboard.mutateAsync({
      title: dashTitle,
      description: dashDescription,
      is_default: false,
      widgets: [
        {
          id: 'w-' + Date.now(),
          type: 'METRIC_LINE',
          title: 'Fleet CPU Saturation',
          metric: 'system.cpu.utilization',
          col_span: 2,
        },
      ],
    });
    setDashTitle('');
    setDashDescription('');
    setShowCreateModal(false);
  }

  function handleAddWidget(e: FormEvent) {
    e.preventDefault();
    if (!activeDashboard) return;
    activeDashboard.widgets.push({
      id: 'w-' + Date.now(),
      type: widgetType,
      title: widgetTitle || 'Custom Widget',
      metric: widgetMetric,
      col_span: widgetColSpan,
    });
    setWidgetTitle('');
    setShowAddWidgetModal(false);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header & Dashboard Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Observability Workspaces
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary/20 text-primary-light border border-primary/30">
              Custom Dashboards
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Customizable operational dashboards, multi-metric widgets, and unified monitoring canvases.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={activeDashboard?.id || ''}
            onChange={(e) => setActiveDashboardId(e.target.value)}
            className="bg-surface border border-border focus:border-primary rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none"
          >
            {(dashboards || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowAddWidgetModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface hover:bg-surface-elevated text-xs font-semibold text-text border border-border transition-colors"
          >
            <Plus size={14} className="text-primary-light" />
            <span>Add Widget</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary transition-all"
          >
            <Plus size={14} />
            <span>New Dashboard</span>
          </button>
        </div>
      </div>

      {/* Active Dashboard Meta Banner */}
      {activeDashboard && (
        <div className="glass-card rounded-2xl p-4 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div>
            <span className="text-white font-bold text-sm">{activeDashboard.title}</span>
            <p className="text-muted text-[11px] mt-0.5">{activeDashboard.description}</p>
          </div>
          <div className="flex items-center gap-2 text-text-dim text-[11px]">
            <span>{activeDashboard.widgets.length} Widgets Active</span>
            <span>•</span>
            <span>Auto-refresh: 10s</span>
          </div>
        </div>
      )}

      {/* Dynamic Widget Grid */}
      {activeDashboard && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {activeDashboard.widgets.map((widget) => {
            const isSpan2 = widget.col_span === 2;
            const isSpan3 = widget.col_span === 3;

            return (
              <div
                key={widget.id}
                className={`glass-card rounded-2xl p-5 border border-border flex flex-col justify-between space-y-4 ${
                  isSpan3
                    ? 'md:col-span-3'
                    : isSpan2
                    ? 'md:col-span-2'
                    : 'md:col-span-1'
                }`}
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    {widget.type === 'METRIC_LINE' && <Activity size={14} className="text-primary-light" />}
                    {widget.type === 'METRIC_GAUGE' && <TrendingUp size={14} className="text-warning" />}
                    {widget.type === 'LOG_STREAM' && <FileText size={14} className="text-cyan" />}
                    {widget.type === 'ALERT_LIST' && <AlertTriangle size={14} className="text-critical" />}
                    <span>{widget.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted uppercase">{widget.type}</span>
                </div>

                {/* Widget Body Content */}
                <div className="py-2">
                  {widget.type === 'METRIC_LINE' && (
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={widget.metric?.includes('disk') ? sampleDiskData : sampleCpuData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#262b35" vertical={false} />
                          <XAxis dataKey="time" stroke="#717a8c" tick={{ fontSize: 10 }} />
                          <YAxis stroke="#717a8c" tick={{ fontSize: 10 }} domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#161920',
                              borderColor: '#303642',
                              borderRadius: '8px',
                              fontSize: '11px',
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            dot={{ fill: '#6366f1', r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {widget.type === 'METRIC_GAUGE' && (
                    <div className="space-y-4 py-4 text-center">
                      <div className="text-4xl font-extrabold font-mono text-warning">89.1%</div>
                      <div className="w-full bg-surface-highlight rounded-full h-3 overflow-hidden max-w-xs mx-auto">
                        <div className="h-full rounded-full bg-warning transition-all" style={{ width: '89.1%' }} />
                      </div>
                      <p className="text-[11px] font-mono text-muted">Allocated buffer cache: 14.2 GB / 16.0 GB</p>
                    </div>
                  )}

                  {widget.type === 'LOG_STREAM' && (
                    <div className="p-3 rounded-xl bg-background/80 border border-border font-mono text-xs space-y-2 max-h-56 overflow-y-auto">
                      <div className="text-critical truncate">[ERROR] 21:26:12 timescale-db: pool buffer exceeded 96%</div>
                      <div className="text-warning truncate">[WARN]  21:25:40 payments: settlement retry 2/3 (latency 840ms)</div>
                      <div className="text-text-dim truncate">[INFO]  21:24:18 auth-gateway: session token renewed</div>
                      <div className="text-critical truncate">[ERROR] 21:22:04 edge-ingress: TLS protocol handshake error</div>
                    </div>
                  )}

                  {widget.type === 'ALERT_LIST' && (
                    <div className="space-y-2 font-mono text-xs">
                      <div className="p-2.5 rounded-lg bg-critical/10 border border-critical/30 flex items-center justify-between">
                        <span className="text-critical font-bold truncate">High Memory Utilization</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-critical text-white">FIRING</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-warning/10 border border-warning/30 flex items-center justify-between">
                        <span className="text-warning font-bold truncate">Elevated Gateway Latency</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning text-black">ACK</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-border/40 text-[10px] font-mono text-muted text-right">
                  Real-time telemetry sample
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Dashboard Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-card rounded-2xl p-6 border border-primary/40 shadow-glow-primary max-w-md w-full space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <LayoutDashboard size={16} className="text-primary-light" />
              <span>Create Observability Workspace</span>
            </h2>

            <form onSubmit={handleCreateDashboard} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-muted mb-1">Dashboard Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Edge Ingress & Network Gateway"
                  value={dashTitle}
                  onChange={(e) => setDashTitle(e.target.value)}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Focus areas, microservice groups, and key metrics..."
                  value={dashDescription}
                  onChange={(e) => setDashDescription(e.target.value)}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDashboard.isPending}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary"
                >
                  Create Dashboard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Widget Modal */}
      {showAddWidgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-card rounded-2xl p-6 border border-primary/40 shadow-glow-primary max-w-md w-full space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Plus size={16} className="text-primary-light" />
              <span>Add Visualization Widget</span>
            </h2>

            <form onSubmit={handleAddWidget} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-muted mb-1">Widget Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cluster Ingress Throughput"
                  value={widgetTitle}
                  onChange={(e) => setWidgetTitle(e.target.value)}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-muted mb-1">Widget Type</label>
                  <select
                    value={widgetType}
                    onChange={(e) => setWidgetType(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  >
                    <option value="METRIC_LINE">Metric Line Chart</option>
                    <option value="METRIC_GAUGE">Radial/Bar Gauge</option>
                    <option value="LOG_STREAM">Live Log Stream</option>
                    <option value="ALERT_LIST">Active Incidents</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-muted mb-1">Grid Column Span</label>
                  <select
                    value={widgetColSpan}
                    onChange={(e) => setWidgetColSpan(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  >
                    <option value={1}>1 Column</option>
                    <option value={2}>2 Columns (Wide)</option>
                    <option value={3}>3 Columns (Full Width)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Telemetry Stream</label>
                <select
                  value={widgetMetric}
                  onChange={(e) => setWidgetMetric(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                >
                  <option value="system.cpu.utilization">system.cpu.utilization</option>
                  <option value="system.memory.utilization">system.memory.utilization</option>
                  <option value="system.disk.utilization">system.disk.utilization</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddWidgetModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary"
                >
                  Add to Dashboard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
