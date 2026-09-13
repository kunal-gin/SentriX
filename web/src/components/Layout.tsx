import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertTriangle,
  BellRing,
  Activity,
  LogOut,
  Radio,
  Search,
  ChevronRight,
  Shield,
  Layers,
  CheckCircle2,
  Users,
  Bell,
  ShieldCheck,
  FileText,
  Server,
  GitCommit,
  Globe,
  Target,
  Box,
  Network,
  Terminal,
  Webhook,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useRealtime } from '../hooks/useRealtime';
import { useDashboardSummary } from '../hooks/useDashboard';
import { CommandPalette } from './ui/CommandPalette';

const navItems = [
  { path: '/', label: 'Fleet Overview', icon: LayoutDashboard, badge: null },
  { path: '/dashboards', label: 'Custom Dashboards', icon: LayoutDashboard, badge: null },
  { path: '/metrics', label: 'Metrics Explorer', icon: Activity, badge: null },
  { path: '/logs', label: 'Central Logs', icon: FileText, badge: null },
  { path: '/traces', label: 'Distributed Traces', icon: GitCommit, badge: null },
  { path: '/services', label: 'Services Catalog', icon: Layers, badge: null },
  { path: '/infrastructure', label: 'Infrastructure Fleet', icon: Server, badge: null },
  { path: '/containers', label: 'Containers', icon: Box, badge: null },
  { path: '/kubernetes', label: 'Kubernetes Fleet', icon: Network, badge: null },
  { path: '/service-map', label: 'Service Dependency Map', icon: Globe, badge: null },
  { path: '/slos', label: 'SLOs & Reliability', icon: Target, badge: null },
  { path: '/incidents', label: 'Incidents', icon: AlertTriangle, badge: 'incidents' },
  { path: '/alerts', label: 'Alert Rules 2.0', icon: BellRing, badge: null },
  { path: '/runbooks', label: 'Runbooks & Automation', icon: Terminal, badge: null },
  { path: '/checks', label: 'Health Checks', icon: Activity, badge: null },
  { path: '/agents', label: 'Agent Fleet 2.0', icon: Terminal, badge: null },
  { path: '/integrations', label: 'Integrations & DLQ', icon: Webhook, badge: null },
  { path: '/notifications', label: 'Notifications', icon: Bell, badge: null },
  { path: '/users', label: 'Team & Access', icon: Users, badge: null },
  { path: '/audit', label: 'Audit Logs', icon: ShieldCheck, badge: null },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const wsStatus = useRealtime();
  const { data: summary } = useDashboardSummary();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  // Determine active breadcrumb name
  const currentNav = navItems.find((item) => {
    if (item.path === '/') return location.pathname === '/' || location.pathname.startsWith('/servers');
    return location.pathname.startsWith(item.path);
  });

  return (
    <div className="flex h-screen bg-background ambient-mesh text-text font-sans overflow-hidden">
      {/* Sleek Obsidian Sidebar */}
      <aside className="w-64 glass-panel border-r border-border flex flex-col z-20 select-none">
        {/* Logo & Platform Info */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary via-primary-hover to-cyan flex items-center justify-center shadow-glow-primary transition-transform group-hover:scale-105">
              <Shield className="text-white w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white group-hover:text-primary-light transition-colors">
                  SentriX
                </span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary-light font-semibold border border-primary/30">
                  v0.6
                </span>
              </div>
              <p className="text-[11px] text-muted tracking-wide flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-healthy inline-block animate-pulse-glow" />
                Observability Workstation
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation links */}
        <div className="px-3 py-4 flex-1 space-y-6 overflow-y-auto">
          <div>
            <div className="px-3 mb-2 text-[10px] font-mono tracking-wider text-text-dim uppercase">
              Core Modules
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive =
                  item.path === '/'
                    ? location.pathname === '/' || location.pathname.startsWith('/servers')
                    : location.pathname.startsWith(item.path);
                const Icon = item.icon;
                const incidentCount = summary?.incidents?.open ?? 0;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative ${
                      isActive
                        ? 'bg-gradient-to-r from-primary/25 to-primary/10 text-white border border-primary/30 shadow-glow-primary'
                        : 'text-muted hover:text-white hover:bg-surface/80 hover:border hover:border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-1.5 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-muted group-hover:text-white bg-surface-highlight/60'
                        }`}
                      >
                        <Icon size={16} />
                      </div>
                      <span className="tracking-tight">{item.label}</span>
                    </div>

                    {/* Dynamic badges */}
                    {item.badge === 'incidents' && incidentCount > 0 && (
                      <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-critical/20 text-critical border border-critical/30 animate-pulse">
                        {incidentCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Quick Metrics Glance in Sidebar */}
          <div className="px-3 pt-2">
            <div className="p-3.5 rounded-xl bg-surface/60 border border-border space-y-2.5">
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="flex items-center gap-1.5 font-medium">
                  <Layers size={13} className="text-primary-light" /> Fleet Nodes
                </span>
                <span className="font-mono text-white font-semibold">
                  {summary?.servers.online ?? 0} / {summary?.servers.total ?? 0}
                </span>
              </div>
              <div className="w-full bg-background rounded-full h-1.5 overflow-hidden flex">
                <div
                  className="bg-healthy h-full transition-all duration-500"
                  style={{
                    width: `${
                      summary?.servers.total
                        ? ((summary.servers.online) / summary.servers.total) * 100
                        : 0
                    }%`,
                  }}
                />
                <div
                  className="bg-warning h-full transition-all duration-500"
                  style={{
                    width: `${
                      summary?.servers.total
                        ? (summary.servers.suspect / summary.servers.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted font-mono">
                <span className="flex items-center gap-1 text-healthy">
                  <span className="w-1.5 h-1.5 rounded-full bg-healthy" /> Online
                </span>
                <span className="flex items-center gap-1 text-warning">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning" /> Warning
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Footer: System heartbeat & status */}
        <div className="p-4 border-t border-border space-y-3 bg-background/40">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-surface/50 border border-border">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  wsStatus === 'connected'
                    ? 'bg-healthy animate-pulse-glow shadow-glow-healthy'
                    : 'bg-warning'
                }`}
              />
              <span className="text-muted font-mono text-[11px]">
                {wsStatus === 'connected' ? 'WS STREAM' : 'POLLING'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-healthy bg-healthy/10 px-1.5 py-0.5 rounded border border-healthy/20">
              99.98% SLA
            </span>
          </div>

          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-primary to-cyan flex items-center justify-center font-bold text-white text-xs shadow-sm">
                {user?.email?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="overflow-hidden">
                <div className="text-white text-xs font-semibold truncate max-w-[105px]">
                  {user?.email?.split('@')[0] || 'admin'}
                </div>
                <div className="text-[10px] font-mono text-muted uppercase">
                  {user?.role || 'ADMIN'}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-muted hover:text-critical hover:bg-critical/10 rounded-lg transition-colors border border-transparent hover:border-critical/20"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Modern Top Header Bar */}
        <header className="h-16 glass-panel border-b border-border px-8 flex items-center justify-between z-10">
          {/* Breadcrumb & Current Context */}
          <div className="flex items-center gap-2.5 text-sm">
            <Link to="/" className="text-muted hover:text-white transition-colors font-medium">
              SentriX
            </Link>
            <ChevronRight size={14} className="text-muted/60" />
            <span className="font-semibold text-white tracking-tight">
              {currentNav?.label || 'Workstation'}
            </span>
          </div>

          {/* Center search shortcut pill */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="relative w-80 hidden md:flex items-center justify-between bg-surface/70 border border-border hover:border-primary/50 rounded-xl pl-9 pr-3 py-1.5 text-xs text-muted hover:text-white transition-all shadow-sm group text-left"
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted group-hover:text-primary transition-colors" size={14} />
            <span>Search platform, nodes, metrics...</span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-highlight text-muted border border-border group-hover:border-primary/40 group-hover:text-white transition-colors">
              ⌘K
            </kbd>
          </button>

          {/* Right Live indicators & actions */}
          <div className="flex items-center gap-3">
            {/* Live Streaming Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/80 border border-border text-[11px] font-mono text-muted">
              <Radio size={12} className="text-healthy animate-pulse" />
              <span className="text-white font-medium">Real-Time Ingestion</span>
              <span className="text-healthy">• 5s</span>
            </div>

            {/* Quick status button */}
            <div className="flex items-center gap-1 text-xs text-healthy font-mono bg-healthy/10 px-2.5 py-1 rounded-full border border-healthy/20">
              <CheckCircle2 size={13} />
              <span>All Systems Nominal</span>
            </div>
          </div>
        </header>

        {/* Scrollable Workstation Canvas */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </main>
      </div>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}
