import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  Shield,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@sentrix.local');
  const [password, setPassword] = useState('admin12345');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Authentication rejected. Verify your email and access key.');
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemoCredentials() {
    setEmail('admin@sentrix.local');
    setPassword('admin12345');
  }

  return (
    <div className="min-h-screen bg-background ambient-mesh flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glassmorphic Auth Card */}
      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-primary-hover to-cyan flex items-center justify-center mx-auto shadow-glow-primary mb-3">
            <Shield className="text-white w-7 h-7" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">SentriX</h1>
            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-primary/20 text-primary-light font-bold border border-primary/30">
              v0.6
            </span>
          </div>
          <p className="text-xs text-muted font-medium tracking-wide">
            Enterprise Infrastructure & Telemetry Observability
          </p>
        </div>

        {/* Login Form Box */}
        <div className="glass-card rounded-3xl p-8 border border-border shadow-2xl relative overflow-hidden backdrop-blur-2xl">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-critical/15 border border-critical/30 text-critical text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-medium text-muted">
                Operator Identity / Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                  size={16}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sentrix.local"
                  className="w-full bg-background/80 border border-border focus:border-primary rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all font-sans"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-mono font-medium text-muted">Master Access Key</label>
                <span className="text-[10px] font-mono text-primary-light">Argon2id Hashed</span>
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                  size={16}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-background/80 border border-border focus:border-primary rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all font-sans"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary via-primary-hover to-primary hover:opacity-95 disabled:opacity-50 text-white font-semibold text-sm shadow-glow-primary transition-all flex items-center justify-center gap-2 group mt-2"
            >
              <span>{submitting ? 'Authenticating Operator...' : 'Authorize & Connect'}</span>
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>
          </form>

          {/* Quick Demo Helper */}
          <div className="mt-6 pt-5 border-t border-border/80 flex items-center justify-between text-xs">
            <span className="text-muted text-[11px] font-mono">Demo Environment</span>
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="inline-flex items-center gap-1.5 text-primary-light hover:text-white font-medium transition-colors"
            >
              <Sparkles size={13} />
              <span>Fill Demo Admin</span>
            </button>
          </div>
        </div>

        {/* Footer Security Badges */}
        <div className="flex items-center justify-center gap-4 text-[11px] font-mono text-muted">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-healthy" /> TLS 1.3 Active
          </span>
          <span>•</span>
          <span>JWT Bearer RBAC</span>
          <span>•</span>
          <span>TimescaleDB Engine</span>
        </div>
      </div>
    </div>
  );
}
