import React, { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, LucideIcon } from 'lucide-react';

export type BadgeVariant = 'healthy' | 'warning' | 'critical' | 'neutral' | 'primary' | 'mono';

export function Badge({
  children,
  variant = 'neutral',
  icon: Icon,
  className = '',
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  icon?: LucideIcon;
  className?: string;
}) {
  let styles = 'bg-surface border-border text-muted';

  switch (variant) {
    case 'healthy':
      styles = 'bg-healthy/15 text-healthy border-healthy/30';
      break;
    case 'warning':
      styles = 'bg-warning/15 text-warning border-warning/30';
      break;
    case 'critical':
      styles = 'bg-critical/15 text-critical border-critical/30';
      break;
    case 'primary':
      styles = 'bg-primary/20 text-primary-light border-primary/30';
      break;
    case 'mono':
      styles = 'bg-background/80 text-white/90 border-border font-mono';
      break;
  }

  const renderBadgeIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) return Icon;
    if (typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null)) {
      return React.createElement(Icon as any, { size: 12 });
    }
    return null;
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles} ${className}`}
    >
      {renderBadgeIcon()}
      <span>{children}</span>
    </span>
  );
}

export function MetricCard({
  label,
  title,
  subtitle,
  value,
  unit,
  icon,
  trend,
  color = 'primary',
  onClick,
}: {
  label?: string;
  title?: string;
  subtitle?: string;
  value: string | number;
  unit?: string;
  icon?: any;
  trend?: { value: number; label: string };
  color?: 'primary' | 'warning' | 'healthy' | 'critical';
  onClick?: () => void;
}) {
  let colorClass = 'text-primary-light bg-primary/10 border-primary/25';
  if (color === 'warning') colorClass = 'text-warning bg-warning/10 border-warning/25';
  if (color === 'healthy') colorClass = 'text-healthy bg-healthy/10 border-healthy/25';
  if (color === 'critical') colorClass = 'text-critical bg-critical/10 border-critical/25';

  const displayLabel = label || title || '';

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null)) {
      return React.createElement(icon as any, { size: 16 });
    }
    return null;
  };

  return (
    <div
      onClick={onClick}
      className={`glass-card p-5 rounded-2xl border border-border space-y-3 transition-all ${
        onClick ? 'cursor-pointer hover:border-border-strong hover:scale-[1.01]' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted font-medium">{displayLabel}</span>
        {icon && (
          <div className={`p-2 rounded-xl border ${colorClass}`}>
            {renderIcon()}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black text-white tracking-tight">{value}</span>
        {unit && <span className="text-xs font-mono text-muted">{unit}</span>}
      </div>
      {subtitle && (
        <div className="text-[11px] font-mono text-muted truncate">
          {subtitle}
        </div>
      )}
      {trend && (
        <div className="text-[11px] font-mono text-muted flex items-center gap-1">
          <span className={trend.value >= 0 ? 'text-healthy' : 'text-critical'}>
            {trend.value >= 0 ? '+' : ''}
            {trend.value}%
          </span>
          <span>{trend.label}</span>
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Info,
  action,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="p-12 text-center space-y-4 glass-card rounded-2xl border border-border">
      <div className="w-12 h-12 rounded-2xl bg-surface border border-border mx-auto flex items-center justify-center text-muted">
        <Icon size={22} />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-muted max-w-sm mx-auto">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
      {actionLabel && onAction && (
        <div className="pt-2">
          <button
            onClick={onAction}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary transition-all"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  confirmVariant = 'critical',
  onConfirm,
  onCancel,
  loading = false,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: 'critical' | 'primary' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!isOpen) return null;

  let btnColor = 'bg-critical hover:bg-critical/80 text-white';
  if (confirmVariant === 'primary') btnColor = 'bg-primary hover:bg-primary/80 text-white';
  if (confirmVariant === 'warning') btnColor = 'bg-warning hover:bg-warning/80 text-black font-bold';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3 text-white">
          <AlertTriangle size={20} className="text-warning flex-shrink-0" />
          <h3 className="font-bold text-white text-base">{title}</h3>
        </div>
        <p className="text-xs text-muted leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2.5 pt-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-surface border border-border text-xs text-muted hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${btnColor}`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="p-12 text-center space-y-3 glass-card rounded-2xl border border-border">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-xs font-mono text-muted">{message}</p>
    </div>
  );
}

