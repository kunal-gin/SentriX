import { FormEvent, useState } from 'react';
import { useServers } from '../../hooks/useDashboard';
import {
  CreateCheckInput,
  useChecks,
  useCreateCheck,
  useDeleteCheck,
} from '../../hooks/useChecks';
import {
  Activity,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Cpu,
  Server as ServerIcon,
  Wifi,
  Sliders,
} from 'lucide-react';

const checkTypes = [
  { key: 'PROCESS', label: 'Process Check', icon: Cpu, desc: 'Assert Linux process name is alive' },
  { key: 'SERVICE', label: 'Systemd Service', icon: Sliders, desc: 'Monitor systemctl active state' },
  { key: 'PORT', label: 'TCP Port Listener', icon: Wifi, desc: 'Probe TCP socket connectivity' },
  { key: 'COMMAND', label: 'Shell Command Exit', icon: Terminal, desc: 'Verify exit code & output' },
];

export function ChecksPage() {
  const { data: checks, isLoading: checksLoading } = useChecks();
  const { data: servers } = useServers();

  const createCheck = useCreateCheck();
  const deleteCheck = useDeleteCheck();

  const [showModal, setShowModal] = useState(false);
  const [serverId, setServerId] = useState('');
  const [type, setType] = useState('PROCESS');
  const [name, setName] = useState('');
  const [severity, setSeverity] = useState('WARNING');

  const [processName, setProcessName] = useState('');
  const [serviceUnit, setServiceUnit] = useState('');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(80);
  const [command, setCommand] = useState('');
  const [commandArgs, setCommandArgs] = useState('');

  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!serverId) {
      setError('Select a target infrastructure server node.');
      return;
    }

    let config: any = {};
    if (type === 'PROCESS') config = { process_name: processName };
    else if (type === 'SERVICE') config = { unit_name: serviceUnit };
    else if (type === 'PORT') config = { host, port: Number(port) };
    else if (type === 'COMMAND') {
      config = {
        command,
        args: commandArgs ? commandArgs.split(' ').filter(Boolean) : [],
      };
    }

    const payload: CreateCheckInput = {
      server_id: serverId,
      type,
      name,
      severity,
      enabled: true,
      interval_seconds: 15,
      timeout_seconds: 5,
      failure_threshold: 3,
      success_threshold: 1,
      config,
    };

    try {
      await createCheck.mutateAsync(payload);
      setShowModal(false);
      setName('');
      setProcessName('');
      setServiceUnit('');
      setCommand('');
    } catch {
      setError('Failed to deploy check to node.');
    }
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this health check?')) {
      await deleteCheck.mutateAsync(id);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Health & Synthetic Probes
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary/20 text-primary-light border border-primary/30">
              {checks?.length ?? 0} Probes
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Active synthetic monitoring of system processes, systemd daemons, open sockets, and command runs.
          </p>
        </div>

        <div>
          <button
            onClick={() => setShowModal(!showModal)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary transition-all"
          >
            <Plus size={15} />
            <span>Deploy Health Check</span>
          </button>
        </div>
      </div>

      {/* Deploy Check Drawer / Modal */}
      {showModal && (
        <div className="glass-card rounded-2xl p-6 border border-primary/40 shadow-glow-primary space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Activity size={16} className="text-primary-light" />
              <span>Deploy New Synthetic Probe</span>
            </h2>
            <button onClick={() => setShowModal(false)} className="text-xs text-muted hover:text-white">
              Cancel
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-critical/15 border border-critical/30 text-critical text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono text-muted mb-1">Target Node</label>
                <select
                  value={serverId}
                  onChange={(e) => setServerId(e.target.value)}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  required
                >
                  <option value="">Select target server...</option>
                  {(servers || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.hostname})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Probe Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {checkTypes.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Check Display Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Postgres Daemon Health"
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white placeholder-muted focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Type Specific Fields */}
            <div className="p-4 rounded-xl bg-background/60 border border-border">
              {type === 'PROCESS' && (
                <div>
                  <label className="block text-xs font-mono text-muted mb-1">Process Name</label>
                  <input
                    value={processName}
                    onChange={(e) => setProcessName(e.target.value)}
                    placeholder="e.g. sentrix-agent, nginx, redis-server"
                    className="w-full bg-surface border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    required
                  />
                </div>
              )}

              {type === 'SERVICE' && (
                <div>
                  <label className="block text-xs font-mono text-muted mb-1">Systemd Service Unit</label>
                  <input
                    value={serviceUnit}
                    onChange={(e) => setServiceUnit(e.target.value)}
                    placeholder="e.g. postgresql.service, docker.service"
                    className="w-full bg-surface border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    required
                  />
                </div>
              )}

              {type === 'PORT' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-muted mb-1">Host / Bind Address</label>
                    <input
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      className="w-full bg-surface border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-muted mb-1">Port</label>
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      className="w-full bg-surface border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              {type === 'COMMAND' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-mono text-muted mb-1">Executable Path</label>
                    <input
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="/usr/bin/uptime"
                      className="w-full bg-surface border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-muted mb-1">Arguments</label>
                    <input
                      value={commandArgs}
                      onChange={(e) => setCommandArgs(e.target.value)}
                      placeholder="-s"
                      className="w-full bg-surface border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createCheck.isPending}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary transition-all"
              >
                {createCheck.isPending ? 'Provisioning...' : 'Deploy Check Probe'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Checks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {checksLoading && (
          <div className="col-span-full py-16 text-center text-muted font-mono text-xs">
            Polling active health probes...
          </div>
        )}

        {!checksLoading && (checks || []).length === 0 && (
          <div className="col-span-full py-16 text-center glass-card rounded-2xl p-8 space-y-2">
            <Activity size={28} className="text-muted mx-auto mb-2" />
            <p className="text-base font-semibold text-white">No active synthetic probes</p>
            <p className="text-xs text-muted">Deploy a synthetic probe above to verify node services.</p>
          </div>
        )}

        {(checks || []).map((chk) => {
          const typeObj = checkTypes.find((t) => t.key === chk.type) || checkTypes[0];
          const TypeIcon = typeObj.icon;
          const isHealthy = chk.state === 'HEALTHY';

          return (
            <div
              key={chk.id}
              className="glass-card-interactive rounded-2xl p-5 border border-border flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-surface-highlight text-primary-light border border-border uppercase">
                      {chk.type}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        isHealthy
                          ? 'bg-healthy/15 text-healthy border-healthy/30 shadow-glow-healthy'
                          : 'bg-critical/15 text-critical border-critical/30'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isHealthy ? 'bg-healthy animate-pulse-glow' : 'bg-critical'
                        }`}
                      />
                      {chk.state || 'HEALTHY'}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDelete(chk.id)}
                    title="Delete Probe"
                    className="p-1 text-muted hover:text-critical hover:bg-critical/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Probe Title */}
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-primary-light transition-colors">
                    {chk.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted font-mono mt-1">
                    <ServerIcon size={12} className="text-primary-light" />
                    <span>{chk.server_name || 'Node: ' + chk.server_id?.substring(0, 8)}</span>
                  </div>
                </div>

                {/* Probe Output Snippet */}
                {chk.last_message && (
                  <div className="p-2.5 rounded-xl bg-background/80 border border-border font-mono text-[11px] text-text-dim truncate">
                    <span className="text-muted mr-1">$</span>
                    {chk.last_message}
                  </div>
                )}
              </div>

              {/* Meta details */}
              <div className="pt-3 border-t border-border/80 flex items-center justify-between text-[11px] font-mono text-muted">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> Interval: {chk.interval_seconds}s
                </span>
                <span className="text-healthy flex items-center gap-1 font-semibold">
                  <CheckCircle2 size={12} /> Nominal
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
