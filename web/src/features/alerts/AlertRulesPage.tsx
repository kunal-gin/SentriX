import { FormEvent, useState } from 'react';
import {
  CreateAlertRuleInput,
  useAlertRules,
  useCreateAlertRule,
  useDeleteAlertRule,
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
  ShieldCheck,
  ToggleRight,
} from 'lucide-react';

const defaultForm: CreateAlertRuleInput = {
  name: 'High CPU Threshold',
  metric: 'system.cpu.utilization',
  operator: '>',
  threshold: 85,
  window_seconds: 60,
  for_seconds: 300,
  severity: 'CRITICAL',
  enabled: true,
  cooldown_seconds: 300,
  resolve_threshold: 75,
};

const metricsCatalog = [
  { key: 'system.cpu.utilization', label: 'CPU Utilization', icon: Cpu, unit: '%' },
  { key: 'system.memory.utilization', label: 'Memory Pressure', icon: CircuitBoard, unit: '%' },
  { key: 'system.disk.utilization', label: 'Storage / Root Disk', icon: HardDrive, unit: '%' },
];

export function AlertRulesPage() {
  const { data: rules, isLoading } = useAlertRules();
  const createRule = useCreateAlertRule();
  const deleteRule = useDeleteAlertRule();

  const [form, setForm] = useState<CreateAlertRuleInput>(defaultForm);
  const [showCreateModal, setShowCreateModal] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await createRule.mutateAsync(form);
    setForm(defaultForm);
    setShowCreateModal(false);
  }

  async function handleDelete(ruleId: string) {
    if (confirm('Are you sure you want to delete this alert rule?')) {
      await deleteRule.mutateAsync(ruleId);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Alert Rules & Escalation
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary/20 text-primary-light border border-primary/30">
              {rules?.length ?? 0} Rules
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Threshold-based real-time anomaly detection rules evaluated across all agent telemetry streams.
          </p>
        </div>

        <div>
          <button
            onClick={() => setShowCreateModal(!showCreateModal)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary transition-all"
          >
            <Plus size={15} />
            <span>Create Alert Rule</span>
          </button>
        </div>
      </div>

      {/* Inline Create Rule Panel (Collapsible) */}
      {showCreateModal && (
        <div className="glass-card rounded-2xl p-6 border border-primary/40 shadow-glow-primary space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Sliders size={16} className="text-primary-light" />
              <span>Define Anomaly Alert Rule</span>
            </h2>
            <button
              onClick={() => setShowCreateModal(false)}
              className="text-xs text-muted hover:text-white"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <label className="block text-xs font-mono text-muted mb-1">Threshold (%)</label>
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
              <label className="block text-xs font-mono text-muted mb-1">Window Period (Seconds)</label>
              <input
                type="number"
                value={form.window_seconds}
                onChange={(e) => setForm({ ...form, window_seconds: Number(e.target.value) })}
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
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={createRule.isPending}
                className="w-full py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary transition-all"
              >
                {createRule.isPending ? 'Deploying...' : 'Save & Deploy Rule'}
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

        {!isLoading && (rules || []).length === 0 && (
          <div className="col-span-full py-16 text-center space-y-2 glass-card rounded-2xl p-8">
            <BellRing size={28} className="text-muted mx-auto mb-2" />
            <p className="text-base font-semibold text-white">No alert rules configured</p>
            <p className="text-xs text-muted">Create rules above to automatically trigger incidents.</p>
          </div>
        )}

        {(rules || []).map((rule) => {
          const isCritical = rule.severity === 'CRITICAL';
          const isWarning = rule.severity === 'WARNING';
          const metricObj = metricsCatalog.find((m) => m.key === rule.metric);
          const MetricIcon = metricObj?.icon || Cpu;

          return (
            <div
              key={rule.id}
              className="glass-card-interactive rounded-2xl p-5 border border-border flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                {/* Header with Severity & Delete */}
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                      isCritical
                        ? 'bg-critical/15 text-critical border-critical/30 shadow-glow-critical'
                        : isWarning
                        ? 'bg-warning/15 text-warning border-warning/30 shadow-glow-warning'
                        : 'bg-primary/15 text-primary-light border-primary/30'
                    }`}
                  >
                    {rule.severity}
                  </span>

                  <button
                    onClick={() => handleDelete(rule.id)}
                    title="Delete Rule"
                    className="p-1 text-muted hover:text-critical hover:bg-critical/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Rule Title */}
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-primary-light transition-colors">
                    {rule.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted font-mono mt-1">
                    <MetricIcon size={13} className="text-primary-light" />
                    <span>{metricObj?.label || rule.metric}</span>
                  </div>
                </div>

                {/* Condition Visualizer Box */}
                <div className="p-3 rounded-xl bg-background/70 border border-border space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted">Threshold Trigger</span>
                    <span className="font-bold text-white">
                      {rule.operator} {rule.threshold}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-highlight rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isCritical ? 'bg-critical' : 'bg-warning'
                      }`}
                      style={{ width: `${Math.min(rule.threshold, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Footer Meta Details */}
              <div className="pt-3 border-t border-border/80 flex items-center justify-between text-[11px] font-mono text-muted">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> Window: {rule.window_seconds}s
                </span>
                <span className="text-healthy flex items-center gap-1 font-semibold">
                  <CheckCircle2 size={12} /> Active
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
