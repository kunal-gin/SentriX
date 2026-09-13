import { FormEvent, useState } from 'react';
import { useServices, useCreateService, ServiceEntity } from '../../hooks/useServices';
import {
  Layers,
  Plus,
  Server as ServerIcon,
  ShieldCheck,
  AlertTriangle,
  GitBranch,
  User,
  Users,
  ExternalLink,
  Search,
  Activity,
  CheckCircle2,
  AlertOctagon,
} from 'lucide-react';
import { Badge } from '../../components/ui/Primitives';

export function ServicesPage() {
  const { data: services, isLoading } = useServices();
  const createService = useCreateService();

  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState('Production');
  const [tier, setTier] = useState('Tier 1 (Mission Critical)');
  const [criticality, setCriticality] = useState('High');
  const [owner, setOwner] = useState('');
  const [team, setTeam] = useState('');
  const [repository, setRepository] = useState('');

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    await createService.mutateAsync({
      name,
      description,
      environment,
      tier,
      criticality,
      owner: owner || 'Platform Team',
      team: team || 'Core Engineering',
      repository: repository || 'github.com/sentrix/service',
      server_count: 2,
    });
    setName('');
    setDescription('');
    setShowModal(false);
  }

  const filtered = (services || []).filter((s) => {
    if (envFilter !== 'ALL' && s.environment !== envFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.team.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Service Catalog & Ownership
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary/20 text-primary-light border border-primary/30">
              {services?.length ?? 0} Services
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Service-centric catalog linking microservices, environments, tiers, and host fleets.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary transition-all self-start sm:self-auto"
        >
          <Plus size={15} />
          <span>Register Service</span>
        </button>
      </div>

      {/* Toolbar & Environment Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {['ALL', 'Production', 'Staging', 'Development'].map((env) => (
            <button
              key={env}
              onClick={() => setEnvFilter(env)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                envFilter === env
                  ? 'bg-primary text-white shadow-glow-primary'
                  : 'bg-surface text-muted hover:text-white border border-border'
              }`}
            >
              {env}
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
          <input
            type="text"
            placeholder="Search service catalog..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-border focus:border-primary rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-muted focus:outline-none"
          />
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {isLoading && (
          <div className="col-span-full py-16 text-center text-muted font-mono text-xs">
            Loading service catalog...
          </div>
        )}

        {filtered.map((service) => {
          const isHealthy = service.health === 'HEALTHY';
          const isDegraded = service.health === 'DEGRADED';

          return (
            <div
              key={service.id}
              className="glass-card-interactive rounded-2xl p-6 border border-border flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-primary-light">
                      {service.environment}
                    </span>
                    <span className="text-[10px] font-mono text-text-dim">
                      {service.tier}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      isHealthy
                        ? 'bg-healthy/15 text-healthy border-healthy/30'
                        : isDegraded
                        ? 'bg-warning/15 text-warning border-warning/30 animate-pulse'
                        : 'bg-critical/15 text-critical border-critical/30'
                    }`}
                  >
                    {isHealthy ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                    {service.health}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-primary-light transition-colors">
                    {service.name}
                  </h3>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    {service.description}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-background/60 border border-border/80 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div>
                    <div className="text-[10px] text-muted">Availability</div>
                    <div className="font-bold text-healthy mt-0.5">{service.uptime}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted">Nodes</div>
                    <div className="font-bold text-white mt-0.5">{service.server_count} instances</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted">Active Incidents</div>
                    <div
                      className={`font-bold mt-0.5 ${
                        service.incident_count > 0 ? 'text-critical' : 'text-muted'
                      }`}
                    >
                      {service.incident_count}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border/70 flex items-center justify-between text-[11px] font-mono text-muted">
                <div className="flex items-center gap-1.5 text-text-dim truncate">
                  <User size={12} className="text-primary-light" />
                  <span>{service.owner}</span>
                  <span className="text-border">•</span>
                  <span>{service.team}</span>
                </div>

                {service.repository && (
                  <span className="flex items-center gap-1 text-primary-light hover:underline truncate max-w-[150px]">
                    <GitBranch size={12} />
                    <span>{service.repository.replace('github.com/', '')}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Register Service Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-card rounded-2xl p-6 border border-primary/40 shadow-glow-primary max-w-lg w-full space-y-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers size={18} className="text-primary-light" />
              <span>Register Microservice in Catalog</span>
            </h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted mb-1">Service Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Invoicing & Billing Engine"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Role, primary responsibilities, and architecture..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-muted mb-1">Environment</label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="Production">Production</option>
                    <option value="Staging">Staging</option>
                    <option value="Development">Development</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted mb-1">Tier</label>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="Tier 1 (Mission Critical)">Tier 1 (Mission Critical)</option>
                    <option value="Tier 2 (Standard)">Tier 2 (Standard)</option>
                    <option value="Tier 3 (Auxiliary)">Tier 3 (Auxiliary)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-muted mb-1">Owner</label>
                  <input
                    type="text"
                    placeholder="e.g. Alex Rivera"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted mb-1">Engineering Team</label>
                  <input
                    type="text"
                    placeholder="e.g. Core SRE"
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Git Repository</label>
                <input
                  type="text"
                  placeholder="github.com/sentrix/billing-service"
                  value={repository}
                  onChange={(e) => setRepository(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
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
                  disabled={createService.isPending}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary"
                >
                  {createService.isPending ? 'Registering...' : 'Register Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
