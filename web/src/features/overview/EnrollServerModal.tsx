import { useState, useEffect } from 'react';
import { X, Copy, Check, Terminal, Shield, RefreshCw, Server, ArrowRight } from 'lucide-react';
import { mutateJSON } from '../../lib/api';

interface EnrollTokenResponse {
  id: string;
  token: string;
  expires_at: string;
}

interface EnrollServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EnrollServerModal({ isOpen, onClose }: EnrollServerModalProps) {
  const [tokenData, setTokenData] = useState<EnrollTokenResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serverHost = window.location.hostname || '127.0.0.1';
  const serverPort = window.location.port || '8080';

  async function generateToken() {
    setLoading(true);
    setError(null);
    try {
      const res = await mutateJSON<EnrollTokenResponse>(
        '/agents/enrollment-tokens',
        'POST',
        { description: 'Manual Fleet Enrollment', expires_in_seconds: 86400 }
      );
      setTokenData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate enrollment token');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen && !tokenData) {
      generateToken();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const installCommand = tokenData
    ? `curl -sSL https://github.com/kunal-gin/SentriX/releases/download/v1.0.0/sentrix-agent-1.0.0-linux-x86_64.tar.gz | tar -xz && \\
sudo ./scripts/install-agent.sh ./bin/sentrix-agent && \\
sudo ./scripts/enroll-agent.sh ${serverHost} ${serverPort} ${tokenData.token} 1.0.0 && \\
sudo systemctl enable --now sentrix-agent`
    : '';

  function handleCopy() {
    if (!installCommand) return;
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-surface-highlight/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15 border border-primary/30 text-primary-light">
              <Server size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Enroll Infrastructure Node</h2>
              <p className="text-xs text-muted">Add a new server to the SentriX observability network</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-white hover:bg-surface-highlight transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Step 1: Token info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-text-dim">
                1. Single-Use Enrollment Credential
              </span>
              <button
                onClick={generateToken}
                disabled={loading}
                className="text-xs text-primary-light hover:underline flex items-center gap-1.5 font-mono"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                Regenerate Token
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-critical/10 border border-critical/30 text-critical text-xs">
                {error}
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-background border border-border flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2 truncate">
                <Shield size={14} className="text-healthy shrink-0" />
                <span className="text-white truncate">
                  {loading ? 'Generating secure token...' : tokenData?.token || '—'}
                </span>
              </div>
              <span className="text-[10px] text-muted shrink-0 ml-2">Valid for 24h</span>
            </div>
          </div>

          {/* Step 2: One-click installation script */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-text-dim">
                2. Run On Target Linux Server
              </span>
              <span className="text-[11px] text-muted flex items-center gap-1 font-mono">
                <Terminal size={12} /> root / sudo
              </span>
            </div>

            <div className="relative group">
              <pre className="p-4 rounded-xl bg-background border border-border font-mono text-xs text-emerald-400 whitespace-pre-wrap leading-relaxed overflow-x-auto selection:bg-primary/30">
                {installCommand || 'Preparing install script...'}
              </pre>

              <button
                onClick={handleCopy}
                disabled={!installCommand}
                className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border-strong hover:border-primary text-xs font-mono text-white transition-all shadow-md active:scale-95"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-healthy" />
                    <span className="text-healthy">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} className="text-muted" />
                    <span>Copy Command</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Instructions checklist */}
          <div className="rounded-xl p-4 bg-primary/5 border border-primary/20 space-y-2.5 text-xs text-text-muted">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <span>What happens next?</span>
              <ArrowRight size={13} className="text-primary-light" />
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-muted">
              <li>The agent downloads and registers as a background systemd service (<code className="text-white">sentrix-agent</code>).</li>
              <li>Exchanges the enrollment token for unique node credentials.</li>
              <li>Begins streaming CPU, memory, disk, and network stats every 10 seconds.</li>
              <li>The server will appear automatically on your Fleet Overview within 30 seconds.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-highlight/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-surface border border-border hover:border-border-strong text-xs font-medium text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
