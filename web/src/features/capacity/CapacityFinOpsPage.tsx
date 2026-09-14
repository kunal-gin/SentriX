import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  HardDrive,
  Cpu,
  Server,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowDownRight,
  ArrowUpRight,
  Cloud,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { Badge, MetricCard, EmptyState, LoadingState } from '../../components/ui/Primitives';

interface ResourceForecast {
  resource_name: string;
  current_usage_pct: number;
  growth_rate_per_day_pct: number;
  days_to_saturation: number;
  threshold_limit_pct: number;
  recommendation: string;
  severity: string;
  projected_date: string;
}

interface FinOpsSummary {
  total_monthly_spend: number;
  currency: string;
  change_vs_last_month_pct: number;
  efficiency_score: number;
  estimated_monthly_waste: number;
  breakdown_by_provider: Record<string, number>;
  breakdown_by_category: Record<string, number>;
  recommendations: string[];
}

export const CapacityFinOpsPage: React.FC = () => {
  const [forecasts, setForecasts] = useState<ResourceForecast[]>([]);
  const [finops, setFinops] = useState<FinOpsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'capacity' | 'finops'>('capacity');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [capRes, finRes] = await Promise.all([
          api.get('/capacity/forecasts'),
          api.get('/capacity/finops'),
        ]);
        setForecasts(capRes.data || []);
        setFinops(finRes.data || null);
      } catch (err) {
        console.error('Failed to load capacity and FinOps telemetry', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const atRiskCount = forecasts.filter((f) => f.severity !== 'HEALTHY').length;

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-primary-light uppercase tracking-wider mb-1">
            <TrendingUp size={14} /> Phase 20 — Capacity Forecasting & Cloud FinOps
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Capacity & FinOps Center</h1>
          <p className="text-sm text-muted mt-1">
            Linear trend and EWMA regression forecasts predict resource saturation before outages occur, coupled with multi-cloud cost intelligence.
          </p>
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Monitored Resource Pools"
          value={forecasts.length}
          subtitle="Disk, RAM, CPU & Chunks"
          icon={HardDrive}
          color="primary"
        />
        <MetricCard
          title="Saturation Warnings"
          value={atRiskCount}
          subtitle="Approaching saturation < 30d"
          icon={AlertTriangle}
          color={atRiskCount > 0 ? 'warning' : 'healthy'}
        />
        <MetricCard
          title="Monthly Cloud Spend"
          value={finops ? `$${finops.total_monthly_spend.toLocaleString()}` : '$14,250'}
          subtitle={finops ? `${finops.change_vs_last_month_pct}% vs last month` : '-4.2% change'}
          icon={DollarSign}
          color="primary"
        />
        <MetricCard
          title="FinOps Efficiency Score"
          value={finops ? `${finops.efficiency_score}/100` : '88/100'}
          subtitle={`Est. monthly waste: $${finops?.estimated_monthly_waste?.toLocaleString() || '1,840'}`}
          icon={CheckCircle2}
          color="healthy"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80">
        <button
          onClick={() => setActiveTab('capacity')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'capacity'
              ? 'border-primary text-white bg-surface/40'
              : 'border-transparent text-muted hover:text-white'
          }`}
        >
          <HardDrive size={16} />
          <span>Capacity & Saturation Forecasts ({forecasts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('finops')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'finops'
              ? 'border-primary text-white bg-surface/40'
              : 'border-transparent text-muted hover:text-white'
          }`}
        >
          <DollarSign size={16} />
          <span>Cloud Cost & FinOps Efficiency</span>
        </button>
      </div>

      {loading ? (
        <LoadingState message="Calculating trend models and multi-cloud costs..." />
      ) : (
        <>
          {/* TAB 1: Capacity Planning */}
          {activeTab === 'capacity' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {forecasts.map((fc, idx) => {
                  const isCritical = fc.severity === 'CRITICAL';
                  const isWarning = fc.severity === 'WARNING';

                  return (
                    <div
                      key={idx}
                      className={`glass-panel rounded-2xl p-6 border transition-all space-y-4 ${
                        isCritical
                          ? 'border-critical/50 bg-critical/5 shadow-glow-critical'
                          : isWarning
                          ? 'border-warning/50 bg-warning/5'
                          : 'border-border/80'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-mono text-muted uppercase tracking-wider">
                            Resource Pool
                          </span>
                          <h3 className="text-base font-bold text-white mt-0.5">{fc.resource_name}</h3>
                        </div>
                        <Badge
                          variant={isCritical ? 'critical' : isWarning ? 'warning' : 'healthy'}
                        >
                          {fc.days_to_saturation <= 30
                            ? `${fc.days_to_saturation} Days to 90%`
                            : `${fc.days_to_saturation}d Headroom`}
                        </Badge>
                      </div>

                      {/* Usage Progress */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-muted">Current Allocation</span>
                          <span className="text-white font-bold">{fc.current_usage_pct}% / 100%</span>
                        </div>
                        <div className="w-full bg-background rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              isCritical ? 'bg-critical' : isWarning ? 'bg-warning' : 'bg-primary'
                            }`}
                            style={{ width: `${fc.current_usage_pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-muted font-mono pt-1">
                          <span>Growth Rate: +{fc.growth_rate_per_day_pct}% / day</span>
                          <span>Threshold Limit: {fc.threshold_limit_pct}%</span>
                        </div>
                      </div>

                      {/* Recommendation Box */}
                      <div className="p-3 rounded-xl bg-surface/60 border border-border/80 text-xs space-y-1">
                        <div className="text-[10px] font-mono uppercase text-primary-light font-bold flex items-center gap-1">
                          <Sparkles size={11} /> SRE Capacity Recommendation
                        </div>
                        <p className="text-text-dim leading-relaxed">{fc.recommendation}</p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-muted pt-2 border-t border-border/40">
                        <span>Projected Saturation Date:</span>
                        <span className="text-white font-semibold">
                          {new Date(fc.projected_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: FinOps Cloud Cost */}
          {activeTab === 'finops' && finops && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Spend by Provider */}
                <div className="glass-panel border-border/80 rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Cloud size={18} className="text-primary-light" />
                    Spend by Infrastructure Provider
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(finops.breakdown_by_provider).map(([prov, amt]) => {
                      const pct = Math.round((amt / finops.total_monthly_spend) * 100);
                      return (
                        <div key={prov} className="space-y-1.5 font-mono text-xs">
                          <div className="flex justify-between">
                            <span className="text-white font-semibold">{prov}</span>
                            <span className="text-muted">
                              ${amt.toLocaleString()} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Spend by Category */}
                <div className="glass-panel border-border/80 rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <PieChart size={18} className="text-primary-light" />
                    Spend by Telemetry & Compute Layer
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(finops.breakdown_by_category).map(([cat, amt]) => {
                      const pct = Math.round((amt / finops.total_monthly_spend) * 100);
                      return (
                        <div key={cat} className="space-y-1.5 font-mono text-xs">
                          <div className="flex justify-between">
                            <span className="text-white font-semibold">{cat}</span>
                            <span className="text-muted">
                              ${amt.toLocaleString()} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-cyan h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Optimization Recommendations */}
              <div className="glass-panel border-border/80 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <DollarSign size={18} className="text-healthy" />
                    FinOps Automated Waste Reduction Recommendations
                  </h3>
                  <span className="text-xs font-mono text-healthy bg-healthy/10 px-2.5 py-1 rounded-full border border-healthy/20 font-bold">
                    Est. Total Savings: ${finops.estimated_monthly_waste.toLocaleString()} / mo
                  </span>
                </div>

                <div className="divide-y divide-border/60">
                  {finops.recommendations.map((rec, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-healthy/15 text-healthy flex items-center justify-center font-bold text-xs">
                          ✓
                        </div>
                        <span className="text-xs text-text-dim">{rec}</span>
                      </div>
                      <button className="text-xs font-mono text-primary-light hover:underline font-semibold whitespace-nowrap">
                        Apply Policy
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
