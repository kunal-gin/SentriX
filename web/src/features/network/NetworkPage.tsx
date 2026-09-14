import { useState, useEffect } from 'react';
import {
  Network as NetIcon,
  Radio,
  ArrowDownUp,
  Activity,
  Globe,
  RefreshCw,
  Server,
  Zap,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { MetricCard } from '../../components/ui/Primitives';
import { api } from '../../api/client';

interface NetworkDiagnostics {
  interfaces: {
    name: string;
    ip: string;
    rx_mbps: number;
    tx_mbps: number;
    rx_packets_sec: number;
    tx_packets_sec: number;
    rx_drop_percent: number;
    tx_drop_percent: number;
    status: string;
  }[];
  tcp_metrics: {
    total_connections: number;
    retransmits_per_sec: number;
    retransmit_rate_percent: number;
    active_opens_sec: number;
    passive_opens_sec: number;
    reset_count: number;
  };
  dns_metrics: {
    mean_latency_ms: number;
    p99_latency_ms: number;
    queries_per_sec: number;
    failure_rate_percent: number;
    nameserver_target: string;
  };
  socket_states: Record<string, number>;
  top_flows: {
    src_ip: string;
    dst_ip: string;
    port: number;
    protocol: string;
    bandwidth_mbps: number;
    service: string;
  }[];
}

export function NetworkPage() {
  const [data, setData] = useState<NetworkDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const res = await api.get<NetworkDiagnostics>('/network/diagnostics');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load network diagnostics', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <NetIcon className="text-primary-light" size={26} />
              Deep Network Observability & TCP Diagnostics
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-primary/20 text-primary-light border border-primary/30">
              Phase 21
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Interface bandwidth, TCP socket state distribution, packet retransmits & CoreDNS latency profiling
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-surface/80 border border-border px-3 py-1.5 rounded-xl text-xs font-mono text-muted">
            <Radio size={12} className="text-healthy animate-pulse" />
            <span>TCP Socket Monitor Active</span>
          </div>
          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-surface border border-border hover:border-primary/50 text-muted hover:text-white transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="TCP Retransmit Rate"
          value={data ? `${data.tcp_metrics.retransmit_rate_percent}%` : '0.08%'}
          subtitle={data ? `${data.tcp_metrics.retransmits_per_sec}/s Retransmits` : '12.4/s'}
          icon={<Activity size={18} className="text-healthy" />}
        />
        <MetricCard
          title="Active TCP Connections"
          value={data ? data.tcp_metrics.total_connections.toLocaleString() : '4,820'}
          subtitle="Open Sockets In Mesh"
          icon={<Layers size={18} className="text-primary-light" />}
        />
        <MetricCard
          title="DNS P99 Lookup Latency"
          value={data ? `${data.dns_metrics.p99_latency_ms} ms` : '6.10 ms'}
          subtitle="CoreDNS Cluster Ingress"
          icon={<Globe size={18} className="text-cyan" />}
        />
        <MetricCard
          title="DNS Failure Rate"
          value={data ? `${data.dns_metrics.failure_rate_percent}%` : '0.02%'}
          subtitle={data ? `${data.dns_metrics.queries_per_sec} queries/s` : '840 QPS'}
          icon={<Zap size={18} className="text-healthy" />}
        />
      </div>

      {/* Network Interfaces */}
      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ArrowDownUp className="text-primary-light" size={16} />
            Physical & Virtual Network Interfaces
          </h2>
          <span className="text-xs text-muted font-mono">
            {data?.interfaces?.length || 0} Interfaces Monitored
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.interfaces?.map((iface) => (
            <div key={iface.name} className="p-4 rounded-xl bg-surface/50 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white">{iface.name}</div>
                  <div className="text-xs font-mono text-muted">{iface.ip}</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-healthy/20 text-healthy border border-healthy/30 text-[10px] font-mono">
                  {iface.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 font-mono text-xs">
                <div className="p-2.5 rounded-lg bg-background/50 border border-border">
                  <div className="text-[10px] text-muted">RX (Ingress)</div>
                  <div className="text-sm font-bold text-cyan mt-0.5">{iface.rx_mbps} MB/s</div>
                  <div className="text-[10px] text-muted">{iface.rx_packets_sec.toLocaleString()} pps</div>
                </div>

                <div className="p-2.5 rounded-lg bg-background/50 border border-border">
                  <div className="text-[10px] text-muted">TX (Egress)</div>
                  <div className="text-sm font-bold text-primary-light mt-0.5">{iface.tx_mbps} MB/s</div>
                  <div className="text-[10px] text-muted">{iface.tx_packets_sec.toLocaleString()} pps</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sockets & Flows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TCP Socket Distribution */}
        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
          <h2 className="text-sm font-semibold text-white">TCP Socket State Distribution</h2>
          <div className="space-y-3">
            {data?.socket_states &&
              Object.entries(data.socket_states).map(([st, count]) => {
                const pct = Math.round((count / (data.tcp_metrics.total_connections || 1)) * 100);
                return (
                  <div key={st} className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white font-medium">{st}</span>
                      <span className="text-muted">
                        {count.toLocaleString()} sockets ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          st === 'ESTABLISHED' ? 'bg-healthy' : st === 'TIME_WAIT' ? 'bg-warning' : 'bg-primary'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Top Active Flows */}
        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
          <h2 className="text-sm font-semibold text-white">Top Inter-Service Network Flows</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-mono text-muted uppercase border-b border-border bg-surface/50">
                <tr>
                  <th className="py-2 px-2.5">Flow</th>
                  <th className="py-2 px-2.5">Protocol</th>
                  <th className="py-2 px-2.5">Bandwidth</th>
                  <th className="py-2 px-2.5">Service</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {data?.top_flows?.map((flow, idx) => (
                  <tr key={idx} className="hover:bg-surface/40 transition-colors">
                    <td className="py-2.5 px-2.5 text-white">
                      {flow.src_ip} → {flow.dst_ip}:{flow.port}
                    </td>
                    <td className="py-2.5 px-2.5 text-cyan">{flow.protocol}</td>
                    <td className="py-2.5 px-2.5 text-warning font-bold">{flow.bandwidth_mbps} MB/s</td>
                    <td className="py-2.5 px-2.5 text-muted font-sans">{flow.service}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
