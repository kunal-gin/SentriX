import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJSON, mutateJSON } from '../lib/api';

export interface Check {
  id: string;
  server_id: string;
  server_name: string;
  type: 'PROCESS' | 'SERVICE' | 'PORT' | 'COMMAND';
  name: string;
  enabled: boolean;
  interval_seconds: number;
  timeout_seconds: number;
  failure_threshold: number;
  success_threshold: number;
  severity: string;
  config: Record<string, any>;
  state: string | null;
  consecutive_failures: number | null;
  last_message: string | null;
  last_result_at: string | null;
  created_at: string;
}

export interface CreateCheckInput {
  server_id: string;
  type: string;
  name: string;
  enabled: boolean;
  interval_seconds: number;
  timeout_seconds: number;
  failure_threshold: number;
  success_threshold: number;
  severity: string;
  config: Record<string, any>;
}

export function useChecks(serverId?: string) {
  const path = serverId ? `/checks?server_id=${serverId}` : '/checks';

  return useQuery<Check[]>({
    queryKey: ['checks', serverId ?? 'all'],
    queryFn: () => fetchJSON(path),
    refetchInterval: 5000,
  });
}

export function useCreateCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCheckInput) =>
      mutateJSON('/checks', 'POST', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checks'] });
    },
  });
}

export function useDeleteCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkId: string) =>
      mutateJSON(`/checks/${checkId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checks'] });
    },
  });
}
