import { FormEvent, useState } from 'react';
import {
  CreateAlertRuleInput,
  useAlertRules,
  useCreateAlertRule,
  useDeleteAlertRule,
  useSimulateAlertRule,
  SimulationResult,
} from '../../hooks/useAlerts';
import {
  BellRing,
  Plus,
  Trash2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Sliders,
  Cpu,
  CircuitBoard,
  HardDrive,
  Activity,
  PlayCircle,
  Zap,
  ShieldAlert,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Info,
} from 'lucide-react';
import { Badge } from '../../components/ui/Primitives';

const defaultForm: CreateAlertRuleInput = {
  name: 'High CPU Saturation & Throttling',
  metric: 'system.cpu.utilization',
  rule_type: 'THRESHOLD',
  operator: '>',
  threshold: 85,
  resolve_threshold: 75,
  window_seconds: 60,
  for_seconds: 300,
  severity: 'CRITICAL',
  enabled: true,
  cooldown_seconds: 600,
};

const metricsCatalog = [
  { key: 'system.cpu.utilization', label: 'CPU Utilization', icon: Cpu, unit: '%' },
  { key: 'system.memory.utilization', label: 'Memory Pressure', icon: CircuitBoard, unit: '%' },
  { key: 'system.disk.utilization', label: 'Root Partition IO/Storage', icon: HardDrive, unit: '%' },
  { key: 'network.egress.throughput', label: 'Network Egress Latency', icon: Activity, unit: 'MB/s' },
];

const ruleTypesCatalog = [
  { key: 'THRESHOLD', label: 'Threshold (Static boundary)' },
  { key: 'RATE', label: 'Rate of Change (Derivative)' },
  { key: 'PERCENTAGE', label: 'Percentage Ratio' },
  { key: 'COMPOSITE', label: 'Composite (Multi-condition)' },
  { key: 'ANOMALY', label: 'Statistical Anomaly (Z-score)' },
];

