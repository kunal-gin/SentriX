import { useQuery } from '@tanstack/react-query';
import { fetchJSON } from '../lib/api';

export interface MapNode {
  id: string;
  label: string;
  type: 'INGRESS' | 'SERVICE' | 'DATABASE' | 'CACHE';
  health: 'HEALTHY' | 'DEGRADED' | 'FAILING';
  rps: number;
  latency_ms: number;
  error_pct: number;
}

export interface MapEdge {
  source: string;
  target: string;
  call_rate_rps: number;
  latency_ms: number;
  status: 'OK' | 'SLOW' | 'ERROR';
}

export interface ServiceMapData {
  nodes: MapNode[];
  edges: MapEdge[];
}

export interface SyntheticCheckResult {
  id: string;
  name: string;
  target_url: string;
  type: 'HTTP' | 'TCP' | 'DNS' | 'TLS';
  interval_sec: number;
  status: 'PASSING' | 'FAILING';
  latency_ms: number;
  dns_ms: number;
  tls_ms: number;
  ttfb_ms: number;
  availability: number;
  last_check_at: string;
}

export function useServiceMap() {
  return useQuery<ServiceMapData>({
    queryKey: ['service-map'],
    queryFn: () => fetchJSON('/service-map'),
    refetchInterval: 10000,
  });
}

export function useSynthetics() {
  return useQuery<SyntheticCheckResult[]>({
    queryKey: ['synthetics'],
    queryFn: () => fetchJSON('/synthetics'),
    refetchInterval: 10000,
  });
}
