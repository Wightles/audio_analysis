import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { attachAudio, createMeeting, db, deleteMeeting, findMeeting, getAnalysis, getDashboardStats, getTranscript, listMeetings, saveAnalysis, setMeetingStatus, upsertTranscript } from './db.js';
import { isAuthenticated, login, logout, requireAuth } from './auth.js';
import { AIProviderFactory } from './ai/factory.js';
import { AIProviderUnavailableError } from './ai/provider.js';
import { MeetingAnalysisService, TranscriptionService, type MeetingContext } from './ai/services.js';
import { AnalysisValidationError, validateRoyalBrickReport } from './ai/validation.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const demoPassword = process.env.DEMO_PASSWORD ?? 'royal-brick-demo';
process.env.DEMO_PASSWORD = demoPassword;
const storageDirectory = path.resolve(process.env.STORAGE_DIR ?? 'server/storage');
const temporaryAudioDirectory = path.join(storageDirectory, '.tmp');
const finalAudioDirectory = path.join(storageDirectory, 'audio');
fs.mkdirSync(temporaryAudioDirectory, { recursive: true });
fs.mkdirSync(finalAudioDirectory, { recursive: true });
const maxAudioSize = Number(process.env.MAX_AUDIO_SIZE_MB ?? 250) * 1024 * 1024;
const allowedExtensions = new Set(['.mp3', '.wav', '.webm', '.m4a']);
const allowedMimeTypes = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/webm', 'audio/mp4', 'audio/x-m4a', 'video/mp4', 'application/octet-stream']);
const consentVersion = '1.0';
const aiProvider = AIProviderFactory.create();
const transcriptionService = new TranscriptionService(aiProvider);
const meetingAnalysisService = new MeetingAnalysisService(aiProvider);

const audioUpload = multer({
  storage: multer.diskStorage({
    destination: temporaryAudioDirectory,
    filename: (_request, file, callback) => callback(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: maxAudioSize },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, allowedExtensions.has(extension) && allowedMimeTypes.has(file.mimetype));
  },
});

const resolveAudioPath = (relativePath: string): string => {
  const resolved = path.resolve(storageDirectory, relativePath);
  if (!resolved.startsWith(`${storageDirectory}${path.sep}`)) throw new Error('Некорректный путь к аудиофайлу');
  return resolved;
};

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', clientOrigin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (request.method === 'OPTIONS') {
    response.status(204).send();
    return;
  }
  next();
});

app.get('/health', (_request, response) => response.json({ ok: true }));

app.get('/api/auth/session', (request, response) => response.json({ authenticated: isAuthenticated(request) }));
app.post('/api/auth/login', (request, response) => {
  const parsed = z.object({ password: z.string().min(1) }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Введите пароль' });
    return;
  }
  login(request, response, parsed.data.password);
});
app.post('/api/auth/logout', logout);

