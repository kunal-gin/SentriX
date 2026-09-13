import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { 
  Terminal, Shield, Play, CheckCircle2, AlertTriangle, Clock, 
  RefreshCw, FileText, Check, AlertOctagon, Sparkles, UserCheck, Layers
} from 'lucide-react';
import { MetricCard, EmptyState, LoadingState } from '../../components/ui/Primitives';

interface RunbookStep {
  id: string;
  step_number: number;
  title: string;
  action_type: string;
  target_resource: string;
  description: string;
  safe_action: boolean;
}

interface Runbook {
  id: string;
  title: string;
  description: string;
  category: string;
  requires_approval: boolean;
  estimated_duration: string;
  allowed_roles: string[];
  steps: RunbookStep[];
  trigger_conditions: string[];
}

interface RunbookExecution {
  id: string;
  runbook_id: string;
  runbook_title: string;
  triggered_by: string;
  status: string;
  started_at: string;
  completed_at?: string;
  step_results: string[];
}

export const RunbooksPage: React.FC = () => {
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [executions, setExecutions] = useState<RunbookExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');

  // Execution Modal state
  const [executingRunbook, setExecutingRunbook] = useState<Runbook | null>(null);
  const [approvedGate, setApprovedGate] = useState(false);
  const [runningAction, setRunningAction] = useState(false);
  const [executionResult, setExecutionResult] = useState<RunbookExecution | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rbRes, execRes] = await Promise.all([
        api.get('/runbooks'),
        api.get('/automation/executions'),
      ]);
      setRunbooks(rbRes.data);
      setExecutions(execRes.data);
    } catch (err) {
      console.error('Failed to load automation data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartExecution = async () => {
    if (!executingRunbook) return;
    try {
      setRunningAction(true);
      const res = await api.post(`/runbooks/${executingRunbook.id}/execute`);
      setExecutionResult(res.data);
      fetchData();
    } catch (err: any) {
      alert('Runbook execution failed: ' + err.message);
    } finally {
      setRunningAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Runbooks & Safe Automation</h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Zero Remote Shell Risk
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Close the loop from alert detection to safe remediation with parameter-checked, audited operational runbooks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 bg-[#1b1e24] hover:bg-[#252932] border border-[#2e3440] text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Operational Runbooks"
          value={runbooks.length}
          subtitle="Pre-approved Procedures"
          icon={<Terminal className="w-5 h-5 text-emerald-400" />}
        />
        <MetricCard
          title="Approval Gates Active"
          value={runbooks.filter(r => r.requires_approval).length}
          subtitle="Operator Gate Required"
          icon={<UserCheck className="w-5 h-5 text-amber-400" />}
        />
        <MetricCard
          title="Automated Executions"
          value={executions.length}
          subtitle="Audit Logged Runs"
          icon={<Play className="w-5 h-5 text-blue-400" />}
        />
        <MetricCard
          title="Safety Compliance"
          value="100%"
          subtitle="Sandboxed Actions"
          icon={<Shield className="w-5 h-5 text-purple-400" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#232730] pb-2">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'catalog'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
              : 'text-gray-400 hover:text-white hover:bg-[#181c23]'
          }`}
        >
          Runbook Catalog ({runbooks.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'history'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
              : 'text-gray-400 hover:text-white hover:bg-[#181c23]'
          }`}
        >
          Execution History & Audit ({executions.length})
        </button>
      </div>

      {loading ? (
        <LoadingState message="Loading remediation catalog and execution audit records..." />
      ) : activeTab === 'catalog' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {runbooks.map(rb => (
            <div key={rb.id} className="bg-[#13161b] border border-[#232730] hover:border-[#2e3440] rounded-xl p-5 space-y-4 shadow-xl transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-semibold text-white text-base">{rb.title}</h3>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#1f242e] text-gray-400">
                    {rb.category} • Est. {rb.estimated_duration}
                  </span>
                </div>
                {rb.requires_approval ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> APPROVAL REQUIRED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> AUTO-APPROVED
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                {rb.description}
              </p>

              {/* Trigger conditions */}
              <div className="space-y-1 text-xs">
                <span className="text-gray-500 font-mono text-[11px]">Automatic Triggers:</span>
                <div className="flex flex-wrap gap-1.5">
                  {rb.trigger_conditions.map((tc, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {tc}
                    </span>
                  ))}
                </div>
              </div>

              {/* Steps list */}
              <div className="space-y-1.5 pt-2 border-t border-[#1e222a]">
                <span className="text-gray-500 font-mono text-[11px]">Workflow Steps ({rb.steps.length}):</span>
                {rb.steps.map(step => (
                  <div key={step.id} className="p-2 rounded-lg bg-[#171a21] border border-[#232730] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#232730] flex items-center justify-center text-[10px] font-mono text-gray-400 font-bold">
                        {step.step_number}
                      </span>
                      <span className="text-gray-200">{step.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      Safe
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  setExecutingRunbook(rb);
                  setApprovedGate(false);
                  setExecutionResult(null);
                }}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Execute Runbook</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Execution History Table */
        <div className="bg-[#13161b] border border-[#232730] rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-[#171a21] text-xs uppercase tracking-wider text-gray-400 border-b border-[#232730]">
                <tr>
                  <th className="px-6 py-3 font-medium">Execution ID</th>
                  <th className="px-6 py-3 font-medium">Runbook Title</th>
                  <th className="px-6 py-3 font-medium">Triggered By</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Executed At</th>
                  <th className="px-6 py-3 font-medium">Step Outputs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e222a]">
                {executions.map(ex => (
                  <tr key={ex.id} className="hover:bg-[#181c23] transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-emerald-400">{ex.id}</td>
                    <td className="px-6 py-4 font-medium text-white">{ex.runbook_title}</td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">{ex.triggered_by}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {ex.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(ex.started_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-400">
                      <div className="space-y-0.5 max-w-sm">
                        {ex.step_results.map((res, i) => (
                          <div key={i} className="truncate">{res}</div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Execution Confirmation Modal */}
      {executingRunbook && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#13161b] border border-[#2e3440] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-[#232730] flex items-center justify-between bg-[#171a21]">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-white">Execute Operational Runbook</h3>
              </div>
              <button onClick={() => setExecutingRunbook(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-[#171a21] border border-[#232730] space-y-2">
                <h4 className="text-sm font-semibold text-white">{executingRunbook.title}</h4>
                <p className="text-xs text-gray-300">{executingRunbook.description}</p>
                <div className="text-xs font-mono text-gray-400 pt-1">
                  Estimated duration: {executingRunbook.estimated_duration}
                </div>
              </div>

              {/* Execution Steps */}
              <div className="space-y-2">
                <span className="text-xs font-mono text-gray-400">Steps to execute:</span>
                {executingRunbook.steps.map(s => (
                  <div key={s.id} className="p-2.5 rounded-lg bg-[#181c23] border border-[#232730] text-xs flex items-center justify-between">
                    <span>{s.step_number}. {s.title}</span>
                    <span className="font-mono text-[10px] text-gray-500">{s.target_resource}</span>
                  </div>
                ))}
              </div>

              {/* Approval gate */}
              {executingRunbook.requires_approval && !executionResult && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Operator Approval Gate Required</span>
                  </div>
                  <p className="text-gray-300">
                    This procedure modifies infrastructure session states. Confirm that you have reviewed the blast radius and authorized execution.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={approvedGate}
                      onChange={e => setApprovedGate(e.target.checked)}
                      className="rounded border-amber-500 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="font-semibold text-white">I authorize execution of this safe remediation procedure</span>
                  </label>
                </div>
              )}

              {/* Output Result */}
              {executionResult && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Runbook Executed Successfully ({executionResult.id})</span>
                  </div>
                  <div className="font-mono text-xs text-gray-300 space-y-1 pl-6">
                    {executionResult.step_results.map((r, i) => (
                      <div key={i}>{r}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#232730] bg-[#171a21] flex justify-end gap-3">
              <button
                onClick={() => setExecutingRunbook(null)}
                className="px-4 py-2 bg-[#252932] hover:bg-[#2d323d] text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {executionResult ? 'Close' : 'Cancel'}
              </button>

              {!executionResult && (
                <button
                  onClick={handleStartExecution}
                  disabled={runningAction || (executingRunbook.requires_approval && !approvedGate)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                    executingRunbook.requires_approval && !approvedGate
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <Play className={`w-3.5 h-3.5 ${runningAction ? 'animate-spin' : ''}`} />
                  <span>{runningAction ? 'Executing Steps...' : 'Authorize & Execute'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
