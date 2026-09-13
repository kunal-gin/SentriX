import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  useAcknowledgeIncident,
  useAddIncidentComment,
  useIncident,
  useResolveIncident,
} from '../../hooks/useIncident';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Server as ServerIcon,
  MessageSquare,
  Send,
  UserCheck,
  ShieldAlert,
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

export function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const { user } = useAuth();

  const { data: incident, isLoading } = useIncident(incidentId);
  const acknowledge = useAcknowledgeIncident();
  const resolve = useResolveIncident();
  const addComment = useAddIncidentComment();

  const [commentBody, setCommentBody] = useState('');

  async function handleAcknowledge() {
    if (!incidentId) return;
    await acknowledge.mutateAsync({ incidentId });
  }

  async function handleResolve() {
    if (!incidentId) return;
    await resolve.mutateAsync({ incidentId });
  }

  async function handleAddComment(event: FormEvent) {
    event.preventDefault();
    if (!incidentId || !commentBody.trim()) return;

    await addComment.mutateAsync({
      incidentId,
      body: commentBody.trim(),
    });

    setCommentBody('');
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center text-muted font-mono text-xs">
        Loading incident stream...
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 py-16 text-center">
        <h2 className="text-xl font-bold text-white">Incident Not Found</h2>
        <p className="text-sm text-muted">The incident ID does not exist or has been purged.</p>
        <Link
          to="/incidents"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold shadow-glow-primary"
        >
          <ArrowLeft size={14} /> Back to Incidents
        </Link>
      </div>
    );
  }

  const isResolved = incident.status === 'RESOLVED';
  const isAcknowledged = incident.status === 'ACKNOWLEDGED';
  const isOpen = incident.status === 'OPEN';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Breadcrumb */}
      <div>
        <Link
          to="/incidents"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-white transition-colors group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to All Incidents</span>
        </Link>
      </div>

      {/* Hero Incident Card */}
      <div className="glass-card rounded-2xl p-6 border border-border shadow-glass space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                  incident.severity === 'CRITICAL'
                    ? 'bg-critical/15 text-critical border-critical/30 shadow-glow-critical'
                    : 'bg-warning/15 text-warning border-warning/30 shadow-glow-warning'
                }`}
              >
                {incident.severity}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                  isResolved
                    ? 'bg-healthy/15 text-healthy border-healthy/30'
                    : isAcknowledged
                    ? 'bg-warning/15 text-warning border-warning/30'
                    : 'bg-critical/15 text-critical border-critical/30'
                }`}
              >
                {incident.status}
              </span>
              <span className="text-xs text-muted font-mono">
                Duration: {formatDuration(incident.started_at, incident.resolved_at)}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight">{incident.title}</h1>

            <div className="flex items-center gap-2 text-xs text-muted font-mono">
              <ServerIcon size={13} className="text-primary-light" />
              <span>Target Node:</span>
              <Link
                to={`/servers/${incident.server_id}`}
                className="text-white hover:text-primary-light underline"
              >
                {incident.server_name}
              </Link>
            </div>
          </div>

          {/* Action Triggers */}
          <div className="flex items-center gap-2.5 self-start">
            {isOpen && (
              <button
                onClick={handleAcknowledge}
                disabled={acknowledge.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-warning/20 text-warning hover:bg-warning/30 border border-warning/30 text-xs font-semibold transition-all"
              >
                <UserCheck size={14} />
                <span>Acknowledge</span>
              </button>
            )}

            {!isResolved && (
              <button
                onClick={handleResolve}
                disabled={resolve.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-healthy text-white hover:bg-healthy/90 text-xs font-semibold shadow-glow-healthy transition-all"
              >
                <CheckCircle2 size={14} />
                <span>Resolve Incident</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Timeline & Comments Thread */}
      <div className="glass-card rounded-2xl p-6 border border-border shadow-glass space-y-6">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Clock size={16} className="text-primary-light" />
          <span>Incident Lifecycle Timeline</span>
        </h2>

        {/* Timeline Events */}
        <div className="space-y-6 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
          {/* Opened Event */}
          <div className="relative flex items-start gap-4 pl-1">
            <div className="w-6 h-6 rounded-full bg-critical flex items-center justify-center text-white z-10 shadow-glow-critical">
              <AlertTriangle size={12} />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-white">Incident Triggered</div>
              <div className="text-[11px] font-mono text-muted">
                {new Date(incident.started_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Acknowledged Event if present */}
          {incident.acknowledged_at && (
            <div className="relative flex items-start gap-4 pl-1">
              <div className="w-6 h-6 rounded-full bg-warning flex items-center justify-center text-white z-10 shadow-glow-warning">
                <UserCheck size={12} />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-white">Acknowledged by Operator</div>
                <div className="text-[11px] font-mono text-muted">
                  {new Date(incident.acknowledged_at).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Resolved Event if present */}
          {incident.resolved_at && (
            <div className="relative flex items-start gap-4 pl-1">
              <div className="w-6 h-6 rounded-full bg-healthy flex items-center justify-center text-white z-10 shadow-glow-healthy">
                <CheckCircle2 size={12} />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-white">Incident Resolved</div>
                <div className="text-[11px] font-mono text-muted">
                  {new Date(incident.resolved_at).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* User Comments / Notes */}
          {incident.comments?.map((comment: any, idx: number) => {
            const body = typeof comment === 'string' ? comment : comment.body;
            const author = comment.author_email || 'Operator';
            const created = comment.created_at ? new Date(comment.created_at).toLocaleString() : '';

            return (
              <div key={idx} className="relative flex items-start gap-4 pl-1">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white z-10 shadow-glow-primary">
                  <MessageSquare size={12} />
                </div>
                <div className="flex-1 p-3.5 rounded-xl bg-surface-elevated/70 border border-border space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{author}</span>
                    {created && <span className="font-mono text-[10px] text-muted">{created}</span>}
                  </div>
                  <p className="text-xs text-text leading-relaxed">{body}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Note / Comment Box */}
        <form onSubmit={handleAddComment} className="pt-4 border-t border-border space-y-3">
          <label className="block text-xs font-medium text-muted">
            Add Engineering Note or Root Cause Investigation
          </label>
          <div className="relative">
            <textarea
              rows={3}
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Document troubleshooting steps, actions taken, or observations..."
              className="w-full bg-background border border-border focus:border-primary rounded-xl p-3 text-xs text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!commentBody.trim() || addComment.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-semibold shadow-glow-primary transition-all"
            >
              <Send size={13} />
              <span>Post Note</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
