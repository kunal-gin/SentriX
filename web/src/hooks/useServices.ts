import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJSON, mutateJSON } from '../lib/api';

export interface ServiceEntity {
  id: string;
  name: string;
  description: string;
  environment: string;
  tier: string;
  criticality: string;
  owner: string;
  team: string;
  repository: string;
  health: 'HEALTHY' | 'DEGRADED' | 'FAILING';
  server_count: number;
  incident_count: number;
  uptime: number;
  created_at: string;
}

export interface FleetHost {
  id: string;
  name: string;
  hostname: string;
  platform: string;
  os: string;
  kernel: string;
  arch: string;
  status: 'ONLINE' | 'SUSPECT' | 'OFFLINE';
  cpu: number;
  memory: number;
  disk: number;
  agent_version: string;
  uptime_hours: number;
  last_seen: string;
}

export function useServices() {
  return useQuery<ServiceEntity[]>({
    queryKey: ['services'],
    queryFn: () => fetchJSON('/services'),
    refetchInterval: 10000,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<ServiceEntity>) =>
      mutateJSON<ServiceEntity>('/services', 'POST', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useInfrastructure() {
  return useQuery<FleetHost[]>({
    queryKey: ['infrastructure'],
    queryFn: () => fetchJSON('/infrastructure'),
    refetchInterval: 5000,
  });
}
