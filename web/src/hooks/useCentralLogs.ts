import { useQuery } from '@tanstack/react-query';
import { fetchJSON } from '../lib/api';

export interface StructuredLogEntry {
  id: string;
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  service: string;
  server: string;
  server_id: string;
  message: string;
  trace_id?: string;
  request_id?: string;
}

export interface CentralLogsResponse {
  total: number;
  logs: StructuredLogEntry[];
}

export interface LogFilterParams {
  query?: string;
  level?: string;
  service?: string;
  server_id?: string;
  trace_id?: string;
  limit?: number;
}

export function useCentralLogs(params: LogFilterParams, liveTail: boolean = false) {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set('query', params.query);
  if (params.level && params.level !== 'ALL') searchParams.set('level', params.level);
  if (params.service) searchParams.set('service', params.service);
  if (params.server_id) searchParams.set('server_id', params.server_id);
  if (params.trace_id) searchParams.set('trace_id', params.trace_id);
  if (params.limit) searchParams.set('limit', params.limit.toString());

  return useQuery<CentralLogsResponse>({
    queryKey: ['central-logs', params],
    queryFn: () => fetchJSON(`/logs?${searchParams.toString()}`),
    refetchInterval: liveTail ? 3000 : false,
  });
}
