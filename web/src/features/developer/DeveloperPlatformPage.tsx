import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import {
  Code,
  Key,
  Terminal,
  Copy,
  Check,
  Trash2,
  Plus,
  ExternalLink,
  ShieldCheck,
  Layers,
  BookOpen,
  FileCode,
  Sparkles,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Badge, MetricCard, EmptyState, LoadingState } from '../../components/ui/Primitives';

interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: string;
  last_used_at: string | null;
  created_at: string;
}

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  paths: Record<string, Record<string, any>>;
}

const AVAILABLE_SCOPES = [
  { id: 'read', label: 'read: Telemetry, fleet status, and incidents queries' },
  { id: 'write', label: 'write: Modify configurations, alerts, and services' },
  { id: 'ingest', label: 'ingest: Push metrics, logs, traces, and agent heartbeats' },
  { id: 'automation', label: 'automation: Execute runbooks and trigger remediation actions' },
  { id: 'admin', label: 'admin: Full access to users, tenant quotas, and security' },
];

export const DeveloperPlatformPage: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [openapi, setOpenapi] = useState<OpenAPISpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'keys' | 'docs'>('keys');

  // Key Generation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read', 'ingest']);
  const [creating, setCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Revocation State
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Curl snippet copied state
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [keysRes, openapiRes] = await Promise.all([
        api.get('/api-keys'),
        api.get('/openapi.json'),
      ]);
      setApiKeys(keysRes.data || []);
      setOpenapi(openapiRes.data || null);
    } catch (err) {
      console.error('Failed to load developer platform data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      const res = await api.post('/api-keys', {
        name: keyName,
        scopes: selectedScopes,
      });
      setNewlyCreatedKey(res.data.api_key);
      setKeyName('');
      await fetchData();
    } catch (err) {
      console.error('Failed to generate API Key', err);
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      setRevokingId(keyId);
      await api.delete(`/api-keys/${keyId}`);
      await fetchData();
    } catch (err) {
      console.error('Failed to revoke API key', err);
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = (text: string, isKey: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isKey) {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const toggleScope = (scopeId: string) => {
    if (selectedScopes.includes(scopeId)) {
      setSelectedScopes(selectedScopes.filter((s) => s !== scopeId));
    } else {
      setSelectedScopes([...selectedScopes, scopeId]);
    }
  };

  const activeKeysCount = apiKeys.filter((k) => k.status === 'ACTIVE').length;

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-primary-light uppercase tracking-wider mb-1">
            <Terminal size={14} /> Phase 24 — Developer Ecosystem & OpenAPI
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Developer Platform & API Keys</h1>
          <p className="text-sm text-muted mt-1">
            Generate cryptographically hashed, scoped API tokens for CI/CD runners, OpenTelemetry collectors, and query SentriX via OpenAPI v3.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setNewlyCreatedKey(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white text-xs font-semibold shadow-glow-primary hover:opacity-95 transition-all"
          >
            <Plus size={15} />
            <span>Generate New API Key</span>
          </button>
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Scoped Keys"
          value={activeKeysCount}
          subtitle="SHA-256 Hashed Tokens"
          icon={Key}
          color="primary"
        />
        <MetricCard
          title="OpenAPI Spec Version"
          value={openapi?.openapi || '3.0.3'}
          subtitle={openapi?.info?.title || 'SentriX Enterprise API'}
          icon={FileCode}
          color="healthy"
        />
        <MetricCard
          title="Documented Endpoints"
          value={openapi?.paths ? Object.keys(openapi.paths).length : 24}
          subtitle="REST & WebSocket API"
          icon={Code}
          color="primary"
        />
        <MetricCard
          title="Auth Architecture"
          value="Bearer Token"
          subtitle="Header: X-API-Key or Bearer"
          icon={ShieldCheck}
          color="healthy"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80">
        <button
          onClick={() => setActiveTab('keys')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'keys'
              ? 'border-primary text-white bg-surface/40'
              : 'border-transparent text-muted hover:text-white'
          }`}
        >
          <Key size={16} />
          <span>API Keys ({apiKeys.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'docs'
              ? 'border-primary text-white bg-surface/40'
              : 'border-transparent text-muted hover:text-white'
          }`}
        >
          <BookOpen size={16} />
          <span>Interactive OpenAPI Explorer</span>
        </button>
      </div>

      {loading ? (
        <LoadingState message="Loading developer portal..." />
      ) : (
        <>
          {/* TAB 1: API Keys List */}
          {activeTab === 'keys' && (
            <div className="space-y-4">
              <div className="glass-panel border-border/80 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border bg-surface/40 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Configured Access Tokens</h3>
                    <p className="text-xs text-muted">
                      Full plaintext secret tokens are never stored. Only salted SHA-256 digests reside in database.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-border/60">
                  {apiKeys.map((key) => {
                    const isActive = key.status === 'ACTIVE';

                    return (
                      <div
                        key={key.id}
                        className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                          isActive ? 'hover:bg-surface/50' : 'bg-surface/20 opacity-60'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-white text-sm">{key.name}</span>
                            <Badge variant={isActive ? 'healthy' : 'critical'}>
                              {key.status}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                            <span className="bg-background px-2.5 py-1 rounded-lg border border-border text-primary-light font-bold">
                              {key.key_prefix}
                            </span>
                            <span className="text-muted">•</span>
                            <div className="flex flex-wrap gap-1">
                              {key.scopes.map((s) => (
                                <span
                                  key={s}
                                  className="px-2 py-0.5 rounded-md bg-surface-highlight border border-border text-[11px] text-text-dim"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-6 text-xs font-mono text-muted">
                          <div>
                            <div className="text-[10px] uppercase text-text-dim">Last Ingest</div>
                            <div className="text-white text-[11px]">
                              {key.last_used_at
                                ? new Date(key.last_used_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Never'}
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] uppercase text-text-dim">Created</div>
                            <div className="text-white text-[11px]">
                              {new Date(key.created_at).toLocaleDateString()}
                            </div>
                          </div>

                          {isActive && (
                            <button
                              onClick={() => handleRevokeKey(key.id)}
                              disabled={revokingId === key.id}
                              title="Revoke Token"
                              className="p-2 text-muted hover:text-critical hover:bg-critical/10 rounded-xl border border-border transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OpenAPI Explorer */}
          {activeTab === 'docs' && openapi && (
            <div className="space-y-6">
              <div className="glass-panel border-border/80 rounded-2xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4 mb-5">
                  <div>
                    <h3 className="text-lg font-bold text-white">{openapi.info.title}</h3>
                    <p className="text-xs text-muted mt-1">{openapi.info.description}</p>
                  </div>
                  <a
                    href="/api/v1/openapi.json"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-primary text-xs font-mono text-white transition-all"
                  >
                    <span>Raw JSON Spec</span>
                    <ExternalLink size={13} />
                  </a>
                </div>

                {/* Endpoints Table / Cards */}
                <div className="space-y-3">
                  {Object.entries(openapi.paths).map(([path, methods]) => {
                    return Object.entries(methods).map(([method, details]: [string, any]) => {
                      const mUpper = method.toUpperCase();
                      const isGet = mUpper === 'GET';
                      const isPost = mUpper === 'POST';
                      const isDelete = mUpper === 'DELETE';

                      const curlSnippet = `curl -X ${mUpper} "http://localhost:8080/api/v1${path}" \\
  -H "Authorization: Bearer <YOUR_API_KEY>"`;

                      const isCopied = copiedEndpoint === `${mUpper}:${path}`;

                      return (
                        <div
                          key={`${method}-${path}`}
                          className="p-4 rounded-xl bg-surface/50 border border-border/80 hover:border-border transition-all space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <span
                                className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md border ${
                                  isGet
                                    ? 'bg-healthy/15 text-healthy border-healthy/30'
                                    : isPost
                                    ? 'bg-primary/20 text-primary-light border-primary/30'
                                    : isDelete
                                    ? 'bg-critical/15 text-critical border-critical/30'
                                    : 'bg-warning/15 text-warning border-warning/30'
                                }`}
                              >
                                {mUpper}
                              </span>
                              <span className="font-mono text-sm text-white font-bold">{path}</span>
                            </div>

                            <button
                              onClick={() => {
                                copyToClipboard(curlSnippet);
                                setCopiedEndpoint(`${mUpper}:${path}`);
                                setTimeout(() => setCopiedEndpoint(null), 2000);
                              }}
                              className="self-start sm:self-auto flex items-center gap-1.5 text-xs font-mono text-muted hover:text-white bg-surface px-2.5 py-1 rounded-lg border border-border transition-colors"
                            >
                              {isCopied ? (
                                <>
                                  <Check size={12} className="text-healthy" />
                                  <span className="text-healthy font-semibold">Copied cURL</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Copy cURL</span>
                                </>
                              )}
                            </button>
                          </div>

                          <p className="text-xs text-text-dim">{details.summary || details.description}</p>
                        </div>
                      );
                    });
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Generate API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel border-border max-w-lg w-full rounded-2xl p-6 space-y-5 animate-scale-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key size={18} className="text-primary-light" />
                Generate Scoped API Key
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewlyCreatedKey(null);
                }}
                className="text-muted hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {newlyCreatedKey ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-healthy/10 border border-healthy/30 text-healthy text-xs font-semibold flex items-center gap-2">
                  <Check size={16} /> API Key Generated Successfully
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-muted">
                    Copy and store this secret key safely. It will never be displayed again:
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-background border border-primary font-mono text-xs text-primary-light break-all select-all">
                    <span>{newlyCreatedKey}</span>
                  </div>
                </div>

                <button
                  onClick={() => copyToClipboard(newlyCreatedKey, true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover shadow-glow-primary transition-all"
                >
                  {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedKey ? 'Copied to Clipboard!' : 'Copy Key'}</span>
                </button>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewlyCreatedKey(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-surface border border-border"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Key Description / Name</label>
                  <input
                    type="text"
                    required
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="e.g. Kubernetes Cluster Collector Daemon"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-white text-sm focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-muted">Allowed Scopes & Permissions</label>
                  <div className="space-y-1.5">
                    {AVAILABLE_SCOPES.map((scope) => {
                      const checked = selectedScopes.includes(scope.id);
                      return (
                        <div
                          key={scope.id}
                          onClick={() => toggleScope(scope.id)}
                          className={`p-2.5 rounded-xl border cursor-pointer text-xs flex items-center gap-3 transition-all ${
                            checked
                              ? 'bg-primary/10 border-primary text-white'
                              : 'bg-surface/50 border-border text-muted hover:text-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}}
                            className="rounded border-border text-primary focus:ring-0"
                          />
                          <span className="font-mono">{scope.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-white bg-surface"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || selectedScopes.length === 0}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary-hover shadow-glow-primary transition-all disabled:opacity-50"
                  >
                    {creating ? 'Generating...' : 'Create Scoped Key'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
