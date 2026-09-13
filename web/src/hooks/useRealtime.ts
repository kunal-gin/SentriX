import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { API_BASE, mutateJSON } from '../lib/api';

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';

const WS_URL = `${API_BASE.replace(/^http/, 'ws')}/ws`;

interface WsTicketResponse {
  ticket: string;
  expires_in: number;
}

interface RealtimeEvent {
  type: string;
  timestamp: string;
  payload?: Record<string, any>;
}

export function useRealtime(): RealtimeStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');

  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    function invalidateForEvent(event: RealtimeEvent) {
      switch (event.type) {
        case 'dashboard.updated':
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
          queryClient.invalidateQueries({ queryKey: ['servers'] });
          queryClient.invalidateQueries({ queryKey: ['incidents'] });
          queryClient.invalidateQueries({ queryKey: ['checks'] });
          break;

        case 'server.updated':
        case 'server.telemetry':
          queryClient.invalidateQueries({ queryKey: ['servers'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });

          if (event.payload?.server_id) {
            queryClient.invalidateQueries({
              queryKey: ['server-metrics', event.payload.server_id],
            });
          }
          break;

        case 'incident.updated':
          queryClient.invalidateQueries({ queryKey: ['incidents'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
          break;

        case 'check.updated':
          queryClient.invalidateQueries({ queryKey: ['checks'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
          break;

        case 'alert.state_changed':
          queryClient.invalidateQueries({ queryKey: ['incidents'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
          break;

        default:
          break;
      }
    }

    async function connect() {
      if (disposed) {
        return;
      }

      try {
        const ticketResponse = await mutateJSON<WsTicketResponse>(
          '/auth/ws-ticket',
          'POST'
        );

        const url = `${WS_URL}?ticket=${encodeURIComponent(ticketResponse.ticket)}`;

        ws = new WebSocket(url);

        setStatus('connecting');

        ws.onopen = () => {
          if (disposed) {
            return;
          }

          setStatus('connected');
          attempts = 0;
        };

        ws.onmessage = (messageEvent) => {
          try {
            const parsed = JSON.parse(messageEvent.data) as RealtimeEvent;
            invalidateForEvent(parsed);
          } catch {
            // Ignore malformed realtime messages.
          }
        };

        ws.onclose = () => {
          if (disposed) {
            return;
          }

          setStatus('disconnected');

          const delay = Math.min(1000 * 2 ** attempts, 15000);
          attempts += 1;

          reconnectTimer = setTimeout(connect, delay);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        if (disposed) {
          return;
        }

        setStatus('disconnected');

        const delay = Math.min(1000 * 2 ** attempts, 15000);
        attempts += 1;

        reconnectTimer = setTimeout(connect, delay);
      }
    }

    connect();

    return () => {
      disposed = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [queryClient]);

  return status;
}
