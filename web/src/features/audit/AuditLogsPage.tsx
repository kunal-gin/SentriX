import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJSON } from '../../lib/api';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Clock,
  User,
  Globe,
  ChevronDown,
  ChevronUp,
  FileCode,
  Tag,
  Key,
  Trash2,
  PlusCircle,
  LogIn,
  Sliders,
} from 'lucide-react';

interface AuditLog {
  id: string;
  actor_id?: string;
  actor_email?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string;
  details: Record<string, any>;
  created_at: string;
}

function ActionBadge({ action }: { action: string }) {
  let color = 'bg-primary/20 text-primary-light border-primary/30';
  let Icon = ShieldCheck;

  if (action.includes('LOGIN')) {
    color = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    Icon = LogIn;
  } else if (action.includes('DELETE') || action.includes('REVOKE') || action.includes('DECOMMISSION')) {
    color = 'bg-critical/15 text-critical border-critical/30';
    Icon = Trash2;
  } else if (action.includes('SILENCE') || action.includes('MAINTENANCE')) {
    color = 'bg-warning/15 text-warning border-warning/30';
    Icon = Sliders;
  } else if (action.includes('CREATE') || action.includes('ENROLL')) {
    color = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    Icon = PlusCircle;
  } else if (action.includes('TOKEN')) {
    color = 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    Icon = Key;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium border ${color}`}>
      <Icon size={12} />
      <span>{action}</span>
    </span>
  );
}

export function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: logs, isLoading, refetch, isFetching } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs'],
    queryFn: () => fetchJSON<AuditLog[]>('/audit-logs'),
    refetchInterval: 10000,
  });

  const filteredLogs = logs?.filter((log) => {
    const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;
    const matchesSearch =
      search === '' ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.actor_email?.toLowerCase().includes(search.toLowerCase()) ||
      log.ip_address?.toLowerCase().includes(search.toLowerCase()) ||
      log.resource_type?.toLowerCase().includes(search.toLowerCase());

    return matchesAction && matchesSearch;
  });

  const uniqueActions = ['ALL', ...Array.from(new Set(logs?.map((l) => l.action) || []))];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Audit Logs & Compliance</span>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary/20 text-primary-light border border-primary/30">
              {filteredLogs?.length ?? 0} Events
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Immutable tamper-evident security audit trail for user actions, API credentials, and server changes.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border hover:border-border-strong text-xs text-muted hover:text-white transition-all shadow-sm group"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin text-primary' : 'group-hover:rotate-180 transition-transform duration-500'} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 glass-card p-3 rounded-2xl border border-border">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search by action, email, resource, or IP address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-xs text-white placeholder-muted focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Tag size={13} className="text-muted ml-1 hidden sm:inline" />
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="bg-background border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary transition-colors"
          >
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act === 'ALL' ? 'All Action Types' : act}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-card rounded-2xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-muted">Loading audit entries...</div>
        ) : filteredLogs?.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ShieldCheck size={32} className="mx-auto text-muted/50" />
            <p className="text-sm font-semibold text-white">No audit records found</p>
            <p className="text-xs text-muted">No security events match the current filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface border-b border-border text-muted font-mono uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Target Resource</th>
                  <th className="px-5 py-3">Client IP</th>
                  <th className="px-5 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs?.map((log) => {
                  const isExpanded = expandedRow === log.id;
                  const date = new Date(log.created_at);

                  return (
                    <tr key={log.id} className="hover:bg-surface/50 transition-colors group">
                      <td className="px-5 py-3.5 font-mono text-muted whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-white/90">
                          <Clock size={12} className="text-muted" />
                          <span>{date.toLocaleTimeString()}</span>
                        </div>
                        <div className="text-[10px] text-muted/70 pl-4">{date.toLocaleDateString()}</div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono text-white/90">
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-muted" />
                          <span>{log.actor_email || 'System'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {log.resource_type ? (
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-muted">
                              {log.resource_type}
                            </span>
                            {log.resource_id && (
                              <div className="text-[10px] font-mono text-muted truncate max-w-[160px]" title={log.resource_id}>
                                {log.resource_id}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono text-muted">
                        <div className="flex items-center gap-1.5">
                          <Globe size={11} className="text-muted/60" />
                          <span>{log.ip_address || '127.0.0.1'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-border-strong text-muted hover:text-white transition-colors text-[11px]"
                        >
                          <FileCode size={12} />
                          <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                          {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Expanded Metadata Drawer */}
        {expandedRow && (
          <div className="p-5 bg-background/90 border-t border-border space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between text-muted text-[11px]">
              <span className="text-white font-semibold flex items-center gap-1.5">
                <FileCode size={13} className="text-primary-light" /> Event Payload (ID: {expandedRow})
              </span>
              <button onClick={() => setExpandedRow(null)} className="hover:text-white">
                Close
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-surface border border-border text-[11px] text-primary-light overflow-x-auto">
              {JSON.stringify(
                filteredLogs?.find((l) => l.id === expandedRow)?.details ?? {},
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
