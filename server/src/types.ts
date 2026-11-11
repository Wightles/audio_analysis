export type MeetingStatus = 'recorded' | 'transcribing' | 'analyzing' | 'analyzed' | 'error';

export interface Meeting {
  id: number;
  title: string;
  managerName: string;
  meetingDate: string;
  duration: number | null;
  audioPath: string | null;
  status: MeetingStatus;
  createdAt: string;
}

export interface DashboardStats {
  totalMeetings: number;
  analyzedMeetings: number;
  averageScore: number | null;
}
