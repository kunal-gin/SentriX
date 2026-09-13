import { FormEvent, useState } from 'react';
import { useSLOs, useCreateSLO, SLOEntity } from '../../hooks/useSLO';
import {
  ShieldCheck,
  Plus,
  TrendingDown,
  AlertTriangle,
  Clock,
  Activity,
  Flame,
  CheckCircle2,
  Check,
  Search,
  Sparkles,
} from 'lucide-react';

export function SLOPage() {
  const { data: slos, isLoading } = useSLOs();
  const createSLO = useCreateSLO();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [service, setService] = useState('payments-service');
  const [target, setTarget] = useState(99.95);
  const [sliType, setSliType] = useState<'AVAILABILITY' | 'LATENCY' | 'ERROR_RATE'>('AVAILABILITY');
  const [timeWindow, setTimeWindow] = useState('30d');

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    await createSLO.mutateAsync({
      name,
      service,
      target_percent: target,
      current_percent: 99.98,
      sli_type: sliType,
      time_window: timeWindow,
      error_budget_minutes: 21.6,
      consumed_minutes: 2.1,
      burn_rate: 0.95,
      status: 'HEALTHY',
    });
    setName('');
    setShowModal(false);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Service Level Objectives (SLOs)
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary/20 text-primary-light border border-primary/30">
              Reliability Engineering
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Error budget tracking, consumption burn rates, and deterministic reliability metrics.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary transition-all self-start sm:self-auto"
        >
          <Plus size={15} />
          <span>Define SLO</span>
        </button>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-border">
          <div className="text-[11px] font-mono text-muted uppercase">Fleet Reliability Score</div>
          <div className="text-3xl font-bold text-healthy font-mono mt-1">99.96%</div>
          <div className="text-xs text-muted mt-1">Within target nominal tolerances across all services</div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-border">
          <div className="text-[11px] font-mono text-muted uppercase">Error Budget Health</div>
          <div className="text-3xl font-bold text-white font-mono mt-1">72% Left</div>
          <div className="text-xs text-muted mt-1">Average remaining downtime allowance over 30d window</div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-border">
          <div className="text-[11px] font-mono text-muted uppercase">Mean Burn Rate</div>
          <div className="text-3xl font-bold text-primary-light font-mono mt-1 flex items-center gap-2">
            <Flame size={24} className="text-warning" />
            1.1x
          </div>
          <div className="text-xs text-muted mt-1">Nominal budget depletion speed (1.0x is balanced)</div>
        </div>
      </div>

      {/* SLO Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {isLoading && (
          <div className="col-span-full py-16 text-center text-muted font-mono text-xs">
            Calculating error budgets and burn rates...
          </div>
        )}

        {(slos || []).map((slo) => {
          const isHealthy = slo.status === 'HEALTHY';
          const isAtRisk = slo.status === 'AT_RISK';
          const budgetPct = Math.max(
            0,
            Math.min(100, Math.round(((slo.error_budget_minutes - slo.consumed_minutes) / slo.error_budget_minutes) * 100))
          );

          return (
            <div
              key={slo.id}
              className={`glass-card rounded-2xl p-6 border flex flex-col justify-between space-y-5 transition-all ${
                isAtRisk ? 'border-warning/50 bg-warning/5 shadow-glow-warning' : 'border-border'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-primary-light">
                    {slo.service}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      isHealthy
                        ? 'bg-healthy/15 text-healthy border-healthy/30'
                        : 'bg-warning/15 text-warning border-warning/30 animate-pulse'
                    }`}
                  >
                    {isHealthy ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                    {slo.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white">{slo.name}</h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-muted mt-1">
                    <span>Type: {slo.sli_type}</span>
                    <span>•</span>
                    <span>Window: {slo.time_window}</span>
                  </div>
                </div>

                {/* Target vs Current percentage comparison */}
                <div className="p-3.5 rounded-xl bg-background/60 border border-border/70 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono text-muted uppercase">Target</div>
                    <div className="text-sm font-bold text-white font-mono mt-0.5">{slo.target_percent}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-muted uppercase">Current Actual</div>
                    <div
                      className={`text-lg font-bold font-mono mt-0.5 ${
                        slo.current_percent >= slo.target_percent ? 'text-healthy' : 'text-critical'
                      }`}
                    >
                      {slo.current_percent}%
                    </div>
                  </div>
                </div>

                {/* Error Budget Bar */}
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted">Error Budget Remaining</span>
                    <span className="font-bold text-white">{budgetPct}%</span>
                  </div>
                  <div className="w-full bg-surface-highlight rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        budgetPct > 50 ? 'bg-healthy' : budgetPct > 20 ? 'bg-warning' : 'bg-critical'
                      }`}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted pt-0.5">
                    <span>Consumed: {slo.consumed_minutes}m</span>
                    <span>Allowed: {slo.error_budget_minutes}m</span>
                  </div>
                </div>
              </div>

              {/* Footer with Burn Rate */}
              <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] font-mono">
                <span className="text-muted">Burn Rate:</span>
                <span
                  className={`font-bold flex items-center gap-1 ${
                    slo.burn_rate > 2.0 ? 'text-critical' : slo.burn_rate > 1.2 ? 'text-warning' : 'text-healthy'
                  }`}
                >
                  <Flame size={12} />
                  {slo.burn_rate}x
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Define SLO Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-card rounded-2xl p-6 border border-primary/40 shadow-glow-primary max-w-lg w-full space-y-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary-light" />
              <span>Define Service Level Objective</span>
            </h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted mb-1">SLO Objective Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ingress Response Availability 99.95%"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-muted mb-1">Target Service</label>
                  <select
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  >
                    <option value="payments-service">payments-service</option>
                    <option value="auth-gateway">auth-gateway</option>
                    <option value="telemetry-engine">telemetry-engine</option>
                    <option value="edge-ingress">edge-ingress</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-muted mb-1">SLI Metric Type</label>
                  <select
                    value={sliType}
                    onChange={(e) => setSliType(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  >
                    <option value="AVAILABILITY">Availability (% Success)</option>
                    <option value="LATENCY">Latency Threshold</option>
                    <option value="ERROR_RATE">Error Rate Boundary</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-muted mb-1">Target Percentage (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={target}
                    onChange={(e) => setTarget(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-muted mb-1">Evaluation Window</label>
                  <select
                    value={timeWindow}
                    onChange={(e) => setTimeWindow(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  >
                    <option value="30d">30 Days Rolling</option>
                    <option value="7d">7 Days Rolling</option>
                    <option value="24h">24 Hours</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSLO.isPending}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary"
                >
                  {createSLO.isPending ? 'Saving...' : 'Deploy SLO Tracker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
