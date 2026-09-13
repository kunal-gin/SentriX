import { useState } from 'react';
import { useServiceMap, useSynthetics } from '../../hooks/useServiceMap';
import {
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Server,
  ArrowRight,
  Radio,
  Globe,
  Clock,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export function ServiceMapPage() {
  const { data: serviceMap, isLoading: mapLoading } = useServiceMap();
  const { data: synthetics, isLoading: synLoading } = useSynthetics();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const nodes = serviceMap?.nodes || [];
  const edges = serviceMap?.edges || [];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Service Dependency Graph & Synthetics
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary/20 text-primary-light border border-primary/30">
              Live Topology
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Dynamic service topology, call rates, latency bottlenecks, and synthetic availability monitors.
          </p>
        </div>
      </div>

      {/* Interactive Service Topology Map Canvas */}
      <div className="glass-card rounded-2xl p-6 border border-border shadow-glass space-y-6">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-primary-light" />
            <h2 className="text-base font-bold text-white">Microservice Mesh & Storage Dependencies</h2>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-muted">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-healthy" /> Healthy</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" /> Degraded</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-critical" /> Failing</span>
          </div>
        </div>

        {/* Visual Node Grid & Connected Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {nodes.map((node) => {
            const isDegraded = node.health === 'DEGRADED';
            const isFailing = node.health === 'FAILING';
            const isSelected = selectedNode === node.id;

            return (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node.id)}
                className={`glass-card-interactive rounded-2xl p-5 border transition-all cursor-pointer ${
                  isDegraded
                    ? 'border-warning/50 bg-warning/5 shadow-glow-warning'
                    : isFailing
                    ? 'border-critical/50 bg-critical/5 shadow-glow-critical'
                    : isSelected
                    ? 'border-primary shadow-glow-primary bg-surface-elevated'
                    : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-primary-light">
                    {node.type}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      isDegraded
                        ? 'bg-warning/20 text-warning border-warning/30 animate-pulse'
                        : isFailing
                        ? 'bg-critical/20 text-critical border-critical/30'
                        : 'bg-healthy/15 text-healthy border-healthy/30'
                    }`}
                  >
                    {node.health}
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="text-base font-bold text-white">{node.label}</h3>
                  <div className="text-[11px] font-mono text-muted mt-0.5">{node.id}</div>
                </div>

                {/* Telemetry Numbers */}
                <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div>
                    <div className="text-[10px] text-muted">Throughput</div>
                    <div className="font-bold text-white mt-0.5">{node.rps} rps</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted">Latency</div>
                    <div className="font-bold text-primary-light mt-0.5">{node.latency_ms} ms</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted">Error Rate</div>
                    <div
                      className={`font-bold mt-0.5 ${
                        node.error_pct > 1 ? 'text-critical' : 'text-healthy'
                      }`}
                    >
                      {node.error_pct}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Call Flows */}
        <div className="p-4 rounded-xl bg-surface/50 border border-border space-y-3">
          <div className="text-xs font-mono text-muted uppercase tracking-wider">
            Inter-Service Call Flows & Link Latency
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {edges.map((edge, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-background/60 border border-border flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-white font-bold">{edge.source}</span>
                  <ArrowRight size={12} className="text-primary-light shrink-0" />
                  <span className="text-text-dim truncate">{edge.target}</span>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="font-bold text-white">{edge.latency_ms} ms</div>
                  <div className="text-[10px] text-muted">{edge.call_rate_rps} rps</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* External Synthetic Monitoring Section */}
      <div className="glass-card rounded-2xl p-6 border border-border shadow-glass space-y-6">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-primary-light" />
            <h2 className="text-base font-bold text-white">External Synthetic Availability Probes</h2>
          </div>
          <div className="text-xs font-mono text-muted">Global SRE Healthchecks</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(synthetics || []).map((syn) => {
            const isPassing = syn.status === 'PASSING';

            return (
              <div
                key={syn.id}
                className="glass-card rounded-2xl p-5 border border-border flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-primary-light">
                      {syn.type} PROBE ({syn.interval_sec}s)
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        isPassing
                          ? 'bg-healthy/15 text-healthy border-healthy/30'
                          : 'bg-critical/15 text-critical border-critical/30'
                      }`}
                    >
                      <CheckCircle2 size={11} />
                      {syn.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white">{syn.name}</h3>
                  <div className="text-[11px] font-mono text-muted truncate">{syn.target_url}</div>

                  <div className="p-3 rounded-xl bg-background/60 border border-border/70 grid grid-cols-4 gap-1 text-center text-xs font-mono">
                    <div>
                      <div className="text-[9px] text-muted uppercase">DNS</div>
                      <div className="font-bold text-white mt-0.5">{syn.dns_ms}ms</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted uppercase">TLS</div>
                      <div className="font-bold text-white mt-0.5">{syn.tls_ms}ms</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted uppercase">TTFB</div>
                      <div className="font-bold text-white mt-0.5">{syn.ttfb_ms}ms</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted uppercase">Uptime</div>
                      <div className="font-bold text-healthy mt-0.5">{syn.availability}%</div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted">
                  <span>Latency: <strong className="text-white">{syn.latency_ms} ms</strong></span>
                  <span>Checked: {new Date(syn.last_check_at).toLocaleTimeString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
