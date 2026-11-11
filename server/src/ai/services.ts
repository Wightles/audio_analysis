import type { AIProvider, AudioInput, TranscriptionResult } from './provider.js';
import type { RoyalBrickReport } from './report.js';

export interface MeetingContext {
  meetingId: number;
  managerName: string;
  meetingDate: string;
  crmData?: string;
  clientHistory?: string;
  companyRules?: string;
  productKnowledge?: string;
}

export class TranscriptionService {
  constructor(private readonly provider: AIProvider) {}
  transcribe(audio: AudioInput): Promise<TranscriptionResult> {
    return this.provider.transcribeAudio(audio);
  }
}

export class MeetingAnalysisService {
  constructor(private readonly provider: AIProvider) {}
  analyze(transcript: TranscriptionResult, context: MeetingContext): Promise<RoyalBrickReport> {
    return this.provider.analyzeMeeting(transcript, context);
  }
}
