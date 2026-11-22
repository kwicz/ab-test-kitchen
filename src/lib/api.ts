import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Client, Decision, Experiment, PlatformId, PlatformInfo } from '../../shared/types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((body as { error?: string }).error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

/** Retry network hiccups, never 4xx answers. */
export const shouldRetry = (count: number, err: unknown) => !(err instanceof ApiError && err.status < 500) && count < 2;

export const useExperiments = () => useQuery({ queryKey: ['experiments'], queryFn: () => request<Experiment[]>('/api/experiments') });

export const useExperiment = (id: number) =>
  useQuery({ queryKey: ['experiments', id], queryFn: () => request<Experiment>(`/api/experiments/${id}`) });

export const useClients = () => useQuery({ queryKey: ['clients'], queryFn: () => request<Client[]>('/api/clients') });

export const usePlatforms = () => useQuery({ queryKey: ['platforms'], queryFn: () => request<PlatformInfo[]>('/api/platforms') });

export const useConfig = () => useQuery({ queryKey: ['config'], queryFn: () => request<{ demoMode: boolean }>('/api/config') });

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useUpdateExperiment(id: number) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (patch: { decision?: Decision | null; decisionVariantId?: number | null; notes?: string | null; mde?: number }) =>
      request<Experiment>(`/api/experiments/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: invalidate,
  });
}

export function useSync() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (platform: PlatformId) => request<{ source: string; count: number }>(`/api/platforms/${platform}/sync`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useCsvImport() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: { platform: PlatformId; clientName?: string; csv: string }) =>
      request<{ count: number; warnings: string[]; names: string[] }>('/api/import/csv', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useResetDemo() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: () => request('/api/demo/reset', { method: 'POST' }), onSuccess: invalidate });
}
