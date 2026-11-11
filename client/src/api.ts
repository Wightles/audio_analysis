export interface Meeting {
  id: number;
  title: string;
  managerName: string;
  meetingDate: string;
  duration: number | null;
  audioPath: string | null;
  status: 'recorded' | 'transcribing' | 'analyzing' | 'analyzed' | 'error';
  createdAt: string;
}

export interface DashboardStats {
  totalMeetings: number;
  analyzedMeetings: number;
  averageScore: number | null;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
    throw new Error(body.error ?? 'Ошибка запроса');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  session: () => request<{ authenticated: boolean }>('/api/auth/session'),
  login: (password: string) => request<{ authenticated: boolean }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  stats: () => request<DashboardStats>('/api/dashboard/stats'),
  meetings: () => request<Meeting[]>('/api/meetings'),
  deleteMeeting: (id: number) => request<void>(`/api/meetings/${id}`, { method: 'DELETE' }),
};
