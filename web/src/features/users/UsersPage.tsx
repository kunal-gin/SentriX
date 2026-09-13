import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users as UsersIcon, Plus, Trash2, Shield, UserCheck, Key, Mail, Calendar, Clock, AlertCircle } from 'lucide-react';
import { fetchJSON, mutateJSON } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

interface UserItem {
  id: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  status: string;
  created_at: string;
  last_login_at?: string;
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'OPERATOR' | 'VIEWER'>('VIEWER');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery<UserItem[]>({
    queryKey: ['users'],
    queryFn: () => fetchJSON<UserItem[]>('/users'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { email: string; password: string; role: string }) =>
      mutateJSON('/users', 'POST', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModalOpen(false);
      setEmail('');
      setPassword('');
      setRole('VIEWER');
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to create user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mutateJSON(`/users/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteConfirmId(null);
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Email and password are required');
      return;
    }
    createMutation.mutate({ email, password, role });
  }

  const roleColors: Record<string, { bg: string; text: string; border: string }> = {
    ADMIN: { bg: 'bg-primary/20', text: 'text-primary-light', border: 'border-primary/40' },
    OPERATOR: { bg: 'bg-warning/20', text: 'text-warning', border: 'border-warning/40' },
    VIEWER: { bg: 'bg-surface-highlight', text: 'text-muted', border: 'border-border' },
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Team & Access Control
            <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-primary/20 text-primary-light border border-primary/30">
              RBAC
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Manage organization members, assigned operational privileges, and credentials.
          </p>
        </div>

        {currentUser?.role === 'ADMIN' && (
          <button
            onClick={() => {
              setModalOpen(true);
              setErrorMsg(null);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary via-primary to-primary-hover hover:opacity-95 text-xs font-semibold text-white shadow-glow-primary transition-all duration-200 active:scale-95"
          >
            <Plus size={14} />
            <span>Add Member</span>
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="glass-card rounded-2xl border border-border overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-border bg-surface-highlight/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UsersIcon size={18} className="text-primary-light" />
            <span className="font-semibold text-white text-sm">Active Members ({users?.length ?? 0})</span>
          </div>
          <span className="text-xs text-muted font-mono">Argon2id + JWT Secured</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted bg-surface/50">
                <th className="py-3.5 px-5">User</th>
                <th className="py-3.5 px-5">Role</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Created</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted font-mono">
                    Loading users...
                  </td>
                </tr>
              ) : !users || users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const roleStyle = roleColors[u.role] || roleColors.VIEWER;
                  const isCurrent = u.id === currentUser?.id || u.email === currentUser?.email;

                  return (
                    <tr key={u.id} className="hover:bg-surface-highlight/40 transition-colors group">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center font-bold text-white uppercase text-xs">
                            {u.email.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-white flex items-center gap-2">
                              <span>{u.email}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-healthy/20 text-healthy border border-healthy/30">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted font-mono">{u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                          <Shield size={11} />
                          {u.role}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center gap-1.5 text-healthy font-mono text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-healthy animate-pulse" />
                          {u.status}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-muted font-mono text-[11px]">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-5 text-right">
                        {currentUser?.role === 'ADMIN' && !isCurrent && (
                          <button
                            onClick={() => setDeleteConfirmId(u.id)}
                            className="p-1.5 rounded-lg text-muted hover:text-critical hover:bg-critical/10 transition-colors"
                            title="Remove member"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-surface-highlight/30">
              <div className="flex items-center gap-2.5">
                <UserCheck size={18} className="text-primary-light" />
                <h3 className="font-bold text-white text-base">Invite Team Member</h3>
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
                <label className="text-xs font-mono uppercase tracking-wider text-muted">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@sentrix.local"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-background border border-border text-white text-xs placeholder:text-muted focus:border-primary focus:outline-none transition-colors"
                  />
                  <Mail size={14} className="absolute left-3 top-3 text-muted" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-muted">Initial Password</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-background border border-border text-white text-xs placeholder:text-muted focus:border-primary focus:outline-none transition-colors"
                  />
                  <Key size={14} className="absolute left-3 top-3 text-muted" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-muted">Access Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-white text-xs focus:border-primary focus:outline-none transition-colors"
                >
                  <option value="VIEWER">VIEWER (Read-only metrics & dashboard access)</option>
                  <option value="OPERATOR">OPERATOR (Alert management & incident resolution)</option>
                  <option value="ADMIN">ADMIN (Full management & member control)</option>
                </select>
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
                  {createMutation.isPending ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-critical">
              <AlertCircle size={24} />
              <h3 className="font-bold text-white text-base">Remove Team Member?</h3>
            </div>
            <p className="text-xs text-muted">
              This will revoke all active JWT tokens and sessions for this user immediately.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl bg-surface border border-border text-xs text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-xl bg-critical hover:bg-critical/80 text-xs font-semibold text-white transition-colors"
              >
                {deleteMutation.isPending ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
