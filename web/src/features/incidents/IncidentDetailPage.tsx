import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  useAcknowledgeIncident,
  useAddIncidentComment,
  useIncident,
  useInvestigateIncident,
  useResolveIncident,
  useSavePostmortem,
  useUpdateIncident,
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
  Search,
  Activity,
  FileText,
  Save,
  Check,
  Zap,
  Users,
  AlertOctagon,
  ChevronRight,
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
  const investigate = useInvestigateIncident();
  const resolve = useResolveIncident();
  const addComment = useAddIncidentComment();
  const savePostmortem = useSavePostmortem();
  const updateIncident = useUpdateIncident();

  const [commentBody, setCommentBody] = useState('');
  const [postmortemDraft, setPostmortemDraft] = useState('');
  const [rcaDraft, setRcaDraft] = useState('');
  const [assigneeDraft, setAssigneeDraft] = useState('');
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync draft states when incident loads
  if (incident && !postmortemDraft && incident.postmortem) {
    setPostmortemDraft(incident.postmortem);
  }
  if (incident && !rcaDraft && incident.rca_hypothesis) {
    setRcaDraft(incident.rca_hypothesis);
  }
  if (incident && !assigneeDraft && incident.assignee) {
    setAssigneeDraft(incident.assignee);
  }

  async function handleAcknowledge() {
    if (!incidentId) return;
    await acknowledge.mutateAsync({ incidentId });
  }

  async function handleInvestigate() {
    if (!incidentId) return;
    await investigate.mutateAsync({ incidentId });
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

  async function handleSaveRCA() {
    if (!incidentId) return;
    await savePostmortem.mutateAsync({
      incidentId,
      postmortem: postmortemDraft,
      rca_hypothesis: rcaDraft,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  }

  async function handleSaveAssignee() {
    if (!incidentId || !assigneeDraft.trim()) return;
    await updateIncident.mutateAsync({
      incidentId,
      payload: { assignee_name: assigneeDraft.trim() },
    });
    setEditingAssignee(false);
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center text-muted font-mono text-xs">
        Loading incident control center...
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 py-16 text-center">
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
  const isInvestigating = incident.status === 'INVESTIGATING';
  const isAcknowledged = incident.status === 'ACKNOWLEDGED';
  const isOpen = incident.status === 'OPEN';

  // Stepper calculations
  const steps = [
    { label: 'Trigger Detected', done: true, active: false },
    { label: 'Acknowledged', done: isAcknowledged || isInvestigating || isResolved, active: isOpen },
    { label: 'Investigation', done: isInvestigating || isResolved, active: isAcknowledged },
    { label: 'Mitigated / Resolved', done: isResolved, active: isInvestigating },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <Link
          to="/incidents"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-white transition-colors group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to All Incidents</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to={`/metrics?server=${incident.server_id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-elevated text-xs font-mono text-primary-light border border-border transition-colors"
          >
            <Activity size={13} />
            <span>Telemetry Multi-View</span>
          </Link>
        </div>
      </div>

      {/* Hero Incident Card */}
      <div className="glass-card rounded-2xl p-6 border border-border shadow-glass space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2.5">
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
                    : isInvestigating
                    ? 'bg-primary/20 text-primary-light border-primary/30'
                    : isAcknowledged
                    ? 'bg-warning/15 text-warning border-warning/30'
                    : 'bg-critical/15 text-critical border-critical/30 animate-pulse'
                }`}
              >
                {incident.status}
              </span>
              <span className="text-xs text-muted font-mono">
                Duration: {formatDuration(incident.started_at, incident.resolved_at)}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight">{incident.title}</h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted font-mono">
              <div className="flex items-center gap-1.5">
                <ServerIcon size={13} className="text-primary-light" />
                <span>Target:</span>
                <Link
                  to={`/servers/${incident.server_id}`}
                  className="text-white hover:text-primary-light underline"
                >
                  {incident.server_name}
                </Link>
              </div>

              {/* Assignee pill */}
              <div className="flex items-center gap-1.5">
                <Users size={13} className="text-primary-light" />
                <span>Assignee:</span>
                {editingAssignee ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={assigneeDraft}
                      onChange={(e) => setAssigneeDraft(e.target.value)}
                      placeholder="e.g. SRE Team"
                      className="bg-background border border-primary text-xs px-2 py-0.5 rounded text-white"
                    />
                    <button
                      onClick={handleSaveAssignee}
                      className="text-[10px] bg-primary px-2 py-0.5 rounded text-white font-bold"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <span
                    onClick={() => setEditingAssignee(true)}
                    className="text-primary-light hover:underline cursor-pointer"
                  >
                    {incident.assignee || 'Unassigned (Click to set)'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Triggers Bar */}
          <div className="flex flex-wrap items-center gap-2 self-start">
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

            {(isOpen || isAcknowledged) && (
              <button
                onClick={handleInvestigate}
                disabled={investigate.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/20 text-primary-light hover:bg-primary/30 border border-primary/30 text-xs font-semibold transition-all"
              >
                <Search size={14} />
                <span>Investigate</span>
              </button>
            )}

            {!isResolved && (
              <button
                onClick={handleResolve}
                disabled={resolve.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-healthy/20 text-healthy hover:bg-healthy/30 border border-healthy/30 text-xs font-semibold transition-all"
              >
                <CheckCircle2 size={14} />
                <span>Resolve Incident</span>
              </button>
            )}
          </div>
        </div>

        {/* Operational Lifecycle Stepper */}
        <div className="pt-4 border-t border-border/80">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {steps.map((s, idx) => (
              <div
                key={s.label}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-mono font-semibold transition-all ${
                  s.done
                    ? 'bg-healthy/10 border-healthy/30 text-healthy'
                    : s.active
                    ? 'bg-primary/10 border-primary/40 text-primary-light animate-pulse'
                    : 'bg-background/40 border-border/60 text-muted'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    s.done ? 'bg-healthy text-black' : 'bg-surface-elevated text-muted'
                  }`}
                >
                  {s.done ? '✓' : idx + 1}
                </div>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Timeline & RCA Postmortem */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Timeline and Discussion */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline Events Card */}
          <div className="glass-card rounded-2xl p-6 border border-border shadow-glass space-y-6">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Clock size={16} className="text-primary-light" />
              <span>Incident Operational Timeline</span>
            </h2>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {incident.timeline && incident.timeline.length > 0 ? (
                incident.timeline.map((event) => (
                  <div key={event.id} className="relative group">
                    <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-surface border-2 border-primary group-hover:border-primary-light transition-colors" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[11px] font-mono text-muted">
                        <span className="font-bold text-white px-1.5 py-0.2 rounded bg-surface border border-border">
                          {event.event_type}
                        </span>
                        <span>{new Date(event.created_at).toLocaleTimeString()}</span>
                        {event.actor_email && <span>• {event.actor_email}</span>}
                      </div>
                      <p className="text-xs text-text">{event.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted font-mono">No timeline events recorded yet.</div>
              )}
            </div>
          </div>

          {/* Discussion & Engineering Notes Card */}
          <div className="glass-card rounded-2xl p-6 border border-border shadow-glass space-y-6">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <MessageSquare size={16} className="text-primary-light" />
              <span>Triage Notes & Comments</span>
            </h2>

            <div className="space-y-4">
              {incident.comments && incident.comments.length > 0 ? (
                incident.comments.map((comm) => (
                  <div
                    key={comm.id}
                    className="p-4 rounded-xl bg-background/60 border border-border space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                      <span className="text-white font-semibold">
                        {comm.user_email || 'Engineer'}
                      </span>
                      <span>{new Date(comm.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-text leading-relaxed whitespace-pre-wrap">
                      {comm.body}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted font-mono py-2">
                  No engineering comments appended yet.
                </div>
              )}
            </div>

            {/* Append Note Form */}
            <form onSubmit={handleAddComment} className="space-y-3 pt-2">
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add mitigation updates, command output, or triage notes..."
                rows={3}
                className="w-full bg-background border border-border focus:border-primary/50 rounded-xl p-3 text-xs text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                required
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addComment.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary transition-all"
                >
                  <Send size={13} />
                  <span>{addComment.isPending ? 'Posting...' : 'Post Note'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Col: Root Cause Analysis & Postmortem */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 border border-border shadow-glass space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <FileText size={16} className="text-primary-light" />
                <span>Root Cause Analysis (RCA)</span>
              </h2>
              {savedSuccess && (
                <span className="text-[11px] font-mono text-healthy flex items-center gap-1">
                  <Check size={12} /> Saved
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted mb-1.5">
                  RCA Hypothesis & Evidence
                </label>
                <textarea
                  value={rcaDraft}
                  onChange={(e) => setRcaDraft(e.target.value)}
                  placeholder="State the technical trigger, evidence signals, and why anomaly occurred..."
                  rows={4}
                  className="w-full bg-background border border-border focus:border-primary/50 rounded-xl p-3 text-xs text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1.5">
                  Postmortem & Remediation Actions
                </label>
                <textarea
                  value={postmortemDraft}
                  onChange={(e) => setPostmortemDraft(e.target.value)}
                  placeholder="Preventive steps, architectural adjustments, or configuration changes..."
                  rows={6}
                  className="w-full bg-background border border-border focus:border-primary/50 rounded-xl p-3 text-xs text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveRCA}
                disabled={savePostmortem.isPending}
                className="w-full py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-highlight border border-border text-xs font-semibold text-white flex items-center justify-center gap-2 shadow-glass transition-all"
              >
                <Save size={13} className="text-primary-light" />
                <span>{savePostmortem.isPending ? 'Saving...' : 'Save RCA & Postmortem'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
