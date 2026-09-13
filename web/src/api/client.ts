import { fetchJSON, mutateJSON } from '../lib/api';

export const api = {
  async get<T = any>(path: string): Promise<{ data: T }> {
    const data = await fetchJSON<T>(path);
    return { data };
  },

  async post<T = any>(path: string, body?: any): Promise<{ data: T }> {
    const data = await mutateJSON<T>(path, 'POST', body);
    return { data };
  },

  async patch<T = any>(path: string, body?: any): Promise<{ data: T }> {
    const data = await mutateJSON<T>(path, 'PATCH', body);
    return { data };
  },

  async delete<T = any>(path: string): Promise<{ data: T }> {
    const data = await mutateJSON<T>(path, 'DELETE');
    return { data };
  },
};
