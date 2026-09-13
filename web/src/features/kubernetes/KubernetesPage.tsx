import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { 
  Network, Cpu, HardDrive, RefreshCw, Activity, Layers, 
  CheckCircle2, AlertTriangle, XCircle, Clock, Server, Shield
} from 'lucide-react';
import { MetricCard, EmptyState, LoadingState } from '../../components/ui/Primitives';

interface K8sOverview {
  cluster_name: string;
  version: string;
  status: string;
  total_nodes: number;
  ready_nodes: number;
  total_pods: number;
  running_pods: number;
  pending_pods: number;
  failed_pods: number;
  total_cpu_milli: number;
  allocated_cpu_milli: number;
  total_memory_bytes: number;
  allocated_memory_bytes: number;
  last_sync_at: string;
}

interface K8sNode {
  name: string;
  role: string;
  status: string;
  internal_ip: string;
  os_image: string;
  kubelet_version: string;
  cpu_usage_pct: number;
  memory_usage_pct: number;
  memory_pressure: boolean;
  disk_pressure: boolean;
  pid_pressure: boolean;
  pod_count: number;
  pod_capacity: number;
  labels: Record<string, string>;
}

interface K8sDeployment {
  name: string;
  namespace: string;
  desired_replicas: number;
  available_replicas: number;
  updated_replicas: number;
  image: string;
  status: string;
}

interface K8sPod {
  name: string;
  namespace: string;
  node: string;
  phase: string;
  restart_count: number;
  oom_killed: boolean;
  ip: string;
  image: string;
  cpu_usage_pct: number;
  mem_usage_mb: number;
  created_at: string;
}

interface K8sClusterEvent {
  id: string;
  type: string;
  reason: string;
  message: string;
  object: string;
  namespace: string;
  timestamp: string;
}

