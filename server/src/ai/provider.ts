import type { MeetingContext } from './services.js';
import type { RoyalBrickReport } from './report.js';

export interface AudioInput {
  filePath: string;
  mimeType: string;
  filename: string;
  durationSeconds: number | null;
}

export interface TranscriptSegment {
  startSeconds: number | null;
  endSeconds: number | null;
  speaker: string | null;
  text: string;
}

export interface TranscriptionResult {
  content: string;
  segments: TranscriptSegment[];
  language: string | null;
  provider: string;
}

export interface AIProvider {
  readonly name: string;
  transcribeAudio(audio: AudioInput): Promise<TranscriptionResult>;
  analyzeMeeting(transcript: TranscriptionResult, context: MeetingContext): Promise<RoyalBrickReport>;
}

export class AIProviderUnavailableError extends Error {
  readonly code = 'AI_PROVIDER_NOT_CONFIGURED';
  constructor(message = 'ИИ-провайдер пока не подключён') {
    super(message);
    this.name = 'AIProviderUnavailableError';
  }
}

export class AIProviderRequestError extends Error {
  readonly code = 'AI_PROVIDER_REQUEST_FAILED';
  constructor(message: string) {
    super(message);
    this.name = 'AIProviderRequestError';
  }
}