export function AlertRulesPage() {
  const { data: rules, isLoading } = useAlertRules();
  const createRule = useCreateAlertRule();
  const deleteRule = useDeleteAlertRule();
  const simulateRule = useSimulateAlertRule();

  const [form, setForm] = useState<CreateAlertRuleInput>(defaultForm);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await createRule.mutateAsync(form);
    setForm(defaultForm);
    setShowCreateModal(false);
    setSimulationResult(null);
  }

  async function handleRunSimulation() {
    const res = await simulateRule.mutateAsync({
      metric: form.metric,
      operator: form.operator,
      threshold: form.threshold,
      resolve_threshold: form.resolve_threshold,
      window_seconds: form.window_seconds,
      for_seconds: form.for_seconds,
      cooldown_seconds: form.cooldown_seconds,
      period: '24h',
    });
    setSimulationResult(res);
  }

  async function handleDelete(ruleId: string) {
    if (confirm('Are you sure you want to delete this alert rule?')) {
      await deleteRule.mutateAsync(ruleId);
    }
  }

  const filteredRules = (rules || []).filter((r) => {
    if (filterType === 'CRITICAL') return r.severity === 'CRITICAL';
    if (filterType === 'FIRING') return r.state === 'FIRING';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Alert Engine 2.0
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary/20 text-primary-light border border-primary/30">
              {rules?.length ?? 0} Active Rules
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Production stateful alert lifecycle with hysteresis, deduplicated fingerprints, and 24h noise reduction simulation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowCreateModal(true);
              handleRunSimulation();
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface hover:bg-surface-elevated text-text text-xs font-semibold border border-border transition-all"
          >
            <Sparkles size={14} className="text-primary-light" />
            <span>Simulate Rule</span>
          </button>
          <button
            onClick={() => setShowCreateModal(!showCreateModal)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary transition-all"
          >
            <Plus size={15} />
            <span>Create Alert Rule</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3 text-xs font-mono">
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filterType === 'ALL' ? 'bg-primary text-white' : 'text-muted hover:text-white'
          }`}
        >
          ALL RULES ({rules?.length ?? 0})
        </button>
        <button
          onClick={() => setFilterType('FIRING')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filterType === 'FIRING' ? 'bg-critical/20 text-critical border border-critical/30' : 'text-muted hover:text-white'
          }`}
        >
          FIRING NOW ({(rules || []).filter((r) => r.state === 'FIRING').length})
        </button>
        <button
          onClick={() => setFilterType('CRITICAL')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filterType === 'CRITICAL' ? 'bg-primary text-white' : 'text-muted hover:text-white'
          }`}
        >
          CRITICAL TIER
        </button>
      </div>

      {/* Inline Create & Simulate Rule Panel */}
      {showCreateModal && (
        <div className="glass-card rounded-2xl p-6 border border-primary/40 shadow-glow-primary space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Sliders size={16} className="text-primary-light" />
              <span>Configure Alert Rule & Noise Reduction Model</span>
            </h2>
            <button
              onClick={() => {
                setShowCreateModal(false);
                setSimulationResult(null);
              }}
              className="text-xs text-muted hover:text-white"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-mono text-muted mb-1">Rule Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Rule Engine Type</label>
                <select
                  value={form.rule_type || 'THRESHOLD'}
                  onChange={(e) => setForm({ ...form, rule_type: e.target.value })}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {ruleTypesCatalog.map((rt) => (
                    <option key={rt.key} value={rt.key}>
                      {rt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Telemetry Metric</label>
                <select
                  value={form.metric}
                  onChange={(e) => setForm({ ...form, metric: e.target.value })}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {metricsCatalog.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Severity Tier</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="WARNING">WARNING</option>
                  <option value="INFO">INFO</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Trigger Threshold (%)</label>
                <input
                  type="number"
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  required
                  min={1}
                  max={100}
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">
                  Hysteresis Resolve Threshold (%)
                </label>
                <input
                  type="number"
                  value={form.resolve_threshold ?? 75}
                  onChange={(e) => setForm({ ...form, resolve_threshold: Number(e.target.value) })}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  required
                  min={1}
                  max={100}
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Duration "For" (Seconds)</label>
                <input
                  type="number"
                  value={form.for_seconds}
                  onChange={(e) => setForm({ ...form, for_seconds: Number(e.target.value) })}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  required
                  min={10}
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Cooldown Duration (Seconds)</label>
                <input
                  type="number"
                  value={form.cooldown_seconds}
                  onChange={(e) => setForm({ ...form, cooldown_seconds: Number(e.target.value) })}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  required
                  min={60}
                />
              </div>
            </div>

            {/* Live Historical Simulation Box */}
            <div className="p-4 rounded-xl bg-surface/60 border border-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <PlayCircle size={16} className="text-primary-light" />
                  <span className="text-xs font-semibold text-white">
                    24h Historical Telemetry Simulation
                  </span>
                  <span className="text-[10px] font-mono text-muted">
                    (Validates against fleet spikes to measure false-positive noise)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRunSimulation}
                  disabled={simulateRule.isPending}
                  className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-highlight border border-border text-xs font-mono text-primary-light hover:text-white transition-colors"
                >
                  {simulateRule.isPending ? 'Simulating...' : 'Run Simulation'}
                </button>
              </div>

              {simulationResult && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/50 text-center animate-in fade-in duration-150">
                  <div className="p-2.5 rounded-lg bg-background/50 border border-border/70">
                    <div className="text-[10px] font-mono text-muted uppercase">Evaluated Period</div>
                    <div className="text-sm font-bold text-white font-mono mt-0.5">
                      {simulationResult.period} ({simulationResult.evaluated_samples} pts)
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-background/50 border border-border/70">
                    <div className="text-[10px] font-mono text-muted uppercase">Raw Threshold Crosses</div>
                    <div className="text-sm font-bold text-warning font-mono mt-0.5">
                      {simulationResult.would_fire_times} times
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-background/50 border border-border/70">
                    <div className="text-[10px] font-mono text-muted uppercase">Incidents Generated</div>
                    <div className="text-sm font-bold text-critical font-mono mt-0.5">
                      {simulationResult.would_create_incidents} incidents
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-healthy/10 border border-healthy/30">
                    <div className="text-[10px] font-mono text-healthy uppercase flex items-center justify-center gap-1">
                      <TrendingDown size={11} /> Noise Reduction
                    </div>
                    <div className="text-sm font-bold text-healthy font-mono mt-0.5">
                      {simulationResult.noise_reduction_percent}% saved
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Bar */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createRule.isPending}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary transition-all"
              >
                {createRule.isPending ? 'Deploying...' : 'Deploy Alert Rule 2.0'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading && (
          <div className="col-span-full py-16 text-center text-muted font-mono text-xs">
            Loading active rules...
          </div>
        )}

        {!isLoading && filteredRules.length === 0 && (
          <div className="col-span-full py-16 text-center space-y-2 glass-card rounded-2xl p-8">
            <BellRing size={28} className="text-muted mx-auto mb-2" />
            <p className="text-base font-semibold text-white">No alert rules configured</p>
            <p className="text-xs text-muted">Create stateful rules above to monitor telemetry streams.</p>
          </div>
        )}

        {filteredRules.map((rule) => {
          const isCritical = rule.severity === 'CRITICAL';
          const isFiring = rule.state === 'FIRING';
          const metricObj = metricsCatalog.find((m) => m.key === rule.metric);
          const MetricIcon = metricObj?.icon || Cpu;

          return (
            <div
              key={rule.id}
              className={`glass-card-interactive rounded-2xl p-5 border flex flex-col justify-between space-y-4 group transition-all ${
                isFiring ? 'border-critical/50 shadow-glow-critical' : 'border-border'
              }`}
            >
              <div className="space-y-3">
                {/* Header with Severity & Status State Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                        isCritical
                          ? 'bg-critical/15 text-critical border-critical/30 shadow-glow-critical'
                          : 'bg-warning/15 text-warning border-warning/30 shadow-glow-warning'
                      }`}
                    >
                      {rule.severity}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold ${
                        isFiring
                          ? 'bg-critical text-white animate-pulse'
                          : 'bg-surface-elevated text-muted border border-border'
                      }`}
                    >
                      {rule.state || 'OK'}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDelete(rule.id)}
                    title="Delete Rule"
                    className="p-1 text-muted hover:text-critical hover:bg-critical/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Rule Title & Type */}
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-primary-light transition-colors">
                    {rule.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted font-mono mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-primary-light">
                      {rule.rule_type || 'THRESHOLD'}
                    </span>
                    <div className="flex items-center gap-1">
                      <MetricIcon size={13} className="text-primary-light" />
                      <span>{metricObj?.label || rule.metric}</span>
                    </div>
                  </div>
                </div>

                {/* Condition & Hysteresis Visualizer Box */}
                <div className="p-3 rounded-xl bg-background/70 border border-border space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted">Trigger condition</span>
                    <span className="font-bold text-white">
                      {rule.operator} {rule.threshold}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-highlight rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isCritical ? 'bg-critical' : 'bg-warning'}`}
                      style={{ width: `${Math.min(rule.threshold, 100)}%` }}
                    />
                  </div>

                  {rule.resolve_threshold && (
                    <div className="flex justify-between text-[11px] font-mono text-muted pt-1 border-t border-border/40">
                      <span className="flex items-center gap-1">
                        <TrendingDown size={11} className="text-healthy" /> Hysteresis Clear
                      </span>
                      <span className="text-healthy font-semibold">
                        &lt; {rule.resolve_threshold}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Fingerprint Deduplication Tag */}
                <div className="text-[10px] font-mono text-muted truncate bg-surface/40 px-2 py-1 rounded border border-border/50">
                  <span className="text-text-dim">Fingerprint: </span>
                  <span className="text-primary-light">
                    {rule.fingerprint || `${rule.id.slice(0, 8)}:srv-fleet:env-prod`}
                  </span>
                </div>
              </div>

              {/* Footer Meta Details */}
              <div className="pt-3 border-t border-border/80 flex items-center justify-between text-[11px] font-mono text-muted">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> For: {rule.for_seconds || 300}s
                </span>
                <span className="text-healthy flex items-center gap-1 font-semibold">
                  <CheckCircle2 size={12} /> Evaluating
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
