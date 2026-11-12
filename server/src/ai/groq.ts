import fs from 'node:fs';
import type { AIProvider, AudioInput, TranscriptionResult } from './provider.js';
import { AIProviderLimitError, AIProviderRequestError } from './provider.js';
import type { MeetingContext } from './services.js';
import type { RoyalBrickReport } from './report.js';

const groqBaseUrl = 'https://api.groq.com/openai/v1';

const throwGroqError = async (response: Response, action: string): Promise<never> => {
  const body = await response.text();
  let detail = '';
  try {
    const payload = JSON.parse(body) as { error?: { message?: string } };
    detail = payload.error?.message?.trim() ?? '';
  } catch {
    detail = body.replace(/\s+/g, ' ').trim().slice(0, 240);
  }
  const suffix = detail ? ` — ${detail}` : '';
  if (response.status === 413) {
    throw new AIProviderLimitError(`Groq отклонил слишком большой запрос. Полный системный промпт Royal Brick и расшифровка превышают лимит токенов организации; требуется тариф Groq с большим TPM или другой провайдер${suffix}`);
  }
  if (response.status === 429) {
    throw new AIProviderLimitError(`${action}: HTTP ${response.status}${suffix}`);
  }
  throw new AIProviderRequestError(`${action}: HTTP ${response.status}${suffix}`);
};

const parseJsonResponse = (value: string): unknown => {
  const withoutFence = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(withoutFence) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const report = parsed as Record<string, unknown>;
      if (report.reportVersion === 1 || report.reportVersion === '1') report.reportVersion = '1.0';
      const clientAnalysis = report.clientAnalysis;
      if (clientAnalysis && typeof clientAnalysis === 'object' && !Array.isArray(clientAnalysis)) {
        const client = clientAnalysis as Record<string, unknown>;
        for (const key of ['additionalFeatures', 'keyCriteria', 'explicitConcerns', 'probableConcerns', 'positiveReactions', 'negativeReactions']) {
          if (!(key in client)) client[key] = [];
        }
      }
      const clientRecommendations = report.clientRecommendations;
      if (clientRecommendations && typeof clientRecommendations === 'object' && !Array.isArray(clientRecommendations)) {
        const recommendations = clientRecommendations as Record<string, unknown>;
        for (const key of ['arguments', 'materials', 'avoidSaying']) {
          if (!(key in recommendations)) recommendations[key] = [];
        }
      }
      const overallAssessment = report.overallAssessment;
      if (overallAssessment && typeof overallAssessment === 'object' && !Array.isArray(overallAssessment)) {
        const overall = overallAssessment as Record<string, unknown>;
        if (typeof overall.summary !== 'string') overall.summary = 'Недостаточно данных для общей оценки выбранного фрагмента.';
        if (!overall.priceSequence || typeof overall.priceSequence !== 'object' || Array.isArray(overall.priceSequence)) {
          overall.priceSequence = {
            panelCount: 'no_data',
            listPrice: 'no_data',
            installment: 'no_data',
            salePrice: 'no_data',
            immediateClosing: 'no_data',
            sequence: 'no_data',
            mainIssue: null,
          };
        }
      }
    }
    return parsed;
  } catch {
    throw new AIProviderRequestError('Groq вернул некорректный JSON-отчёт');
  }
};

export class GroqAIProvider implements AIProvider {
  readonly name = 'groq';
  private readonly transcriptionModel = process.env.GROQ_TRANSCRIPTION_MODEL ?? 'whisper-large-v3-turbo';
  private readonly analysisModel = process.env.GROQ_ANALYSIS_MODEL ?? 'openai/gpt-oss-120b';
  private readonly maxAudioBytes = Number(process.env.GROQ_MAX_AUDIO_SIZE_MB ?? 25) * 1024 * 1024;

  constructor(private readonly apiKey: string) {}

  async transcribeAudio(audio: AudioInput): Promise<TranscriptionResult> {
    const stat = fs.statSync(audio.filePath);
    if (stat.size > this.maxAudioBytes) throw new AIProviderLimitError(`Файл превышает лимит Groq ${Math.round(this.maxAudioBytes / 1024 / 1024)} МБ. Для больших записей потребуется chunking или другой провайдер.`);
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(audio.filePath)], { type: audio.mimeType }), audio.filename);
    form.append('model', this.transcriptionModel);
    form.append('language', process.env.GROQ_LANGUAGE ?? 'ru');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'segment');
    form.append('prompt', 'Royal Brick, фибробетон, фасадные панели, цокольные панели');
    const response = await fetch(`${groqBaseUrl}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}` }, body: form });
    if (!response.ok) await throwGroqError(response, 'Ошибка транскрибации Groq');
    const payload = await response.json() as { text?: string; language?: string; segments?: Array<{ start?: number; end?: number; text?: string }> };
    return { content: payload.text ?? '', language: payload.language ?? process.env.GROQ_LANGUAGE ?? 'ru', provider: this.name, segments: (payload.segments ?? []).map((segment) => ({ startSeconds: segment.start ?? null, endSeconds: segment.end ?? null, speaker: null, text: segment.text ?? '' })) };
  }

  async analyzeMeeting(transcript: TranscriptionResult, context: MeetingContext): Promise<RoyalBrickReport> {
    const userPayload = JSON.stringify({ meetingId: context.meetingId, managerName: context.managerName, meetingDate: context.meetingDate, transcript: transcript.content, segments: transcript.segments });
    const response = await fetch(`${groqBaseUrl}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.analysisModel, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: `${context.systemPrompt}\n\nВерни только валидный JSON строго по интерфейсу RoyalBrickReport версии 1.0. Не придумывай факты, цитаты, оценки и коммерческие условия.` }, { role: 'user', content: userPayload }] }) });
    if (!response.ok) await throwGroqError(response, 'Ошибка анализа Groq');
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new AIProviderRequestError('Groq не вернул содержимое отчёта');
    return parseJsonResponse(content) as RoyalBrickReport;
  }
}