export const KubernetesPage: React.FC = () => {
  const [overview, setOverview] = useState<K8sOverview | null>(null);
  const [nodes, setNodes] = useState<K8sNode[]>([]);
  const [deployments, setDeployments] = useState<K8sDeployment[]>([]);
  const [pods, setPods] = useState<K8sPod[]>([]);
  const [events, setEvents] = useState<K8sClusterEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'nodes' | 'workloads' | 'pods' | 'events'>('nodes');

  const fetchK8sData = async () => {
    try {
      setLoading(true);
      const [ovRes, nodesRes, workloadsRes] = await Promise.all([
        api.get('/kubernetes/overview'),
        api.get('/kubernetes/nodes'),
        api.get('/kubernetes/workloads'),
      ]);
      setOverview(ovRes.data);
      setNodes(nodesRes.data);
      setDeployments(workloadsRes.data.deployments || []);
      setPods(workloadsRes.data.pods || []);
      setEvents(workloadsRes.data.events || []);
    } catch (err) {
      console.error('Failed to load Kubernetes data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchK8sData();
  }, []);

  const formatGB = (bytes: number) => {
    return (bytes / (1024 * 1024 * 1024)).toFixed(0) + ' GB';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Kubernetes Cluster Fleet</h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
              K8s EKS / Vanilla
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Hierarchical cluster visibility: nodes, daemonsets, deployments, pods, and cluster scheduling events.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchK8sData}
            className="flex items-center gap-2 px-3 py-2 bg-[#1b1e24] hover:bg-[#252932] border border-[#2e3440] text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Cluster
          </button>
        </div>
      </div>

      {/* Cluster Overview KPIs */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Cluster State"
            value={overview.status}
            subtitle={`${overview.cluster_name} (${overview.version})`}
            icon={<Shield className="w-5 h-5 text-emerald-400" />}
          />
          <MetricCard
            title="Ready Nodes"
            value={`${overview.ready_nodes} / ${overview.total_nodes}`}
            subtitle="100% Schedulable"
            icon={<Server className="w-5 h-5 text-blue-400" />}
          />
          <MetricCard
            title="Active Pods"
            value={`${overview.running_pods} / ${overview.total_pods}`}
            subtitle={`${overview.pending_pods} Pending, ${overview.failed_pods} Failed`}
            icon={<Layers className="w-5 h-5 text-purple-400" />}
          />
          <MetricCard
            title="Resource Allocation"
            value={`${(overview.allocated_cpu_milli / 1000).toFixed(0)} / ${(overview.total_cpu_milli / 1000).toFixed(0)} Cores`}
            subtitle={`RAM: ${formatGB(overview.allocated_memory_bytes)} / ${formatGB(overview.total_memory_bytes)}`}
            icon={<Cpu className="w-5 h-5 text-cyan-400" />}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#232730] pb-2">
        <button
          onClick={() => setActiveTab('nodes')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'nodes'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-gray-400 hover:text-white hover:bg-[#181c23]'
          }`}
        >
          Nodes ({nodes.length})
        </button>
        <button
          onClick={() => setActiveTab('workloads')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'workloads'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-gray-400 hover:text-white hover:bg-[#181c23]'
          }`}
        >
          Deployments ({deployments.length})
        </button>
        <button
          onClick={() => setActiveTab('pods')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'pods'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-gray-400 hover:text-white hover:bg-[#181c23]'
          }`}
        >
          Pods ({pods.length})
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'events'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-gray-400 hover:text-white hover:bg-[#181c23]'
          }`}
        >
          Cluster Events ({events.length})
        </button>
      </div>

      {loading ? (
        <LoadingState message="Querying Kubernetes API server..." />
      ) : (
        <div className="bg-[#13161b] border border-[#232730] rounded-xl overflow-hidden shadow-xl">
          {activeTab === 'nodes' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-[#171a21] text-xs uppercase tracking-wider text-gray-400 border-b border-[#232730]">
                  <tr>
                    <th className="px-6 py-3 font-medium">Node Name & Role</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">CPU Saturation</th>
                    <th className="px-6 py-3 font-medium">Memory Saturation</th>
                    <th className="px-6 py-3 font-medium">Conditions</th>
                    <th className="px-6 py-3 font-medium">Pod Capacity</th>
                    <th className="px-6 py-3 font-medium">Kubelet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e222a]">
                  {nodes.map(n => (
                    <tr key={n.name} className="hover:bg-[#181c23] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm font-medium text-white">{n.name}</div>
                        <div className="text-xs text-gray-400">{n.role} • {n.internal_ip}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {n.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-mono font-medium text-white mb-1">{n.cpu_usage_pct.toFixed(1)}%</div>
                        <div className="w-24 bg-[#1e222a] rounded-full h-1.5 overflow-hidden">
                          <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${n.cpu_usage_pct}%` }} />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-mono font-medium text-white mb-1">{n.memory_usage_pct.toFixed(1)}%</div>
                        <div className="w-24 bg-[#1e222a] rounded-full h-1.5 overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${n.memory_usage_pct}%` }} />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Ready</span>
                          {!n.memory_pressure && !n.disk_pressure && (
                            <span className="px-1.5 py-0.5 rounded bg-[#1e222a] text-gray-400">NoPressure</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-400">
                        {n.pod_count} / {n.pod_capacity}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-blue-400">
                        {n.kubelet_version}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'workloads' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-[#171a21] text-xs uppercase tracking-wider text-gray-400 border-b border-[#232730]">
                  <tr>
                    <th className="px-6 py-3 font-medium">Deployment Name</th>
                    <th className="px-6 py-3 font-medium">Namespace</th>
                    <th className="px-6 py-3 font-medium">Replicas (Ready / Desired)</th>
                    <th className="px-6 py-3 font-medium">Container Image</th>
                    <th className="px-6 py-3 font-medium">Health Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e222a]">
                  {deployments.map(d => (
                    <tr key={d.name} className="hover:bg-[#181c23] transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{d.name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {d.namespace}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        <span className={d.available_replicas === d.desired_replicas ? 'text-emerald-400' : 'text-amber-400 font-bold'}>
                          {d.available_replicas}
                        </span> / {d.desired_replicas} Ready
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-400">{d.image}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          d.status === 'HEALTHY'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'pods' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-[#171a21] text-xs uppercase tracking-wider text-gray-400 border-b border-[#232730]">
                  <tr>
                    <th className="px-6 py-3 font-medium">Pod Name</th>
                    <th className="px-6 py-3 font-medium">Namespace</th>
                    <th className="px-6 py-3 font-medium">Assigned Node</th>
                    <th className="px-6 py-3 font-medium">Phase</th>
                    <th className="px-6 py-3 font-medium">Restarts</th>
                    <th className="px-6 py-3 font-medium">CPU & Memory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e222a]">
                  {pods.map(p => (
                    <tr key={p.name} className="hover:bg-[#181c23] transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-medium text-white">{p.name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-purple-500/10 text-purple-400">
                          {p.namespace}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-400">{p.node}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          p.phase === 'Running'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {p.phase}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-300">{p.restart_count}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-400">
                        {p.cpu_usage_pct.toFixed(1)}% • {p.mem_usage_mb} MB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="divide-y divide-[#1e222a]">
              {events.map(ev => (
                <div key={ev.id} className="p-4 flex items-start gap-3 hover:bg-[#181c23] transition-colors">
                  {ev.type === 'Warning' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{ev.reason}</span>
                        <span className="font-mono text-xs text-purple-400">{ev.object}</span>
                      </div>
                      <span className="text-xs text-gray-500">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs text-gray-300">{ev.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
