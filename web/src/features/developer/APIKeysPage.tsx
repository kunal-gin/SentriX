import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { 
  Key, Code, Copy, Check, Trash2, Plus, Shield, RefreshCw, 
  Terminal, FileText, CheckCircle2, Lock, ExternalLink
} from 'lucide-react';
import { MetricCard, EmptyState, LoadingState } from '../../components/ui/Primitives';

interface APIKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: string;
  last_used_at?: string;
  created_at: string;
}

export const APIKeysPage: React.FC = () => {
  const [keys, setKeys] = useState<APIKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read', 'ingest']);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const availableScopes = [
    { id: 'read', label: 'read', desc: 'Read telemetry, alerts, and incident states' },
    { id: 'write', label: 'write', desc: 'Create and modify services, rules, and dashboards' },
    { id: 'ingest', label: 'ingest', desc: 'Push high-velocity metrics, logs, and trace spans' },
    { id: 'automation', label: 'automation', desc: 'Trigger approved operational runbooks' },
    { id: 'admin', label: 'admin', desc: 'Full tenant administration and user access control' },
  ];

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api-keys');
      setKeys(res.data);
    } catch (err) {
      console.error('Failed to load API keys', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/api-keys', {
        name: keyName,
        scopes: selectedScopes,
      });
      setGeneratedKey(res.data.raw_key);
      setKeyName('');
      fetchKeys();
    } catch (err: any) {
      alert('Failed to generate key: ' + err.message);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to permanently revoke this API key?')) return;
    try {
      await api.delete(`/api-keys/${id}`);
      fetchKeys();
    } catch (err: any) {
      alert('Failed to revoke key: ' + err.message);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Developer Platform & Scoped API Keys</h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              OpenAPI 3.0 Ready
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Generate cryptographically hashed, least-privilege API tokens for CI/CD pipelines, custom collectors, and automation webhooks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setGeneratedKey(null);
              setShowGenerateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Generate Scoped Key
          </button>
          <button
            onClick={fetchKeys}
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
          title="Active Scoped Tokens"
          value={keys.filter(k => k.status === 'ACTIVE').length}
          subtitle="Programmatic Access"
          icon={<Key className="w-5 h-5 text-blue-400" />}
        />
        <MetricCard
          title="Hashing Standard"
          value="SHA-256"
          subtitle="Zero Plaintext Storage"
          icon={<Lock className="w-5 h-5 text-emerald-400" />}
        />
        <MetricCard
          title="API Rate Limit"
          value="5,000 /min"
          subtitle="Per Active Token"
          icon={<Terminal className="w-5 h-5 text-purple-400" />}
        />
        <MetricCard
          title="OpenAPI Spec Version"
          value="v3.0.3"
          subtitle="Standard REST & OTLP"
          icon={<Code className="w-5 h-5 text-cyan-400" />}
        />
      </div>

      {/* Keys Table */}
      <div className="bg-[#13161b] border border-[#232730] rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-[#232730] flex items-center justify-between bg-[#171a21]/50">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-400" />
            <h2 className="font-semibold text-white text-sm">Active API Keys</h2>
          </div>
          <span className="text-xs text-gray-500">{keys.length} Keys Configured</span>
        </div>

        {loading ? (
          <LoadingState message="Loading scoped API credentials..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-[#171a21] text-xs uppercase tracking-wider text-gray-400 border-b border-[#232730]">
                <tr>
                  <th className="px-6 py-3 font-medium">Key Name & Token Prefix</th>
                  <th className="px-6 py-3 font-medium">Granted Scopes</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Last Used</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e222a]">
                {keys.map(k => (
                  <tr key={k.id} className="hover:bg-[#181c23] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white text-sm">{k.name}</div>
                      <div className="font-mono text-xs text-blue-400 mt-0.5">{k.key_prefix}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map(s => (
                          <span key={s} className="px-2 py-0.2 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        k.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {k.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-400">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleTimeString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {k.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          className="px-2.5 py-1 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded font-semibold transition-colors flex items-center gap-1.5 ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Revoke</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* OpenAPI Documentation Reference Box */}
      <div className="bg-[#13161b] border border-[#232730] rounded-xl p-6 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-white text-base">Interactive OpenAPI 3.0 Specification</h3>
          </div>
          <a
            href="http://localhost:8080/api/v1/openapi.json"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-mono"
          >
            <span>openapi.json</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          SentriX publishes fully conformant OpenAPI 3.0 schema specs supporting automated client SDK generation in Python, Go, and TypeScript, as well as native OTLP telemetry streaming endpoints.
        </p>
      </div>

      {/* Generate Key Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#13161b] border border-[#2e3440] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-[#232730] flex items-center justify-between bg-[#171a21]">
              <h3 className="font-semibold text-white">Generate Scoped API Key</h3>
              <button onClick={() => setShowGenerateModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            {!generatedKey ? (
              <form onSubmit={handleGenerateKey} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Key Description / Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Terraform Provider Production Token"
                    value={keyName}
                    onChange={e => setKeyName(e.target.value)}
                    className="w-full bg-[#181c23] border border-[#2e3440] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-300">Assign Permissions & Scopes</label>
                  <div className="space-y-2">
                    {availableScopes.map(scope => {
                      const checked = selectedScopes.includes(scope.id);
                      return (
                        <label
                          key={scope.id}
                          className="p-2.5 rounded-lg bg-[#181c23] border border-[#232730] flex items-start gap-2.5 cursor-pointer hover:border-[#2e3440]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedScopes([...selectedScopes, scope.id]);
                              } else {
                                setSelectedScopes(selectedScopes.filter(s => s !== scope.id));
                              }
                            }}
                            className="mt-0.5 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-xs font-mono font-bold text-white uppercase">{scope.label}</span>
                            <p className="text-[11px] text-gray-400">{scope.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#232730]">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="px-4 py-2 bg-[#252932] text-gray-300 text-xs rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
                  >
                    Generate Token
                  </button>
                </div>
              </form>
            ) : (
              /* Generated key one-time view */
              <div className="p-6 space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>API Token Generated Successfully</span>
                  </div>
                  <p className="text-gray-300">
                    Copy this token now. For your security, it will never be displayed again.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-black/60 border border-[#2e3440] flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-blue-300 break-all select-all">{generatedKey}</span>
                  <button
                    onClick={() => handleCopy(generatedKey)}
                    className="p-1.5 bg-[#252932] hover:bg-[#2e3440] text-gray-300 rounded transition-colors flex-shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex justify-end pt-3 border-t border-[#232730]">
                  <button
                    onClick={() => setShowGenerateModal(false)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
                  >
                    I Have Saved My Token
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
