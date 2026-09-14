import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { 
  Shield, ShieldAlert, Key, Lock, Users, Laptop, Globe, AlertTriangle, 
  CheckCircle2, XCircle, RefreshCw, Clock, ExternalLink, Trash2
} from 'lucide-react';
import { MetricCard, EmptyState, LoadingState } from '../../components/ui/Primitives';

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  actor: string;
  source_ip: string;
  details: string;
  timestamp: string;
}

interface ActiveSession {
  id: string;
  user_id: string;
  user_email: string;
  role: string;
  device: string;
  ip_address: string;
  location: string;
  created_at: string;
  last_seen: string;
}

interface SSOConfig {
  provider: string;
  status: string;
  entity_id: string;
  sso_endpoint: string;
  issuer: string;
  last_synced_at: string;
}

export const SecurityCenterPage: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [ssoList, setSsoList] = useState<SSOConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sessions' | 'events' | 'sso'>('sessions');
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      const [evRes, sessRes, ssoRes] = await Promise.all([
        api.get('/security/events'),
        api.get('/security/sessions'),
        api.get('/security/sso'),
      ]);
      setEvents(evRes.data);
      setSessions(sessRes.data);
      setSsoList(ssoRes.data);
    } catch (err) {
      console.error('Failed to load security center data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const handleRevokeSession = async (id: string) => {
    if (!confirm('Are you sure you want to force-revoke this authenticated session?')) return;
    try {
      setRevokingId(id);
      await api.post(`/security/sessions/${id}/revoke`);
      fetchSecurityData();
    } catch (err: any) {
      alert('Failed to revoke session: ' + err.message);
    } finally {
      setRevokingId(null);
    }
  };

  const highSeverityEvents = events.filter(e => e.severity === 'HIGH' || e.severity === 'CRITICAL').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Security Center & Enterprise Identity</h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
              Zero Trust Control Plane
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Enterprise authentication policies, active session revocations, SAML/OIDC identity federation, and perimeter security logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSecurityData}
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
          title="Active Authenticated Sessions"
          value={sessions.length}
          subtitle="Devices Across Fleet"
          icon={<Laptop className="w-5 h-5 text-blue-400" />}
        />
        <MetricCard
          title="Threats & Flags (24h)"
          value={highSeverityEvents}
          subtitle="Anomalies Throttled"
          icon={<ShieldAlert className="w-5 h-5 text-rose-400" />}
        />
        <MetricCard
          title="Federated SSO Providers"
          value={ssoList.filter(s => s.status === 'ACTIVE').length}
          subtitle="SAML 2.0 & OIDC Active"
          icon={<Key className="w-5 h-5 text-purple-400" />}
        />
        <MetricCard
          title="Access Control Enforcement"
          value="Granular RBAC"
          subtitle="Least Privilege Active"
          icon={<Shield className="w-5 h-5 text-emerald-400" />}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#232730] pb-2">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'sessions'
              ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
              : 'text-gray-400 hover:text-white hover:bg-[#181c23]'
          }`}
        >
          Active Sessions ({sessions.length})
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'events'
              ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
              : 'text-gray-400 hover:text-white hover:bg-[#181c23]'
          }`}
        >
          Security Audit Events ({events.length})
        </button>
        <button
          onClick={() => setActiveTab('sso')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'sso'
              ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
              : 'text-gray-400 hover:text-white hover:bg-[#181c23]'
          }`}
        >
          Identity Providers & SSO ({ssoList.length})
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <LoadingState message="Auditing active sessions and perimeter security logs..." />
      ) : activeTab === 'sessions' ? (
        <div className="bg-[#13161b] border border-[#232730] rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-[#171a21] text-xs uppercase tracking-wider text-gray-400 border-b border-[#232730]">
                <tr>
                  <th className="px-6 py-3 font-medium">User & Role</th>
                  <th className="px-6 py-3 font-medium">Device & Browser</th>
                  <th className="px-6 py-3 font-medium">IP & Location</th>
                  <th className="px-6 py-3 font-medium">Logged In</th>
                  <th className="px-6 py-3 font-medium">Last Activity</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e222a]">
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-[#181c23] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white text-sm">{s.user_email}</div>
                      <span className="inline-block mt-0.5 text-[10px] font-mono px-2 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {s.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-300">{s.device}</td>
                    <td className="px-6 py-4 text-xs">
                      <div className="font-mono text-gray-200">{s.ip_address}</div>
                      <div className="text-[11px] text-gray-500">{s.location}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(s.created_at).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 text-xs text-emerald-400 font-mono">
                      {new Date(s.last_seen).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRevokeSession(s.id)}
                        disabled={revokingId === s.id}
                        className="px-2.5 py-1 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded font-semibold transition-colors flex items-center gap-1.5 ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'events' ? (
        <div className="bg-[#13161b] border border-[#232730] rounded-xl overflow-hidden shadow-xl divide-y divide-[#1e222a]">
          {events.map(ev => (
            <div key={ev.id} className="p-4 flex items-start gap-3 hover:bg-[#181c23] transition-colors">
              <div className="mt-0.5">
                {ev.severity === 'HIGH' || ev.severity === 'CRITICAL' ? (
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                ) : ev.severity === 'MEDIUM' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-blue-400" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{ev.event_type}</span>
                    <span className={`px-2 py-0.2 rounded font-mono text-[9px] uppercase font-bold ${
                      ev.severity === 'HIGH' || ev.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                      ev.severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {ev.severity}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 font-mono">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-gray-300">{ev.details}</p>
                <div className="text-[11px] font-mono text-gray-500 flex items-center gap-2">
                  <span>Actor: <strong className="text-gray-400">{ev.actor}</strong></span>
                  <span>•</span>
                  <span>IP: <strong className="text-gray-400">{ev.source_ip}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* SSO Tab */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ssoList.map(sso => (
            <div key={sso.provider} className="bg-[#13161b] border border-[#232730] rounded-xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-base">{sso.provider}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {sso.status}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-500 font-mono text-[10px]">Entity ID:</span>
                  <div className="font-mono text-gray-300 truncate" title={sso.entity_id}>{sso.entity_id}</div>
                </div>
                <div>
                  <span className="text-gray-500 font-mono text-[10px]">SSO Endpoint:</span>
                  <div className="font-mono text-gray-300 truncate" title={sso.sso_endpoint}>{sso.sso_endpoint}</div>
                </div>
                <div>
                  <span className="text-gray-500 font-mono text-[10px]">Issuer:</span>
                  <div className="font-mono text-gray-300 truncate" title={sso.issuer}>{sso.issuer}</div>
                </div>
              </div>
              <div className="pt-2 border-t border-[#1e222a] text-[11px] text-gray-500">
                Last directory sync: {new Date(sso.last_synced_at).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