app.use('/api', requireAuth);
app.get('/api/dashboard/stats', (_request, response) => response.json(getDashboardStats()));
app.get('/api/meetings', (_request, response) => response.json(listMeetings()));
app.get('/api/meetings/:id', (request, response) => {
  const meeting = findMeeting(Number(request.params.id));
  if (!meeting) {
    response.status(404).json({ error: 'Встреча не найдена' });
    return;
  }
  response.json(meeting);
});
app.post('/api/meetings', (request, response) => {
  const parsed = z.object({
    title: z.string().trim().min(1).max(160),
    managerName: z.string().trim().min(1).max(120),
    meetingDate: z.string().datetime({ offset: true }),
  }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Проверьте название, имя менеджера и дату встречи' });
    return;
  }
  response.status(201).json(createMeeting(parsed.data));
});
app.post('/api/meetings/:id/audio', audioUpload.single('audio'), (request, response) => {
  const meetingId = Number(request.params.id);
  const meeting = findMeeting(meetingId);
  if (!meeting) {
    if (request.file) fs.rmSync(request.file.path, { force: true });
    response.status(404).json({ error: 'Встреча не найдена' });
    return;
  }
  if (!request.file) {
    response.status(400).json({ error: 'Выберите аудиофайл в формате MP3, WAV, WebM или M4A' });
    return;
  }

  const parsed = z.object({
    duration: z.coerce.number().int().min(0).nullable().optional(),
    consentType: z.enum(['recording', 'audio_upload']),
    confirmedAt: z.string().datetime({ offset: true }),
  }).safeParse(request.body);
  if (!parsed.success) {
    fs.rmSync(request.file.path, { force: true });
    response.status(400).json({ error: 'Не подтверждено согласие на сохранение аудиозаписи' });
    return;
  }

  const originalFilename = path.basename(request.file.originalname);
  const extension = path.extname(originalFilename).toLowerCase();
  const audioHash = crypto.createHash('sha256').update(fs.readFileSync(request.file.path)).digest('hex');
  const duplicate = (db.prepare('SELECT id FROM meetings WHERE audio_hash = ?').get(audioHash) as { id: number } | undefined);
  if (duplicate) {
    fs.rmSync(request.file.path, { force: true });
    response.status(409).json({ error: `Этот файл уже импортирован во встречу №${duplicate.id}` });
    return;
  }

  const relativeAudioPath = path.join('audio', `${crypto.randomUUID()}${extension}`);
  const finalPath = resolveAudioPath(relativeAudioPath);
  fs.renameSync(request.file.path, finalPath);
  try {
    const updated = attachAudio({
      meetingId,
      audioPath: relativeAudioPath,
      audioMimeType: request.file.mimetype,
      originalFilename,
      audioHash,
      duration: parsed.data.duration ?? null,
      consentType: parsed.data.consentType,
      consentVersion,
      confirmedAt: parsed.data.confirmedAt,
    });
    if (!updated) {
      fs.rmSync(finalPath, { force: true });
      response.status(404).json({ error: 'Встреча не найдена' });
      return;
    }
    response.status(201).json(updated);
  } catch (error) {
    fs.rmSync(finalPath, { force: true });
    if (String(error).includes('UNIQUE constraint failed')) {
      response.status(409).json({ error: 'Этот аудиофайл уже сохранён' });
      return;
    }
    throw error;
  }
});
app.get('/api/meetings/:id/audio', (request, response) => {
  const meeting = findMeeting(Number(request.params.id));
  if (!meeting?.audioPath) {
    response.status(404).json({ error: 'Аудиозапись не найдена' });
    return;
  }
  const audioPath = resolveAudioPath(meeting.audioPath);
  if (!fs.existsSync(audioPath)) {
    response.status(404).json({ error: 'Файл аудиозаписи отсутствует на диске' });
    return;
  }
  response.type(meeting.audioMimeType ?? path.extname(audioPath));
  response.sendFile(audioPath);
});
app.delete('/api/meetings/:id', (request, response) => {
  const result = deleteMeeting(Number(request.params.id));
  if (!result.deleted) {
    response.status(404).json({ error: 'Встреча не найдена' });
    return;
  }
  if (result.audioPath) fs.rmSync(resolveAudioPath(result.audioPath), { force: true });
  response.status(204).send();
});
app.get('/api/meetings/:id/transcript', (request, response) => {
  const meetingId = Number(request.params.id);
  if (!findMeeting(meetingId)) {
    response.status(404).json({ error: 'Встреча не найдена' });
    return;
  }
  response.json(getTranscript(meetingId));
});
app.put('/api/meetings/:id/transcript', (request, response) => {
  const meetingId = Number(request.params.id);
  if (!findMeeting(meetingId)) {
    response.status(404).json({ error: 'Встреча не найдена' });
    return;
  }
  const parsed = z.object({
    content: z.string().max(20_000_000),
    segments: z.array(z.object({
      startSeconds: z.number().finite().nullable(),
      endSeconds: z.number().finite().nullable(),
      speaker: z.string().max(120).nullable(),
      text: z.string().max(20_000),
    })).max(100_000).default([]),
  }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Расшифровка имеет неверный формат' });
    return;
  }
  response.json(upsertTranscript(meetingId, parsed.data.content, parsed.data.segments));
});
app.post('/api/meetings/:id/transcribe', async (request, response, next) => {
  const meetingId = Number(request.params.id);
  const meeting = findMeeting(meetingId);
  if (!meeting) {
    response.status(404).json({ error: 'Встреча не найдена' });
    return;
  }
  if (!meeting.audioPath) {
    response.status(400).json({ error: 'Для транскрибации сначала сохраните аудиозапись' });
    return;
  }
  try {
    setMeetingStatus(meetingId, 'transcribing');
    const result = await transcriptionService.transcribe({
      filePath: resolveAudioPath(meeting.audioPath),
      mimeType: meeting.audioMimeType ?? 'application/octet-stream',
      filename: meeting.originalFilename ?? path.basename(meeting.audioPath),
      durationSeconds: meeting.duration,
    });
    const transcript = upsertTranscript(meetingId, result.content, result.segments);
    setMeetingStatus(meetingId, 'recorded');
    response.status(201).json({ transcript, provider: result.provider, language: result.language });
  } catch (error) {
    if (!(error instanceof AIProviderUnavailableError)) setMeetingStatus(meetingId, 'error');
    next(error);
  }
});
app.post('/api/meetings/:id/analyze', async (request, response, next) => {
  const meetingId = Number(request.params.id);
  const meeting = findMeeting(meetingId);
  if (!meeting) {
    response.status(404).json({ error: 'Встреча не найдена' });
    return;
  }
  const transcript = getTranscript(meetingId);
  if (!transcript.content.trim()) {
    response.status(400).json({ error: 'Сначала добавьте или получите расшифровку встречи' });
    return;
  }
  const context: MeetingContext = { meetingId, managerName: meeting.managerName, meetingDate: meeting.meetingDate };
  try {
    setMeetingStatus(meetingId, 'analyzing');
    const report = await meetingAnalysisService.analyze({ content: transcript.content, segments: transcript.segments, language: null, provider: 'manual' }, context);
    const scoreSummary = validateRoyalBrickReport(report);
    const analysis = saveAnalysis(meetingId, scoreSummary.normalizedScore, scoreSummary.coverage, report);
    setMeetingStatus(meetingId, 'analyzed');
    response.status(201).json(analysis);
  } catch (error) {
    if (!(error instanceof AIProviderUnavailableError)) setMeetingStatus(meetingId, 'error');
    next(error);
  }
});
app.get('/api/meetings/:id/analysis', (request, response) => {
  const meetingId = Number(request.params.id);
  if (!findMeeting(meetingId)) {
    response.status(404).json({ error: 'Встреча не найдена' });
    return;
  }
  const analysis = getAnalysis(meetingId);
  if (!analysis) {
    response.status(404).json({ error: 'Анализ ещё не выполнен' });
    return;
  }
  response.json(analysis);
});

const clientDist = path.resolve('client/dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.use((request, response, next) => {
    if (request.method === 'GET' && request.accepts('html')) {
      response.sendFile(path.join(clientDist, 'index.html'));
      return;
    }
    next();
  });
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (error instanceof AIProviderUnavailableError) {
    response.status(503).json({ error: error.message, code: error.code });
    return;
  }
  if (error instanceof AnalysisValidationError) {
    response.status(422).json({ error: error.message, code: error.code });
    return;
  }
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    response.status(413).json({ error: `Файл превышает допустимый размер ${process.env.MAX_AUDIO_SIZE_MB ?? 250} МБ` });
    return;
  }
  if (error instanceof multer.MulterError || String(error).includes('Unexpected field')) {
    response.status(400).json({ error: 'Не удалось принять аудиофайл. Проверьте формат и размер.' });
    return;
  }
  response.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(port, () => console.log(`Royal Brick AI Auditor server listening on http://localhost:${port}`));
