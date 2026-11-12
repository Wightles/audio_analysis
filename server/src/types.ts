export type MeetingStatus = 'recorded' | 'transcribing' | 'analyzing' | 'analyzed' | 'error';

export interface Meeting {
  id: number;
  title: string;
  managerName: string;
  meetingDate: string;
  duration: number | null;
  audioPath: string | null;
  audioMimeType: string | null;
  originalFilename: string | null;
  status: MeetingStatus;
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
  sourceStartSeconds: number | null;
  sourceEndSeconds: number | null;
  updatedAt: string | null;
}

export interface AnalysisRecord {
  id: number;
  meetingId: number;
  score: number | null;
  coverage: number | null;
  result: unknown;
  sourceStartSeconds: number | null;
  sourceEndSeconds: number | null;
  createdAt: string;
}
