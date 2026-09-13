import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  Activity,
  AlertTriangle,
  BellRing,
  ShieldCheck,
  Users,
  Bell,
  Sliders,
  Plus,
  ArrowRight,
  Sparkles,
  Server,
  FileCode,
  FileText,
  Layers,
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Actions' | 'Tools';
  icon: any;
  action: () => void;
  shortcut?: string;
}

export function CommandPalette({
  isOpen,
  onClose,
  onOpenEnroll,
  onOpenSilence,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenEnroll?: () => void;
  onOpenSilence?: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items: CommandItem[] = [
    {
      id: 'nav-overview',
      title: 'Fleet Overview & Node Health',
      category: 'Navigation',
      icon: LayoutDashboard,
      action: () => navigate('/'),
      shortcut: 'G O',
    },
    {
      id: 'nav-metrics',
      title: 'Metrics Explorer (Multi-Node Comparison)',
      category: 'Navigation',
      icon: Activity,
      action: () => navigate('/metrics'),
      shortcut: 'G M',
    },
    {
      id: 'nav-logs',
      title: 'Centralized Structured Logs (Live Tail)',
      category: 'Navigation',
      icon: FileText,
      action: () => navigate('/logs'),
      shortcut: 'G L',
    },
    {
      id: 'nav-services',
      title: 'Service Catalog & Microservice Tiers',
      category: 'Navigation',
      icon: Layers,
      action: () => navigate('/services'),
      shortcut: 'G S',
    },
    {
      id: 'nav-infrastructure',
      title: 'Infrastructure & Host Fleet Matrix',
      category: 'Navigation',
      icon: Server,
      action: () => navigate('/infrastructure'),
      shortcut: 'G F',
    },
    {
      id: 'nav-incidents',
      title: 'Incident Triage & Lifecycles',
      category: 'Navigation',
      icon: AlertTriangle,
      action: () => navigate('/incidents'),
      shortcut: 'G I',
    },
    {
      id: 'nav-alerts',
      title: 'Alert Rules & Thresholds',
      category: 'Navigation',
      icon: BellRing,
      action: () => navigate('/alerts'),
      shortcut: 'G A',
    },
    {
      id: 'nav-checks',
      title: 'Synthetic Health Checks Probes',
      category: 'Navigation',
      icon: Activity,
      action: () => navigate('/checks'),
      shortcut: 'G C',
    },
    {
      id: 'nav-notifications',
      title: 'Notification Channels & Webhooks',
      category: 'Navigation',
      icon: Bell,
      action: () => navigate('/notifications'),
      shortcut: 'G N',
    },
    {
      id: 'nav-users',
      title: 'Team & RBAC Access Management',
      category: 'Navigation',
      icon: Users,
      action: () => navigate('/users'),
      shortcut: 'G U',
    },
    {
      id: 'nav-audit',
      title: 'Audit Logs & Security Compliance',
      category: 'Navigation',
      icon: ShieldCheck,
      action: () => navigate('/audit'),
      shortcut: 'G L',
    },
    {
      id: 'act-enroll',
      title: 'Enroll New Node (1-Click Install)',
      category: 'Actions',
      icon: Plus,
      action: () => {
        if (onOpenEnroll) onOpenEnroll();
        else navigate('/');
      },
    },
    {
      id: 'act-silence',
      title: 'Schedule Maintenance Window (Silence Alerts)',
      category: 'Actions',
      icon: Sliders,
      action: () => {
        if (onOpenSilence) onOpenSilence();
      },
    },
    {
      id: 'tool-prom',
      title: 'Inspect Prometheus /metrics Endpoint',
      category: 'Tools',
      icon: FileCode,
      action: () => window.open('/metrics', '_blank'),
    },
  ];

  const filtered = items.filter((item) => {
    return (
      query === '' ||
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by parent or state
        }
      }

      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onClose();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-2 relative animate-in zoom-in-95 duration-150">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-border gap-3">
          <Search size={18} className="text-muted" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search platform features..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-muted focus:outline-none"
          />
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-background border border-border text-muted">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto px-2 pb-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">No commands or views match your search.</div>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary text-white shadow-glow-primary' : 'hover:bg-surface-highlight text-muted hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} className={isSelected ? 'text-white' : 'text-primary-light'} />
                    <span className="text-xs font-medium text-white">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-background border border-border text-muted'}`}>
                      {item.category}
                    </span>
                    {isSelected && <ArrowRight size={12} className="text-white" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-background/80 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted">
          <div className="flex items-center gap-2">
            <Sparkles size={12} className="text-primary-light" />
            <span>SentriX Command Palette</span>
          </div>
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
          </div>
        </div>
      </div>
    </div>
  );
}
