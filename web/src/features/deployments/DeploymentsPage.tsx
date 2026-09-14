import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import {
  GitCommit,
  Rocket,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Plus,
  Filter,
  ExternalLink,
  Layers,
  ArrowRight,
  Sparkles,
  Tag,
  GitBranch,
  Calendar,
} from 'lucide-react';
import { Badge, MetricCard, EmptyState, LoadingState } from '../../components/ui/Primitives';

interface Deployment {
  id: string;
  service_id: string;
  service_name: string;
  version: string;
  commit_sha: string;
  commit_message: string;
  author: string;
  environment: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_sec: number;
  correlated_incident_id?: string;
}

interface ChangeEvent {
  id: string;
  category: string;
  target_resource: string;
  description: string;
  actor: string;
  environment: string;
  timestamp: string;
}

export const DeploymentsPage: React.FC = () => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [changes, setChanges] = useState<ChangeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'deployments' | 'changes'>('deployments');
  const [envFilter, setEnvFilter] = useState<string>('ALL');
  const [showDeployModal, setShowDeployModal] = useState(false);

  // New Deployment Form
  const [newServiceName, setNewServiceName] = useState('payments-service');
  const [newVersion, setNewVersion] = useState('v2.9.0');
  const [newCommitSha, setNewCommitSha] = useState('a1b2c3d');
  const [newCommitMsg, setNewCommitMsg] = useState('feat: add zero-downtime ledger migration');
  const [newAuthor, setNewAuthor] = useState('sre-team@sentrix.local');
  const [newEnv, setNewEnv] = useState('Production');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [depRes, chgRes] = await Promise.all([
        api.get('/deployments'),
        api.get('/changes'),
      ]);
      setDeployments(depRes.data || []);
      setChanges(chgRes.data || []);
    } catch (err) {
      console.error('Failed to load deployments data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRecordDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post('/deployments', {
        service_id: `srv-${newServiceName}`,
        service_name: newServiceName,
        version: newVersion,
        commit_sha: newCommitSha,
        commit_message: newCommitMsg,
        author: newAuthor,
        environment: newEnv,
      });
      setShowDeployModal(false);
      await fetchData();
    } catch (err) {
      console.error('Failed to record deployment', err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDeployments = deployments.filter((d) =>
    envFilter === 'ALL' ? true : d.environment.toLowerCase() === envFilter.toLowerCase()
  );

  const filteredChanges = changes.filter((c) =>
    envFilter === 'ALL' ? true : c.environment.toLowerCase() === envFilter.toLowerCase()
  );

  const successCount = deployments.filter((d) => d.status === 'SUCCESS').length;
  const failedCount = deployments.filter((d) => d.status === 'FAILED' || d.status === 'ROLLING_BACK').length;

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-primary-light uppercase tracking-wider mb-1">
            <Rocket size={14} /> Phase 18 — CI/CD & Change Intelligence
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Deployments & Changes</h1>
          <p className="text-sm text-muted mt-1">
            Correlate release rollouts, database migrations, and config modifications with real-time anomalies and incident cascades.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDeployModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white text-xs font-semibold shadow-glow-primary hover:opacity-95 transition-all"
          >
            <Plus size={15} />
            <span>Record Deployment</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Recorded Rollouts"
          value={deployments.length}
          subtitle="Past 30 days history"
          icon={Rocket}
          color="primary"
        />
        <MetricCard
          title="Rollout Success Rate"
          value={deployments.length > 0 ? `${Math.round((successCount / deployments.length) * 100)}%` : '100%'}
          subtitle={`${successCount} successful releases`}
          icon={CheckCircle2}
          color="healthy"
        />
        <MetricCard
          title="Rollback / Failures"
          value={failedCount}
          subtitle="With automated canary halts"
          icon={AlertTriangle}
          color={failedCount > 0 ? 'critical' : 'healthy'}
        />
        <MetricCard
          title="Change Events Audited"
          value={changes.length}
          subtitle="Across services & nodes"
          icon={GitCommit}
          color="primary"
        />
      </div>

      {/* Navigation & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('deployments')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
              activeTab === 'deployments'
                ? 'bg-primary/20 text-primary-light border border-primary/30'
                : 'text-muted hover:text-white'
            }`}
          >
            <Rocket size={15} />
            <span>Deployment Releases ({deployments.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('changes')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
              activeTab === 'changes'
                ? 'bg-primary/20 text-primary-light border border-primary/30'
                : 'text-muted hover:text-white'
            }`}
          >
            <GitCommit size={15} />
            <span>Unified Change Timeline ({changes.length})</span>
          </button>
        </div>

        {/* Environment Filter */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-muted flex items-center gap-1">
            <Filter size={13} /> Env:
          </span>
          {['ALL', 'Production', 'Staging'].map((env) => (
            <button
              key={env}
              onClick={() => setEnvFilter(env)}
              className={`px-2.5 py-1 rounded-lg border transition-all ${
                envFilter === env
                  ? 'bg-surface-highlight border-primary text-white font-bold'
                  : 'border-border text-muted hover:text-white'
              }`}
            >
              {env}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingState message="Fetching deployment telemetry..." />
      ) : (
        <>
          {/* TAB 1: Deployments Feed */}
          {activeTab === 'deployments' && (
            <div className="space-y-4">
              {filteredDeployments.length === 0 ? (
                <EmptyState
                  title="No deployments found"
                  description="No deployment events match your current environment filters."
                />
              ) : (
                filteredDeployments.map((dep) => {
                  const isSuccess = dep.status === 'SUCCESS';
                  const isFailed = dep.status === 'FAILED';
                  const isRollback = dep.status === 'ROLLING_BACK';
                  const isInProgress = dep.status === 'IN_PROGRESS';

                  return (
                    <div
                      key={dep.id}
                      className={`glass-panel rounded-2xl p-5 border transition-all hover:border-border/90 relative ${
                        dep.correlated_incident_id
                          ? 'border-critical/40 bg-critical/5'
                          : 'border-border/80'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-extrabold text-white text-base tracking-tight">
                              {dep.service_name}
                            </span>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-primary/20 text-primary-light border border-primary/30">
                              {dep.version}
                            </span>
                            <Badge
                              variant={
                                isSuccess
                                  ? 'healthy'
                                  : isFailed
                                  ? 'critical'
                                  : isRollback
                                  ? 'warning'
                                  : 'primary'
                              }
                            >
                              {dep.status}
                            </Badge>
                            <span className="text-xs font-mono text-muted bg-surface px-2 py-0.5 rounded border border-border">
                              {dep.environment}
                            </span>

                            {dep.correlated_incident_id && (
                              <Link
                                to={`/incidents/${dep.correlated_incident_id}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-critical/20 text-critical border border-critical/40 hover:underline animate-pulse"
                              >
                                <AlertTriangle size={12} />
                                <span>Correlated Incident {dep.correlated_incident_id}</span>
                              </Link>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted font-mono">
                            <span className="flex items-center gap-1 text-white/90">
                              <GitBranch size={13} className="text-primary-light" />
                              <span className="font-semibold">{dep.commit_sha}</span>
                            </span>
                            <span>•</span>
                            <span className="text-text-dim max-w-lg truncate">{dep.commit_message}</span>
                          </div>
                        </div>

                        {/* Metadata Right */}
                        <div className="flex items-center gap-6 text-xs font-mono text-muted border-t lg:border-t-0 pt-3 lg:pt-0 border-border">
                          <div>
                            <div className="text-[10px] uppercase text-text-dim">Author</div>
                            <div className="text-white text-[11px] truncate max-w-[130px]">{dep.author}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-text-dim">Duration</div>
                            <div className="text-white text-[11px] flex items-center gap-1">
                              <Clock size={12} className="text-primary-light" />
                              {dep.duration_sec}s
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-text-dim">Deployed At</div>
                            <div className="text-white text-[11px]">
                              {new Date(dep.started_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: Unified Change Timeline */}
          {activeTab === 'changes' && (
            <div className="glass-panel border-border/80 rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-white">Unified Change Intelligence Audit</h3>
                <p className="text-xs text-muted mt-1">
                  Chronological trail of code pushes, database migrations, configuration changes, and daemon restarts.
                </p>
              </div>

              <div className="relative pl-6 border-l-2 border-border/80 space-y-6">
                {filteredChanges.map((change) => {
                  return (
                    <div key={change.id} className="relative group">
                      {/* Timeline Node Dot */}
                      <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-surface border-2 border-primary group-hover:scale-125 transition-transform" />

                      <div className="p-4 rounded-xl bg-surface/50 border border-border/80 hover:border-border hover:bg-surface/70 transition-all space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                change.category === 'DEPLOYMENT'
                                  ? 'primary'
                                  : change.category === 'SCHEMA_MIGRATION'
                                  ? 'warning'
                                  : 'mono'
                              }
                            >
                              {change.category}
                            </Badge>
                            <span className="font-bold text-white text-sm font-mono">
                              {change.target_resource}
                            </span>
                            <span className="text-[11px] font-mono text-muted bg-surface px-2 py-0.5 rounded border border-border">
                              {change.environment}
                            </span>
                          </div>

                          <div className="text-xs font-mono text-muted flex items-center gap-1.5">
                            <Calendar size={13} />
                            {new Date(change.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </div>
                        </div>

                        <p className="text-xs text-text-dim leading-relaxed">{change.description}</p>

                        <div className="text-[11px] font-mono text-muted pt-1 flex items-center gap-2">
                          <span>Triggered by:</span>
                          <span className="text-primary-light font-semibold">{change.actor}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Record Deployment Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel border-border max-w-md w-full rounded-2xl p-6 space-y-5 animate-scale-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Rocket size={18} className="text-primary-light" />
                Record Release Rollout
              </h3>
              <button onClick={() => setShowDeployModal(false)} className="text-muted hover:text-white text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordDeploy} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Service Identifier</label>
                <input
                  type="text"
                  required
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-white text-sm focus:border-primary focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Version / Tag</label>
                  <input
                    type="text"
                    required
                    value={newVersion}
                    onChange={(e) => setNewVersion(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-white text-sm focus:border-primary focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Commit SHA</label>
                  <input
                    type="text"
                    required
                    value={newCommitSha}
                    onChange={(e) => setNewCommitSha(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-white text-sm focus:border-primary focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Commit Message / Title</label>
                <input
                  type="text"
                  required
                  value={newCommitMsg}
                  onChange={(e) => setNewCommitMsg(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-white text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Author</label>
                  <input
                    type="text"
                    required
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-white text-sm focus:border-primary focus:outline-none font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Environment</label>
                  <select
                    value={newEnv}
                    onChange={(e) => setNewEnv(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-white text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="Production">Production</option>
                    <option value="Staging">Staging</option>
                    <option value="Development">Development</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeployModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-white bg-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary-hover shadow-glow-primary transition-all disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Broadcast Deployment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
