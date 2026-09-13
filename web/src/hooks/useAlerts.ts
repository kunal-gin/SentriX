import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJSON, mutateJSON } from '../lib/api';

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  window_seconds: number;
  for_seconds: number;
  severity: string;
  enabled: boolean;
  cooldown_seconds: number;
  resolve_threshold: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAlertRuleInput {
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  window_seconds: number;
  for_seconds: number;
  severity: string;
  enabled: boolean;
  cooldown_seconds: number;
  resolve_threshold: number | null;
}

export interface Incident {
  id: string;
  server_id: string;
  server_name: string;
  title: string;
  severity: string;
  status: string;
  started_at: string;
  resolved_at: string | null;
}

export function useAlertRules() {
  return useQuery<AlertRule[]>({
    queryKey: ['alert-rules'],
    queryFn: () => fetchJSON('/alerts/rules'),
    refetchInterval: 10000,
  });
}

export function useCreateAlertRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAlertRuleInput) =>
      mutateJSON('/alerts/rules', 'POST', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
  });
}

export function useDeleteAlertRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ruleId: string) =>
      mutateJSON(`/alerts/rules/${ruleId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
  });
}

export function useIncidents(status: 'open' | 'all' = 'open') {
  return useQuery<Incident[]>({
    queryKey: ['incidents', status],
    queryFn: () => fetchJSON(`/incidents?status=${status}`),
    refetchInterval: 5000,
  });
}
