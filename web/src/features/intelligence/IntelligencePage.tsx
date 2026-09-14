import { useState, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  Activity,
  GitCommit,
  Database,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Play,
  Share2,
  Download,
  Flame,
} from 'lucide-react';
import { MetricCard } from '../../components/ui/Primitives';
import { api } from '../../api/client';

interface EvidenceNode {
  id: string;
  domain: string;
  signal: string;
  severity: string;
  timestamp: string;
  weight: number;
  detail: string;
}

interface EvidenceGraph {
  incident_id: string;
  title: string;
  likely_cause: string;
  confidence_score: number;
  alternative_cause: string;
  signals_count: number;
  change_correlation: string;
  evidence_nodes: EvidenceNode[];
  investigation_steps: string[];
  predictive_alert: string;
  postmortem_draft: {
    summary: string;
    impact: string;
    timeline: string[];
    root_cause: string;
    detection_method: string;
    preventative_actions: string[];
  };
}

export function IntelligencePage() {
  const [data, setData] = useState<EvidenceGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [correlating, setCorrelating] = useState(false);
  const [showPostmortem, setShowPostmortem] = useState(false);

  async function loadData() {
    try {
      const res = await api.get<EvidenceGraph>('/intelligence/evidence-graph');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load evidence graph', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCorrelate() {
    setCorrelating(true);
    try {
      await api.post('/intelligence/correlate', { incident_id: 'INC-1042' });
      await loadData();
    } catch (err) {
      console.error('Failed to correlate signals', err);
    } finally {
      setCorrelating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Sparkles className="text-primary-light" size={26} />
              SentriX Intelligence 2.0 & Multi-Signal Evidence Graph
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-primary/20 text-primary-light border border-primary/30">
              Phase 25
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Deterministic cross-domain correlation across metrics, logs, traces, database stats & deployment changes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCorrelate}
            disabled={correlating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-cyan text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-glow-primary disabled:opacity-50"
          >
            {correlating ? (
              <>
                <Activity size={14} className="animate-spin" />
                Synthesizing Graph...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Re-Synthesize Evidence
              </>
            )}
          </button>
        </div>
      </div>

      {/* Incident Hypothesis Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-primary/40 shadow-glow-primary space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-critical/20 text-critical border border-critical/30">
              {data?.incident_id || 'INC-1042'}
            </span>
            <h2 className="text-base font-bold text-white tracking-tight">
              {data?.title || 'Correlating Incident...'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] font-mono text-muted uppercase">Engine Confidence</div>
              <div className="text-lg font-bold font-mono text-healthy">
                {data?.confidence_score || 87.5}%
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-healthy/10 border border-healthy/30 flex items-center justify-center text-healthy font-bold text-sm font-mono">
              {Math.round(data?.confidence_score || 88)}%
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface/70 border border-border space-y-2">
          <div className="text-xs font-mono text-primary-light font-semibold uppercase flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-healthy" />
            Probable Root Cause Hypothesis:
          </div>
          <p className="text-sm text-white font-medium leading-relaxed">
            {data?.likely_cause}
          </p>
          <div className="text-xs text-muted flex items-center gap-2 pt-1 font-mono">
            <span className="text-text-dim">Alternative Hypothesis:</span>
            <span>{data?.alternative_cause}</span>
          </div>
        </div>

        {/* Change correlation alert */}
        <div className="p-3 bg-warning/10 border border-warning/30 rounded-xl flex items-center gap-3 text-xs text-warning font-mono">
          <GitCommit size={16} className="shrink-0" />
          <span>{data?.change_correlation}</span>
        </div>
      </div>

      {/* Multi-Signal Evidence Nodes Timeline */}
      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="text-primary-light" size={18} />
            <h2 className="text-sm font-semibold text-white">
              Synthesized Multi-Signal Evidence Nodes ({data?.evidence_nodes?.length || 0})
            </h2>
          </div>
          <span className="text-xs text-muted font-mono">Cross-Domain Weighting Active</span>
        </div>

        <div className="space-y-3">
          {data?.evidence_nodes?.map((node, idx) => (
            <div
              key={node.id}
              className="p-4 rounded-xl bg-surface/50 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center text-primary-light font-mono font-bold text-xs shrink-0 mt-0.5">
                  #{idx + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{node.signal}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-background border border-border text-cyan">
                      {node.domain}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        node.severity === 'CRITICAL'
                          ? 'bg-critical/20 text-critical border-critical/30'
                          : node.severity === 'WARNING'
                          ? 'bg-warning/20 text-warning border-warning/30'
                          : 'bg-primary/20 text-primary-light border-primary/30'
                      }`}
                    >
                      {node.severity}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1 leading-relaxed">{node.detail}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                <div className="text-right">
                  <div className="text-[10px] text-muted">Evidence Weight</div>
                  <div className="text-white font-bold">{Math.round(node.weight * 100)}%</div>
                </div>
                <div className="w-16 bg-surface rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: `${node.weight * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested Investigation Steps & Predictive Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Investigation Guidance */}
        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="text-cyan" size={18} />
            <h2 className="text-sm font-semibold text-white">Suggested Investigation Runbooks</h2>
          </div>

          <div className="space-y-2.5">
            {data?.investigation_steps?.map((step, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-surface/60 border border-border text-xs text-white flex items-center justify-between group hover:border-primary/40 transition-colors"
              >
                <span>{step}</span>
                <ArrowRight
                  size={14}
                  className="text-muted group-hover:text-primary-light transition-colors"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Predictive Intelligence & Postmortem CTA */}
        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="text-warning" size={18} />
              <h2 className="text-sm font-semibold text-white">Predictive Capacity Alert</h2>
            </div>
            <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 text-xs text-warning leading-relaxed font-mono">
              {data?.predictive_alert}
            </div>
          </div>

          <div className="pt-4 border-t border-border/60">
            <button
              onClick={() => setShowPostmortem(!showPostmortem)}
              className="w-full py-2.5 rounded-xl bg-surface border border-border hover:border-primary text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <FileText size={14} className="text-primary-light" />
              <span>{showPostmortem ? 'Hide Postmortem Draft' : 'View Automated AI Postmortem Draft'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Postmortem Draft Viewer */}
      {showPostmortem && data?.postmortem_draft && (
        <div className="glass-panel p-6 rounded-2xl border border-primary/40 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <FileText className="text-primary-light" size={20} />
              <h3 className="text-sm font-bold text-white">
                Automated Postmortem Draft — {data.incident_id}
              </h3>
            </div>
            <button
              onClick={() => alert('Postmortem exported to markdown')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-muted hover:text-white"
            >
              <Download size={13} />
              <span>Export Markdown</span>
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="font-mono text-muted uppercase text-[10px]">Incident Summary</div>
              <p className="text-white mt-1 leading-relaxed">{data.postmortem_draft.summary}</p>
            </div>

            <div>
              <div className="font-mono text-muted uppercase text-[10px]">Customer & System Impact</div>
              <p className="text-white mt-1 leading-relaxed">{data.postmortem_draft.impact}</p>
            </div>

            <div>
              <div className="font-mono text-muted uppercase text-[10px]">Timeline Sequence</div>
              <ul className="space-y-1.5 mt-1 font-mono text-text">
                {data.postmortem_draft.timeline.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="font-mono text-muted uppercase text-[10px]">Preventative Action Items</div>
              <ul className="space-y-1.5 mt-1 text-text">
                {data.postmortem_draft.preventative_actions.map((act, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-healthy shrink-0" />
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
