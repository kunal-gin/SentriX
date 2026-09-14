import { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Zap,
  Server,
  Activity,
  HardDrive,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import { MetricCard } from '../../components/ui/Primitives';
import { api } from '../../api/client';

interface PlanTier {
  id: string;
  name: string;
  price_usd_monthly: number;
  node_limit: number;
  metrics_per_sec: number;
  retention_days: number;
  features: string[];
  current: boolean;
}

interface UsageMetering {
  organization_id: string;
  plan_tier: string;
  active_nodes: number;
  node_limit: number;
  metrics_per_sec: number;
  metrics_limit: number;
  log_storage_gb: number;
  log_storage_limit_gb: number;
  trace_spans_monthly: number;
  api_requests_24h: number;
  billing_period_end: string;
}

export function BillingPlansPage() {
  const [plans, setPlans] = useState<PlanTier[]>([]);
  const [usage, setUsage] = useState<UsageMetering | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  async function loadData() {
    try {
      const [resP, resU] = await Promise.all([
        api.get<PlanTier[]>('/billing/plans'),
        api.get<UsageMetering>('/billing/usage'),
      ]);
      setPlans(resP.data);
      setUsage(resU.data);
    } catch (err) {
      console.error('Failed to load billing plans', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSelectPlan(planId: string) {
    setSubscribing(planId);
    try {
      await api.post('/billing/subscribe', { plan_id: planId });
      await loadData();
    } catch (err) {
      console.error('Failed to subscribe to plan', err);
    } finally {
      setSubscribing(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <CreditCard className="text-primary-light" size={26} />
              SaaS Control Plane & Plan Management
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-primary/20 text-primary-light border border-primary/30">
              Phase 22
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Tenant quota entitlements, granular usage metering & cloud subscription tiering
          </p>
        </div>

        <div className="flex items-center gap-2 bg-surface/80 border border-border px-3 py-1.5 rounded-xl text-xs font-mono text-muted">
          <Shield size={12} className="text-healthy" />
          <span>Active Tier: {usage?.plan_tier || 'Enterprise Sentinel'}</span>
        </div>
      </div>

      {/* Usage Metering Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Monitored Fleet Nodes"
          value={usage ? `${usage.active_nodes} / ${usage.node_limit}` : '8 / 500'}
          subtitle={
            usage
              ? `${Math.round((usage.active_nodes / usage.node_limit) * 100)}% Entitlement Used`
              : '2% Used'
          }
          icon={<Server size={18} className="text-cyan" />}
        />
        <MetricCard
          title="Ingestion Rate"
          value={
            usage
              ? `${usage.metrics_per_sec.toLocaleString()} /s`
              : '12,400 /s'
          }
          subtitle={
            usage
              ? `Limit: ${usage.metrics_limit.toLocaleString()} /s`
              : 'Limit: 250,000 /s'
          }
          icon={<Activity size={18} className="text-primary-light" />}
        />
        <MetricCard
          title="Log Storage Meter"
          value={
            usage
              ? `${usage.log_storage_gb} GB`
              : '14.2 GB'
          }
          subtitle={
            usage
              ? `Cap: ${usage.log_storage_limit_gb} GB (365d retention)`
              : 'Cap: 500 GB'
          }
          icon={<HardDrive size={18} className="text-warning" />}
        />
        <MetricCard
          title="Monthly Trace Spans"
          value={
            usage
              ? `${(usage.trace_spans_monthly / 1000000).toFixed(1)}M`
              : '8.4M'
          }
          subtitle="OTel Ingestion Spans"
          icon={<Zap size={18} className="text-healthy" />}
        />
      </div>

      {/* Plan Tiers Grid */}
      <div className="glass-panel p-5 rounded-2xl border border-border space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-white">Subscription & Entitlement Tiers</h2>
          <p className="text-xs text-muted mt-0.5">
            Transparent scaling limits with independent entitlement enforcement logic
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 border flex flex-col justify-between space-y-6 transition-all ${
                plan.current
                  ? 'border-primary bg-primary/10 shadow-glow-primary'
                  : 'border-border bg-surface/50 hover:border-border/80'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">{plan.name}</h3>
                  {plan.current && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary-light border border-primary/30">
                      CURRENT
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 font-mono">
                  <span className="text-3xl font-extrabold text-white">${plan.price_usd_monthly}</span>
                  <span className="text-xs text-muted">/ month</span>
                </div>

                <div className="space-y-2 text-xs font-mono border-t border-b border-border/60 py-3">
                  <div className="flex justify-between">
                    <span className="text-muted">Host Nodes:</span>
                    <span className="text-white font-bold">{plan.node_limit} nodes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Metrics Rate:</span>
                    <span className="text-white font-bold">
                      {plan.metrics_per_sec.toLocaleString()} /sec
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Retention:</span>
                    <span className="text-white font-bold">{plan.retention_days} days</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-mono text-muted uppercase">Features Included:</div>
                  <ul className="space-y-1.5 text-xs text-text">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-healthy shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={plan.current || subscribing === plan.id}
                className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  plan.current
                    ? 'bg-surface text-muted cursor-default border border-border'
                    : 'bg-primary hover:bg-primary-hover text-white shadow-glow-primary'
                }`}
              >
                {subscribing === plan.id
                  ? 'Activating...'
                  : plan.current
                  ? 'Current Plan'
                  : 'Upgrade / Switch Tier'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
