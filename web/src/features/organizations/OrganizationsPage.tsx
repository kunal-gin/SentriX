import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import {
  Building2,
  Users,
  Layers,
  Shield,
  Plus,
  Server,
  Activity,
  FileText,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  LayoutGrid,
  Settings,
} from 'lucide-react';
import { Badge, MetricCard, EmptyState, LoadingState } from '../../components/ui/Primitives';

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  environments: string[];
  server_quota: number;
  retention_days: number;
  created_at: string;
}

interface Team {
  id: string;
  org_id: string;
  name: string;
  description: string;
  members_count: number;
  lead_email: string;
  created_at: string;
}

interface TenantQuota {
  org_id: string;
  servers_active: number;
  servers_limit: number;
  metrics_per_sec: number;
  metrics_limit: number;
  logs_gb_per_day: number;
  logs_limit_gb: number;
  retention_days: number;
  custom_dashboards: number;
  dashboards_limit: number;
}

export const OrganizationsPage: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('org-acme-corp');
  const [teams, setTeams] = useState<Team[]>([]);
  const [quota, setQuota] = useState<TenantQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'organizations' | 'teams' | 'quotas'>('organizations');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State for new org
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState('PRO');
  const [newOrgQuota, setNewOrgQuota] = useState(25);
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [orgsRes, teamsRes, quotaRes] = await Promise.all([
        api.get('/organizations'),
        api.get(`/organizations/${selectedOrgId}/teams`),
        api.get(`/organizations/${selectedOrgId}/quota`),
      ]);
      setOrganizations(orgsRes.data || []);
      setTeams(teamsRes.data || []);
      setQuota(quotaRes.data || null);
    } catch (err) {
      console.error('Failed to load organization data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedOrgId]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      await api.post('/organizations', {
        name: newOrgName,
        slug: newOrgSlug || newOrgName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        plan: newOrgPlan,
        server_quota: Number(newOrgQuota),
        environments: ['Production', 'Staging', 'Development'],
        retention_days: newOrgPlan === 'ENTERPRISE' ? 90 : 30,
      });
      setShowCreateModal(false);
      setNewOrgName('');
      setNewOrgSlug('');
      await fetchData();
    } catch (err) {
      console.error('Failed to create organization', err);
    } finally {
      setCreating(false);
    }
  };

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId) || organizations[0];

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-primary-light uppercase tracking-wider mb-1">
            <Building2 size={14} /> Multi-Tenancy & Governance
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Organizations & Teams</h1>
          <p className="text-sm text-muted mt-1">
            Manage organization boundaries, isolated tenant data partitions, team permissions, and ingest quotas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white text-xs font-semibold shadow-glow-primary hover:opacity-95 transition-all"
          >
            <Plus size={15} />
            <span>New Organization</span>
          </button>
        </div>
      </div>

      {/* Quota Highlights */}
      {quota && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Active Fleet Nodes"
            value={`${quota.servers_active} / ${quota.servers_limit}`}
            subtitle={`${Math.round((quota.servers_active / quota.servers_limit) * 100)}% capacity allocated`}
            icon={Server}
            color={quota.servers_active >= quota.servers_limit ? 'critical' : 'healthy'}
          />
          <MetricCard
            title="Telemetry Ingest Rate"
            value={`${quota.metrics_per_sec.toLocaleString()} /s`}
            subtitle={`Quota cap: ${quota.metrics_limit.toLocaleString()} m/s`}
            icon={Activity}
            color="primary"
          />
          <MetricCard
            title="Log Ingestion Volume"
            value={`${quota.logs_gb_per_day} GB`}
            subtitle={`Daily limit: ${quota.logs_limit_gb} GB/day`}
            icon={FileText}
            color="primary"
          />
          <MetricCard
            title="Data Retention"
            value={`${quota.retention_days} Days`}
            subtitle={`${quota.custom_dashboards}/${quota.dashboards_limit} custom dashboards`}
            icon={Shield}
            color="healthy"
          />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-border/80">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('organizations')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'organizations'
                ? 'border-primary text-white bg-surface/40'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            <Building2 size={16} />
            <span>Organizations ({organizations.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'teams'
                ? 'border-primary text-white bg-surface/40'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            <Users size={16} />
            <span>Teams ({teams.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('quotas')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'quotas'
                ? 'border-primary text-white bg-surface/40'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            <Layers size={16} />
            <span>Quota & Resource Isolation</span>
          </button>
        </div>

        {/* Current Active Org Pill */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono bg-surface/80 px-3 py-1.5 rounded-xl border border-border">
          <span className="text-muted">Active Org:</span>
          <span className="text-primary-light font-bold">{selectedOrg?.name || 'Acme Corp'}</span>
          <Badge variant={selectedOrg?.plan === 'ENTERPRISE' ? 'primary' : 'healthy'}>
            {selectedOrg?.plan || 'ENTERPRISE'}
          </Badge>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading multi-tenancy configurations..." />
      ) : (
        <>
          {/* TAB 1: Organizations */}
          {activeTab === 'organizations' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {organizations.map((org) => {
                const isSelected = org.id === selectedOrgId;
                return (
                  <div
                    key={org.id}
                    onClick={() => setSelectedOrgId(org.id)}
                    className={`cursor-pointer rounded-2xl p-6 border transition-all relative overflow-hidden ${
                      isSelected
                        ? 'glass-panel border-primary shadow-glow-primary bg-primary/5'
                        : 'glass-panel border-border/80 hover:border-border hover:bg-surface/60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-primary-light font-bold text-lg shadow-sm">
                          {org.name[0]}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white flex items-center gap-2">
                            {org.name}
                            {isSelected && (
                              <CheckCircle2 size={16} className="text-healthy" />
                            )}
                          </h3>
                          <p className="text-xs font-mono text-muted">/{org.slug}</p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          org.plan === 'ENTERPRISE'
                            ? 'primary'
                            : org.plan === 'PRO'
                            ? 'healthy'
                            : 'neutral'
                        }
                      >
                        {org.plan}
                      </Badge>
                    </div>

                    <div className="mt-5 space-y-3">
                      <div>
                        <div className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1.5">
                          Configured Environments
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {org.environments.map((env) => (
                            <span
                              key={env}
                              className="px-2 py-0.5 rounded-lg bg-surface-highlight/70 border border-border text-xs text-text-dim font-mono"
                            >
                              {env}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60 text-xs">
                        <div>
                          <span className="text-muted">Node Quota: </span>
                          <span className="font-mono text-white font-semibold">{org.server_quota} Nodes</span>
                        </div>
                        <div>
                          <span className="text-muted">Log Retention: </span>
                          <span className="font-mono text-white font-semibold">{org.retention_days} Days</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between pt-4 border-t border-border/60 text-xs">
                      <span className="text-muted font-mono text-[11px]">
                        Created {new Date(org.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrgId(org.id);
                        }}
                        className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-primary/20 text-primary-light border border-primary/30'
                            : 'text-muted hover:text-white hover:bg-surface'
                        }`}
                      >
                        {isSelected ? 'Current Workspace' : 'Switch to Org'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: Teams */}
          {activeTab === 'teams' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-surface/50 p-4 rounded-xl border border-border">
                <div>
                  <h3 className="text-sm font-bold text-white">Teams within {selectedOrg?.name}</h3>
                  <p className="text-xs text-muted">
                    Assign role-based access control (RBAC), server access groups, and alerting escalation paths.
                  </p>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-primary/50 text-xs text-white transition-all">
                  <Plus size={14} /> Add Team
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="glass-panel border-border/80 rounded-2xl p-5 hover:border-border transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary-light">
                          <Users size={18} />
                        </div>
                        <Badge variant="mono">{team.members_count} Members</Badge>
                      </div>
                      <h4 className="font-bold text-white text-base">{team.name}</h4>
                      <p className="text-xs text-muted mt-1 leading-relaxed">{team.description}</p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-border/60 text-xs text-muted">
                      <div className="flex items-center justify-between">
                        <span>Team Lead:</span>
                        <span className="font-mono text-text-dim text-[11px]">{team.lead_email}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Quotas & Isolation */}
          {activeTab === 'quotas' && quota && (
            <div className="glass-panel border-border/80 rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white">Tenant Resource Isolation & Limits</h3>
                <p className="text-xs text-muted mt-1">
                  Enforces strict database tenant boundary partitions, rate limiting, and disk retention tiers for{' '}
                  <span className="text-white font-semibold">{selectedOrg?.name}</span>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Servers Progress */}
                <div className="p-4 rounded-xl bg-surface/60 border border-border space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted">Active Monitored Nodes</span>
                    <span className="text-white font-bold">
                      {quota.servers_active} / {quota.servers_limit} Nodes
                    </span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-500"
                      style={{ width: `${(quota.servers_active / quota.servers_limit) * 100}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-muted">
                    Capacity allocated for automated health checks, metrics, and log agents.
                  </div>
                </div>

                {/* Metrics Throughput Progress */}
                <div className="p-4 rounded-xl bg-surface/60 border border-border space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted">Metrics Ingest Throughput</span>
                    <span className="text-white font-bold">
                      {quota.metrics_per_sec} / {quota.metrics_limit} m/s
                    </span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-healthy h-full transition-all duration-500"
                      style={{ width: `${(quota.metrics_per_sec / quota.metrics_limit) * 100}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-muted">
                    Token bucket rate limit per tenant. Excess datapoints are buffered into Redis/memory queue.
                  </div>
                </div>

                {/* Log Ingest Progress */}
                <div className="p-4 rounded-xl bg-surface/60 border border-border space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted">Log Daily Volume</span>
                    <span className="text-white font-bold">
                      {quota.logs_gb_per_day} / {quota.logs_limit_gb} GB/day
                    </span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-warning h-full transition-all duration-500"
                      style={{ width: `${(quota.logs_gb_per_day / quota.logs_limit_gb) * 100}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-muted">
                    Central log stream parser quota. Compression and cold tier archiving active.
                  </div>
                </div>

                {/* Dashboards Progress */}
                <div className="p-4 rounded-xl bg-surface/60 border border-border space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted">Custom Dashboards</span>
                    <span className="text-white font-bold">
                      {quota.custom_dashboards} / {quota.dashboards_limit} Created
                    </span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-cyan h-full transition-all duration-500"
                      style={{ width: `${(quota.custom_dashboards / quota.dashboards_limit) * 100}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-muted">
                    High-density operational visualizers and executive reports.
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Org Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel border-border max-w-md w-full rounded-2xl p-6 space-y-5 animate-scale-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 size={18} className="text-primary-light" />
                Create New Organization
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    if (!newOrgSlug) {
                      setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }
                  }}
                  placeholder="e.g. Nexus FinTech Corp"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-white text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">URL Identifier / Slug</label>
                <input
                  type="text"
                  required
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  placeholder="nexus-fintech"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-white text-sm font-mono focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Plan Tier</label>
                  <select
                    value={newOrgPlan}
                    onChange={(e) => setNewOrgPlan(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-white text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="COMMUNITY">COMMUNITY</option>
                    <option value="PRO">PRO</option>
                    <option value="ENTERPRISE">ENTERPRISE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Node Quota</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={newOrgQuota}
                    onChange={(e) => setNewOrgQuota(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-white text-sm font-mono focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-white bg-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary-hover shadow-glow-primary transition-all disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Provision Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
