import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchJSON, mutateJSON } from '../lib/api';

export interface IncidentComment {
  id: string;
  user_id: string;
  user_email: string | null;
  body: string;
  created_at: string;
}

export interface IncidentTimelineEvent {
  id: string;
  event_type: 'OPENED' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'COMMENT' | 'SYSTEM';
  message: string;
  actor_id: string | null;
  actor_email: string | null;
  created_at: string;
}

export interface IncidentDetail {
  id: string;
  server_id: string;
  server_name: string;
  title: string;
  severity: string;
  status: string;
  started_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  acknowledged_by: string | null;
  resolved_by: string | null;
  root_alert_id: string | null;
  root_check_id: string | null;
  summary: string | null;
  comments: IncidentComment[];
  timeline: IncidentTimelineEvent[];
}

export function useIncident(incidentId: string | undefined) {
  return useQuery<IncidentDetail>({
    queryKey: ['incident', incidentId],
    queryFn: () => fetchJSON(`/incidents/${incidentId}`),
    enabled: !!incidentId,
    refetchInterval: 10000,
  });
}

export function useAcknowledgeIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { incidentId: string }) =>
      mutateJSON(`/incidents/${variables.incidentId}/ack`, 'POST', {}),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incident', variables.incidentId] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useResolveIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { incidentId: string }) =>
      mutateJSON(`/incidents/${variables.incidentId}/resolve`, 'POST', {}),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incident', variables.incidentId] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useAddIncidentComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { incidentId: string; body: string }) =>
      mutateJSON(`/incidents/${variables.incidentId}/comments`, 'POST', {
        body: variables.body,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incident', variables.incidentId] });
    },
  });
}
