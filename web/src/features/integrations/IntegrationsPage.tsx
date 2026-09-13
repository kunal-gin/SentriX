import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { 
  Bell, Shield, RefreshCw, Send, CheckCircle2, AlertTriangle, 
  RotateCw, Webhook, MessageSquare, Mail, Play, Radio
} from 'lucide-react';
import { MetricCard, EmptyState, LoadingState } from '../../components/ui/Primitives';

interface IntegrationChannel {
  id: string;
  name: string;
  type: string;
  status: string;
  target_endpoint: string;
  events_subscribed: string[];
  secret_header: string;
  success_count: number;
  failure_count: number;
  last_dispatched_at?: string;
  created_at: string;
}

interface DeadLetterItem {
  id: string;
  event_id: string;
  integration_id: string;
  integration_name: string;
  event_type: string;
  payload_summary: string;
  attempts: number;
  last_error: string;
  created_at: string;
  replayed_at?: string;
  status: string;
}

export const IntegrationsPage: React.FC = () => {
  const [integrations, setIntegrations] = useState<IntegrationChannel[]>([]);
  const [dlq, setDlq] = useState<DeadLetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'channels' | 'dlq'>('channels');
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [intRes, dlqRes] = await Promise.all([
        api.get('/integrations'),
        api.get('/notifications/dlq'),
      ]);
      setIntegrations(intRes.data);
      setDlq(dlqRes.data);
    } catch (err) {
      console.error('Failed to load integrations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTestIntegration = async (id: string) => {
    try {
      setTestingChannel(id);
      const res = await api.post('/integrations/test', { id });
      setTestResult(`Test ping delivered successfully: ${res.data.message}`);
      fetchData();
    } catch (err: any) {
      alert('Test failed: ' + err.message);
    } finally {
      setTestingChannel(null);
    }
  };

  const handleReplayDLQ = async (id: string) => {
    try {
      setReplayingId(id);
      await api.post(`/notifications/dlq/${id}/replay`);
      fetchData();
    } catch (err: any) {
      alert('Replay failed: ' + err.message);
    } finally {
      setReplayingId(null);
    }
  };

  const totalDispatches = integrations.reduce((acc, i) => acc + i.success_count, 0);
  const totalFailures = integrations.reduce((acc, i) => acc + i.failure_count, 0);
  const pendingDLQ = dlq.filter(d => d.status === 'PENDING_RETRY').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Integrations & Notification Engine</h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
              HMAC SHA-256 Webhooks & DLQ
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Dispatch alerts and incident events across Slack, Microsoft Teams, PagerDuty, and enterprise SIEM webhooks with exponential retry and Dead Letter Queue.
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

      {testResult && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{testResult}</span>
          </div>
          <button onClick={() => setTestResult(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Integrations"
          value={integrations.length}
          subtitle="Operational Channels"
          icon={<Bell className="w-5 h-5 text-purple-400" />}
        />
        <MetricCard
          title="Successful Deliveries"
          value={totalDispatches.toLocaleString()}
          subtitle="Real-time Dispatch Events"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
        />
        <MetricCard
          title="DLQ Pending Replay"
          value={pendingDLQ}
          subtitle="Failed After Retries"
          icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
        />
        <MetricCard
          title="Security Guarantee"
          value="HMAC SHA-256"
          subtitle="Signed Payload Headers"
          icon={<Shield className="w-5 h-5 text-blue-400" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#232730] pb-2">
        <button
          onClick={() => setActiveTab('channels')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'channels'
              ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
              : 'text-gray-400 hover:text-white hover:bg-[#181c23]'
          }`}
        >
          Notification Channels ({integrations.length})
        </button>
        <button
          onClick={() => setActiveTab('dlq')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'dlq'
              ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
              : 'text-gray-400 hover:text-white hover:bg-[#181c23]'
          }`}
        >
          Dead Letter Queue (DLQ) ({dlq.length})
        </button>
      </div>

      {loading ? (
        <LoadingState message="Connecting to event dispatch engine and dead letter queue..." />
      ) : activeTab === 'channels' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map(ch => (
            <div key={ch.id} className="bg-[#13161b] border border-[#232730] hover:border-[#2e3440] rounded-xl p-5 space-y-4 shadow-xl transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {ch.type === 'SLACK' ? <MessageSquare className="w-4 h-4 text-emerald-400" /> :
                     ch.type === 'PAGERDUTY' ? <Radio className="w-4 h-4 text-rose-400" /> :
                     ch.type === 'TEAMS' ? <MessageSquare className="w-4 h-4 text-blue-400" /> :
                     <Webhook className="w-4 h-4 text-purple-400" />}
                    <h3 className="font-semibold text-white text-sm">{ch.name}</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1f242e] text-gray-400 uppercase">
                    {ch.type}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {ch.status}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <span className="text-gray-500 font-mono text-[11px]">Endpoint:</span>
                <div className="font-mono text-gray-300 bg-[#171a21] p-2 rounded border border-[#232730] truncate" title={ch.target_endpoint}>
                  {ch.target_endpoint}
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <span className="text-gray-500 font-mono text-[11px]">Events Subscribed:</span>
                <div className="flex flex-wrap gap-1.5">
                  {ch.events_subscribed.map((ev, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {ev}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-[#1e222a]">
                <span>Delivered: <strong className="text-white font-mono">{ch.success_count}</strong></span>
                <span>Failures: <strong className={ch.failure_count > 0 ? 'text-amber-400 font-mono' : 'text-gray-400 font-mono'}>{ch.failure_count}</strong></span>
                <span>Last: {ch.last_dispatched_at ? new Date(ch.last_dispatched_at).toLocaleTimeString() : 'Never'}</span>
              </div>

              <button
                onClick={() => handleTestIntegration(ch.id)}
                disabled={testingChannel === ch.id}
                className="w-full py-2 bg-[#1b1e24] hover:bg-[#252932] border border-[#2e3440] text-gray-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Send className={`w-3.5 h-3.5 ${testingChannel === ch.id ? 'animate-spin' : ''}`} />
                <span>{testingChannel === ch.id ? 'Sending Ping...' : 'Send Test Notification'}</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* DLQ Table */
        <div className="bg-[#13161b] border border-[#232730] rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-[#171a21] text-xs uppercase tracking-wider text-gray-400 border-b border-[#232730]">
                <tr>
                  <th className="px-6 py-3 font-medium">Event ID & Channel</th>
                  <th className="px-6 py-3 font-medium">Event Type</th>
                  <th className="px-6 py-3 font-medium">Payload Summary</th>
                  <th className="px-6 py-3 font-medium">Attempts</th>
                  <th className="px-6 py-3 font-medium">Last Delivery Error</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e222a]">
                {dlq.map(d => (
                  <tr key={d.id} className="hover:bg-[#181c23] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs font-semibold text-white">{d.event_id}</div>
                      <div className="text-xs text-gray-400">{d.integration_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {d.event_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-300 max-w-xs truncate" title={d.payload_summary}>
                      {d.payload_summary}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">
                      {d.attempts} / 3
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-rose-400 max-w-xs truncate" title={d.last_error}>
                      {d.last_error}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.status === 'REPLAYED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleReplayDLQ(d.id)}
                        disabled={replayingId === d.id}
                        className="px-2.5 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded flex items-center gap-1.5 ml-auto transition-colors"
                      >
                        <RotateCw className={`w-3 h-3 ${replayingId === d.id ? 'animate-spin' : ''}`} />
                        <span>{replayingId === d.id ? 'Replaying...' : 'Replay'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
