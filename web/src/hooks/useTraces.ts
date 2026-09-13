import { useQuery } from '@tanstack/react-query';
import { fetchJSON } from '../lib/api';

export interface Span {
  span_id: string;
  parent_span_id?: string | null;
  trace_id: string;
  service_name: string;
  operation: string;
  duration_ms: number;
  start_time: string;
  status: 'OK' | 'ERROR';
  status_code?: number;
  attributes?: Record<string, any>;
}

export interface TraceDetail {
  trace_id: string;
  root_service: string;
  root_operation: string;
  duration_ms: number;
  start_time: string;
  status: 'OK' | 'ERROR';
  span_count: number;
  spans: Span[];
}

export interface TraceFilterParams {
  service?: string;
  operation?: string;
  status?: string;
  min_duration_ms?: number;
}

export function useTraces(params: TraceFilterParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.service) searchParams.set('service', params.service);
  if (params.operation) searchParams.set('operation', params.operation);
  if (params.status && params.status !== 'ALL') searchParams.set('status', params.status);
  if (params.min_duration_ms) searchParams.set('min_duration_ms', params.min_duration_ms.toString());

  return useQuery<TraceDetail[]>({
    queryKey: ['traces', params],
    queryFn: () => fetchJSON(`/traces?${searchParams.toString()}`),
    refetchInterval: 10000,
  });
}

export function useTraceDetail(traceId: string | undefined) {
  return useQuery<TraceDetail>({
    queryKey: ['trace', traceId],
    queryFn: () => fetchJSON(`/traces/${traceId}`),
    enabled: !!traceId,
  });
}
