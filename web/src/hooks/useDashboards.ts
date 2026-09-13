import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJSON, mutateJSON } from '../lib/api';

export interface DashboardWidget {
  id: string;
  type: 'METRIC_LINE' | 'METRIC_GAUGE' | 'LOG_STREAM' | 'ALERT_LIST' | 'PROCESS_LIST';
  title: string;
  metric?: string;
  col_span: number;
  config?: Record<string, any>;
}

export interface Dashboard {
  id: string;
  title: string;
  description: string;
  is_default: boolean;
  widgets: DashboardWidget[];
  created_at: string;
  updated_at: string;
}

export function useDashboards() {
  return useQuery<Dashboard[]>({
    queryKey: ['dashboards'],
    queryFn: () => fetchJSON('/dashboards'),
    refetchInterval: 10000,
  });
}

export function useCreateDashboard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<Dashboard>) =>
      mutateJSON<Dashboard>('/dashboards', 'POST', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    },
  });
}
