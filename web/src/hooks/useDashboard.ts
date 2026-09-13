import { useQuery } from '@tanstack/react-query';
import { fetchJSON } from '../lib/api';

export interface DashboardSummary {
  servers: { total: number; online: number; suspect: number; offline: number };
  incidents: { open: number; critical: number };
}

export interface Server {
  id: string;
  name: string;
  hostname: string;
  platform: string;
  status: 'ONLINE' | 'SUSPECT' | 'OFFLINE';
  last_seen: string;
  cpu: number | null;
  memory: number | null;
  disk: number | null;
}

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => fetchJSON('/dashboard/summary'),
    refetchInterval: 5000, // Refresh every 5 seconds for "real-time" feel
  });
}

export function useServers() {
  return useQuery<Server[]>({
    queryKey: ['servers'],
    queryFn: () => fetchJSON('/servers'),
    refetchInterval: 5000,
  });
}
