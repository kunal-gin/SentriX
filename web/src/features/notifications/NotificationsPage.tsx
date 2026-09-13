import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus, Trash2, Globe, CheckCircle2, AlertCircle, Send, ShieldCheck, Activity } from 'lucide-react';
import { fetchJSON, mutateJSON } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

interface NotificationChannel {
  id: string;
  name: string;
  type: string;
  config: {
    url?: string;
  };
  enabled: boolean;
  created_at: string;
}

export function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testSent, setTestSent] = useState<string | null>(null);

  const { data: channels, isLoading } = useQuery<NotificationChannel[]>({
    queryKey: ['notification-channels'],
    queryFn: () => fetchJSON<NotificationChannel[]>('/notifications/channels'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; type: string; config: { url: string } }) =>
      mutateJSON('/notifications/channels', 'POST', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
      setModalOpen(false);
      setName('');
      setUrl('');
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to create notification channel');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mutateJSON(`/notifications/channels/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
      setDeleteId(null);
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !url) {
      setErrorMsg('Channel name and target URL are required');
      return;
    }
    createMutation.mutate({
      name,
      type: 'WEBHOOK',
      config: { url },
    });
  }

  function handleSendTest(id: string) {
    setTestSent(id);
    setTimeout(() => setTestSent(null), 2500);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Notification Outlets
            <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-primary/20 text-primary-light border border-primary/30">
              Webhooks
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Dispatch high-severity incident alerts and recovery notices to external endpoints.
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <button
            onClick={() => {
              setModalOpen(true);
              setErrorMsg(null);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary via-primary to-primary-hover hover:opacity-95 text-xs font-semibold text-white shadow-glow-primary transition-all duration-200 active:scale-95"
          >
            <Plus size={14} />
            <span>Add Webhook Channel</span>
          </button>
        )}
      </div>

      {/* Channel Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-muted font-mono text-xs">
            Loading notification channels...
          </div>
        ) : !channels || channels.length === 0 ? (
          <div className="col-span-full glass-card rounded-2xl p-12 text-center border border-border">
            <Bell size={32} className="mx-auto text-muted mb-3 opacity-40" />
            <h3 className="text-sm font-semibold text-white">No Notification Channels Configured</h3>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
              Add a webhook URL to forward threshold violations, port outages, and incident alerts to Slack, Discord, or your incident manager.
            </p>
          </div>
        ) : (
          channels.map((chan) => (
            <div
              key={chan.id}
              className="glass-card rounded-2xl p-5 border border-border hover:border-border-strong transition-all flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-primary/15 border border-primary/30 text-primary-light">
                      <Globe size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight">{chan.name}</h3>
                      <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
                        {chan.type} DESTINATION
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-healthy/15 text-healthy border border-healthy/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-healthy animate-pulse" />
                    ENABLED
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-background border border-border font-mono text-xs text-muted break-all">
                  {chan.config?.url || 'No URL configured'}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-border flex items-center justify-between text-xs font-mono">
                <span className="text-[11px] text-muted">
                  Created {new Date(chan.created_at).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendTest(chan.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-primary text-text-muted hover:text-white transition-colors"
                  >
                    {testSent === chan.id ? (
                      <>
                        <CheckCircle2 size={12} className="text-healthy" />
                        <span className="text-healthy">Dispatched</span>
                      </>
                    ) : (
                      <>
                        <Send size={12} />
                        <span>Send Test</span>
                      </>
                    )}
                  </button>

                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={() => setDeleteId(chan.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-critical hover:bg-critical/10 transition-colors"
                      title="Remove channel"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Channel Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-surface-highlight/30">
              <div className="flex items-center gap-2.5">
                <Bell size={18} className="text-primary-light" />
                <h3 className="font-bold text-white text-base">New Notification Channel</h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-muted hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-critical/10 border border-critical/30 text-critical text-xs flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-muted">Channel Label</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Slack #ops-alerts Webhook"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-white text-xs placeholder:text-muted focus:border-primary focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-muted">Webhook HTTP(S) URL</label>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-white text-xs placeholder:text-muted focus:border-primary focus:outline-none transition-colors"
                />
                <p className="text-[11px] text-muted">
                  Receives POST payloads with event type, severity, server name, and incident details.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface border border-border text-xs text-muted hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-xs font-semibold text-white transition-colors shadow-glow-primary"
                >
                  {createMutation.isPending ? 'Saving...' : 'Create Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-critical">
              <AlertCircle size={24} />
              <h3 className="font-bold text-white text-base">Delete Channel?</h3>
            </div>
            <p className="text-xs text-muted">
              Alerts will no longer be dispatched to this webhook endpoint.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-xl bg-surface border border-border text-xs text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-xl bg-critical hover:bg-critical/80 text-xs font-semibold text-white transition-colors"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
