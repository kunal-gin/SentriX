import { useQuery } from '@tanstack/react-query';
import { fetchJSON } from '../lib/api';

export interface MetricPoint {
  time: string;
  value: number;
}

export interface MetricHistory {
  server_id: string;
  metric: string;
  range: string;
  unit: string;
  points: MetricPoint[];
}

export function useServerMetrics(
  serverId: string | undefined,
  metric: string,
  range: string
) {
  return useQuery<MetricHistory>({
    queryKey: ['server-metrics', serverId, metric, range],
    queryFn: () =>
      fetchJSON(`/servers/${serverId}/metrics?metric=${metric}&range=${range}`),
    enabled: !!serverId,
    refetchInterval: 10000,
  });
}
