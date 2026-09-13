import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJSON, mutateJSON } from '../lib/api';

export interface SLOEntity {
  id: string;
  name: string;
  service: string;
  target_percent: number;
  current_percent: number;
  time_window: string;
  error_budget_minutes: number;
  consumed_minutes: number;
  burn_rate: number;
  status: 'HEALTHY' | 'AT_RISK' | 'BREACHED';
  sli_type: 'AVAILABILITY' | 'LATENCY' | 'ERROR_RATE';
  created_at: string;
}

export function useSLOs() {
  return useQuery<SLOEntity[]>({
    queryKey: ['slos'],
    queryFn: () => fetchJSON('/slos'),
    refetchInterval: 10000,
  });
}

export function useCreateSLO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<SLOEntity>) =>
      mutateJSON<SLOEntity>('/slos', 'POST', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slos'] });
    },
  });
}
