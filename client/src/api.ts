export interface Meeting {
  id: number;
  title: string;
  managerName: string;
  meetingDate: string;
  duration: number | null;
  audioPath: string | null;
  audioMimeType: string | null;
  originalFilename: string | null;
  status: 'recorded' | 'transcribing' | 'analyzing' | 'analyzed' | 'error';
  createdAt: string;
}

export interface DashboardStats {
  totalMeetings: number;
  analyzedMeetings: number;
  averageScore: number | null;
}

export interface TranscriptSegment {
  startSeconds: number | null;
  endSeconds: number | null;
  speaker: string | null;
  text: string;
}

export interface TranscriptRecord {
  id: number | null;
  meetingId: number;
  content: string;
  segments: TranscriptSegment[];
  updatedAt: string | null;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!(options?.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { credentials: 'include', ...options, headers });
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
  meeting: (id: number) => request<Meeting>(`/api/meetings/${id}`),
  transcript: (id: number) => request<TranscriptRecord>(`/api/meetings/${id}/transcript`),
  saveTranscript: (id: number, content: string, segments: TranscriptSegment[] = []) => request<TranscriptRecord>(`/api/meetings/${id}/transcript`, { method: 'PUT', body: JSON.stringify({ content, segments }) }),
  transcribe: (id: number) => request<{ transcript: TranscriptRecord; provider: string; language: string | null }>(`/api/meetings/${id}/transcribe`, { method: 'POST', body: JSON.stringify({}) }),
  createMeeting: (input: { title: string; managerName: string; meetingDate: string }) => request<Meeting>('/api/meetings', { method: 'POST', body: JSON.stringify(input) }),
  uploadAudio: (id: number, file: Blob, filename: string, duration: number | null, consentType: 'recording' | 'audio_upload', confirmedAt: string) => {
    const form = new FormData();
    form.append('audio', file, filename);
    if (duration !== null) form.append('duration', String(duration));
    form.append('consentType', consentType);
    form.append('confirmedAt', confirmedAt);
    return request<Meeting>(`/api/meetings/${id}/audio`, { method: 'POST', body: form });
  },
  audioUrl: (id: number) => `/api/meetings/${id}/audio`,
  deleteMeeting: (id: number) => request<void>(`/api/meetings/${id}`, { method: 'DELETE' }),
};
