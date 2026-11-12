import fs from 'node:fs';
import type { AIProvider, AudioInput, TranscriptionResult } from './provider.js';
import { AIProviderRequestError } from './provider.js';
import type { MeetingContext } from './services.js';
import type { RoyalBrickReport } from './report.js';

const groqBaseUrl = 'https://api.groq.com/openai/v1';

const parseJsonResponse = (value: string): unknown => {
  const withoutFence = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(withoutFence) as unknown; } catch { throw new AIProviderRequestError('Groq вернул некорректный JSON-отчёт'); }
};

export class GroqAIProvider implements AIProvider {
  readonly name = 'groq';
  private readonly transcriptionModel = process.env.GROQ_TRANSCRIPTION_MODEL ?? 'whisper-large-v3-turbo';
  private readonly analysisModel = process.env.GROQ_ANALYSIS_MODEL ?? 'llama-3.3-70b-versatile';
  private readonly maxAudioBytes = Number(process.env.GROQ_MAX_AUDIO_SIZE_MB ?? 25) * 1024 * 1024;

  constructor(private readonly apiKey: string) {}

  async transcribeAudio(audio: AudioInput): Promise<TranscriptionResult> {
    const stat = fs.statSync(audio.filePath);
    if (stat.size > this.maxAudioBytes) throw new AIProviderRequestError(`Файл превышает лимит Groq ${Math.round(this.maxAudioBytes / 1024 / 1024)} МБ. Для больших записей потребуется chunking или другой провайдер.`);
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(audio.filePath)], { type: audio.mimeType }), audio.filename);
    form.append('model', this.transcriptionModel);
    form.append('language', process.env.GROQ_LANGUAGE ?? 'ru');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'segment');
    form.append('prompt', 'Royal Brick, фибробетон, фасадные панели, цокольные панели');
    const response = await fetch(`${groqBaseUrl}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}` }, body: form });
    if (!response.ok) throw new AIProviderRequestError(`Ошибка транскрибации Groq: HTTP ${response.status}`);
    const payload = await response.json() as { text?: string; language?: string; segments?: Array<{ start?: number; end?: number; text?: string }> };
    return { content: payload.text ?? '', language: payload.language ?? process.env.GROQ_LANGUAGE ?? 'ru', provider: this.name, segments: (payload.segments ?? []).map((segment) => ({ startSeconds: segment.start ?? null, endSeconds: segment.end ?? null, speaker: null, text: segment.text ?? '' })) };
  }

  async analyzeMeeting(transcript: TranscriptionResult, context: MeetingContext): Promise<RoyalBrickReport> {
    const userPayload = JSON.stringify({ meetingId: context.meetingId, managerName: context.managerName, meetingDate: context.meetingDate, transcript: transcript.content, segments: transcript.segments });
    const response = await fetch(`${groqBaseUrl}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.analysisModel, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: `${context.systemPrompt}\n\nВерни только валидный JSON строго по интерфейсу RoyalBrickReport версии 1.0. Не придумывай факты, цитаты, оценки и коммерческие условия.` }, { role: 'user', content: userPayload }] }) });
    if (!response.ok) throw new AIProviderRequestError(`Ошибка анализа Groq: HTTP ${response.status}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new AIProviderRequestError('Groq не вернул содержимое отчёта');
    return parseJsonResponse(content) as RoyalBrickReport;
  }
}
