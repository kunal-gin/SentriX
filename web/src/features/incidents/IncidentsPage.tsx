import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useIncidents, Incident } from '../../hooks/useAlerts';
import {
  AlertTriangle,
  AlertOctagon,
  Clock,
  Server as ServerIcon,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  Search,
  Filter,
} from 'lucide-react';

function formatDuration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const seconds = Math.max(0, Math.floor((end - start) / 1000));

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function IncidentsPage() {
  const [status, setStatus] = useState<'open' | 'all'>('open');
  const [search, setSearch] = useState('');
  const { data: incidents, isLoading } = useIncidents(status);

  const filteredIncidents = (incidents || []).filter((inc) => {
    if (
      search &&
      !inc.title.toLowerCase().includes(search.toLowerCase()) &&
      !inc.server_name.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const openCount = (incidents || []).filter((i) => i.status !== 'RESOLVED').length;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header & Incident Command Center */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Incident Response Center
            {openCount > 0 ? (
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-critical/20 text-critical border border-critical/30 animate-pulse">
                {openCount} Active
              </span>
            ) : (
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-healthy/20 text-healthy border border-healthy/30">
                All Clear
              </span>
            )}
          </h1>
          <p className="text-sm text-muted mt-1">
            Automated alerts escalation, triage lifecycle, and post-mortem discussion.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-surface/70 p-1 rounded-xl border border-border">
          <button
            onClick={() => setStatus('open')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
              status === 'open'
                ? 'bg-primary text-white shadow-glow-primary'
                : 'text-muted hover:text-white'
            }`}
          >
            ACTIVE INCIDENTS
          </button>
          <button
            onClick={() => setStatus('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
              status === 'all'
                ? 'bg-primary text-white shadow-glow-primary'
                : 'text-muted hover:text-white'
            }`}
          >
            HISTORY / ALL
          </button>
        </div>
      </div>

      {/* Incidents List Container */}
      <div className="glass-card rounded-2xl border border-border overflow-hidden shadow-glass">
        {/* Search Toolbar */}
        <div className="p-4 border-b border-border bg-surface/40 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={14} />
            <input
              type="text"
              placeholder="Search incidents or node names..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background/80 border border-border focus:border-primary/50 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
            />
          </div>
          <div className="text-xs text-muted font-mono hidden sm:block">
            Showing {filteredIncidents.length} incident records
          </div>
        </div>

        {/* Incidents List */}
        <div className="divide-y divide-border/60">
          {isLoading && (
            <div className="py-16 text-center text-muted text-xs font-mono">
              Loading incidents catalog...
            </div>
          )}

          {!isLoading && filteredIncidents.length === 0 && (
            <div className="py-16 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-healthy/10 text-healthy border border-healthy/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-base font-semibold text-white">No Incidents Detected</h3>
              <p className="text-xs text-muted max-w-md mx-auto">
                All monitoring rules and threshold conditions are within nominal tolerances.
              </p>
            </div>
          )}

          {filteredIncidents.map((incident) => {
            const isCritical = incident.severity === 'CRITICAL';
            const isWarning = incident.severity === 'WARNING';
            const isResolved = incident.status === 'RESOLVED';
            const isAcknowledged = incident.status === 'ACKNOWLEDGED';

            return (
              <div
                key={incident.id}
                className="p-5 hover:bg-surface-elevated/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div className="flex items-start gap-4">
                  {/* Severity Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border mt-0.5 ${
                      isResolved
                        ? 'bg-healthy/15 text-healthy border-healthy/30'
                        : isCritical
                        ? 'bg-critical/15 text-critical border-critical/30 shadow-glow-critical'
                        : 'bg-warning/15 text-warning border-warning/30 shadow-glow-warning'
                    }`}
                  >
                    {isResolved ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <AlertTriangle size={20} />
                    )}
                  </div>

                  {/* Incident Info */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase border ${
                          isResolved
                            ? 'bg-healthy/10 text-healthy border-healthy/20'
                            : isCritical
                            ? 'bg-critical/20 text-critical border-critical/30'
                            : 'bg-warning/20 text-warning border-warning/30'
                        }`}
                      >
                        {incident.severity}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase border ${
                          isResolved
                            ? 'bg-surface text-muted border-border'
                            : isAcknowledged
                            ? 'bg-warning/10 text-warning border-warning/20'
                            : 'bg-critical/10 text-critical border-critical/20 animate-pulse'
                        }`}
                      >
                        {incident.status}
                      </span>
                      <span className="text-xs text-muted font-mono">
                        Started {formatDuration(incident.started_at, incident.resolved_at)} ago
                      </span>
                    </div>

                    <Link
                      to={`/incidents/${incident.id}`}
                      className="text-base font-semibold text-white hover:text-primary-light transition-colors block"
                    >
                      {incident.title}
                    </Link>

                    <div className="flex items-center gap-2 text-xs text-muted font-mono">
                      <ServerIcon size={12} className="text-primary-light" />
                      <span className="text-white">{incident.server_name}</span>
                    </div>
                  </div>
                </div>

                {/* Right Action */}
                <div className="flex items-center gap-3 self-end md:self-center">
                  <Link
                    to={`/incidents/${incident.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface border border-border hover:border-primary text-xs font-semibold text-muted hover:text-white transition-all shadow-sm group-hover:shadow-glow-primary"
                  >
                    <span>Timeline & Triage</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
