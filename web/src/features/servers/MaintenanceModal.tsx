import { FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { mutateJSON } from '../../lib/api';
import {
  Sliders,
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId?: string;
  serverName?: string;
}

const durationOptions = [
  { label: '30 Minutes', minutes: 30 },
  { label: '1 Hour', minutes: 60 },
  { label: '4 Hours', minutes: 240 },
  { label: '24 Hours', minutes: 1440 },
];

export function MaintenanceModal({
  isOpen,
  onClose,
  serverId,
  serverName,
}: MaintenanceModalProps) {
  const queryClient = useQueryClient();
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [reason, setReason] = useState('Planned OS kernel upgrade and server maintenance');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await mutateJSON('/silences', 'POST', {
        server_id: serverId || null,
        reason,
        duration_minutes: durationMinutes,
      });

      queryClient.invalidateQueries({ queryKey: ['silences'] });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to create maintenance window', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-warning">
            <Sliders size={18} />
            <h3 className="font-bold text-white text-base">Schedule Maintenance Window</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 size={40} className="mx-auto text-emerald-400 animate-bounce" />
            <p className="text-sm font-semibold text-white">Maintenance Mode Activated</p>
            <p className="text-xs text-muted">Alert notifications are now silenced for {durationMinutes} minutes.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-xs text-muted">
              Mute alert rules and incident notifications while performing maintenance on{' '}
              <strong className="text-white">{serverName || 'target infrastructure'}</strong>.
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white flex items-center gap-1.5">
                <Clock size={13} className="text-muted" /> Silence Duration
              </label>
              <div className="grid grid-cols-2 gap-2">
                {durationOptions.map((opt) => (
                  <button
                    key={opt.minutes}
                    type="button"
                    onClick={() => setDurationMinutes(opt.minutes)}
                    className={`px-3 py-2 rounded-xl text-xs font-mono font-medium border transition-all ${
                      durationMinutes === opt.minutes
                        ? 'bg-warning/15 text-warning border-warning/40 shadow-sm'
                        : 'bg-background border-border text-muted hover:text-white hover:border-border-strong'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white flex items-center gap-1.5">
                <Calendar size={13} className="text-muted" /> Maintenance Reason / Ticket
              </label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Kernel patching, database vacuum, hardware swap"
                className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs text-white placeholder-muted focus:outline-none focus:border-warning transition-colors"
              />
            </div>

            <div className="p-3 rounded-xl bg-warning/5 border border-warning/20 text-[11px] text-muted space-y-1">
              <div className="flex items-center gap-1.5 text-warning font-semibold">
                <AlertTriangle size={12} />
                <span>Notice</span>
              </div>
              <p>
                During maintenance, metric telemetry collection continues as normal, but threshold alerts will not page incident channels.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-surface border border-border text-xs text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-warning hover:bg-warning/80 text-black text-xs font-bold transition-all shadow-glow-warning"
              >
                {loading ? 'Activating...' : 'Activate Silence'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
