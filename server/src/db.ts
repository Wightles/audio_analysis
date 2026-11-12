import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { AnalysisRecord, DashboardStats, Meeting, MeetingStatus, TranscriptRecord, TranscriptSegment } from './types.js';

const dataDirectory = path.resolve(process.env.DATA_DIR ?? 'server/data');
fs.mkdirSync(dataDirectory, { recursive: true });

export const db = new Database(path.join(dataDirectory, 'royal-brick.db'));
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    manager_name TEXT NOT NULL,
    meeting_date TEXT NOT NULL,
    duration_seconds INTEGER,
    audio_path TEXT,
    audio_mime_type TEXT,
    original_filename TEXT,
    audio_hash TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'recorded',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL UNIQUE,
    content TEXT NOT NULL DEFAULT '',
    segments_json TEXT NOT NULL DEFAULT '[]',
    source_start_seconds REAL,
    source_end_seconds REAL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL UNIQUE,
    score REAL,
    coverage REAL,
    result_json TEXT NOT NULL,
    source_start INTEGER,
    source_end INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    consent_type TEXT NOT NULL,
    consent_version TEXT NOT NULL,
    confirmed_at TEXT NOT NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
  );
`);

for (const column of [
  ['audio_mime_type', 'TEXT'],
  ['original_filename', 'TEXT'],
  ['audio_hash', 'TEXT'],
] as const) {
  const exists = db.prepare('SELECT 1 FROM pragma_table_info(\'meetings\') WHERE name = ?').get(column[0]);
  if (!exists) db.exec(`ALTER TABLE meetings ADD COLUMN ${column[0]} ${column[1]}`);
}

for (const column of [
  ['source_start', 'INTEGER'],
  ['source_end', 'INTEGER'],
] as const) {
  const exists = db.prepare('SELECT 1 FROM pragma_table_info(\'analyses\') WHERE name = ?').get(column[0]);
  if (!exists) db.exec(`ALTER TABLE analyses ADD COLUMN ${column[0]} ${column[1]}`);
}

for (const column of [
  ['source_start_seconds', 'REAL'],
  ['source_end_seconds', 'REAL'],
] as const) {
  const exists = db.prepare('SELECT 1 FROM pragma_table_info(\'transcripts\') WHERE name = ?').get(column[0]);
  if (!exists) db.exec(`ALTER TABLE transcripts ADD COLUMN ${column[0]} ${column[1]}`);
}

const mapMeeting = (row: Record<string, unknown>): Meeting => ({
  id: Number(row.id),
  title: String(row.title),
  managerName: String(row.manager_name),
  meetingDate: String(row.meeting_date),
  duration: row.duration_seconds === null ? null : Number(row.duration_seconds),
  audioPath: row.audio_path === null ? null : String(row.audio_path),
  audioMimeType: row.audio_mime_type === null ? null : String(row.audio_mime_type),
  originalFilename: row.original_filename === null ? null : String(row.original_filename),
  status: String(row.status) as MeetingStatus,
  createdAt: String(row.created_at),
});

export const listMeetings = (): Meeting[] => {
  const rows = db.prepare('SELECT * FROM meetings ORDER BY meeting_date DESC, id DESC').all() as Record<string, unknown>[];
  return rows.map(mapMeeting);
};

export const findMeeting = (id: number): Meeting | null => {
  const row = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapMeeting(row) : null;
};

export const createMeeting = (input: Pick<Meeting, 'title' | 'managerName' | 'meetingDate'>): Meeting => {
  const result = db.prepare(`
    INSERT INTO meetings (title, manager_name, meeting_date, status)
    VALUES (@title, @managerName, @meetingDate, 'recorded')
  `).run(input);
  return findMeeting(Number(result.lastInsertRowid)) as Meeting;
};

export const attachAudio = (input: {
  meetingId: number;
  audioPath: string;
  audioMimeType: string;
  originalFilename: string;
  audioHash: string;
  duration: number | null;
  consentType: string;
  consentVersion: string;
  confirmedAt: string;
}): Meeting | null => {
  const transaction = db.transaction(() => {
    const meeting = findMeeting(input.meetingId);
    if (!meeting) return null;
    db.prepare(`
      UPDATE meetings
      SET audio_path = @audioPath,
          audio_mime_type = @audioMimeType,
          original_filename = @originalFilename,
          audio_hash = @audioHash,
          duration_seconds = @duration,
          status = 'recorded'
      WHERE id = @meetingId
    `).run(input);
    db.prepare(`
      INSERT INTO consents (meeting_id, consent_type, consent_version, confirmed_at)
      VALUES (@meetingId, @consentType, @consentVersion, @confirmedAt)
    `).run(input);
    return findMeeting(input.meetingId);
  });
  return transaction() as Meeting | null;
};

export const deleteMeeting = (id: number): { deleted: boolean; audioPath: string | null } => {
  const meeting = findMeeting(id);
  if (!meeting) return { deleted: false, audioPath: null };
  db.prepare('DELETE FROM meetings WHERE id = ?').run(id);
  return { deleted: true, audioPath: meeting.audioPath };
};

const parseSegments = (value: unknown): TranscriptSegment[] => {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as TranscriptSegment[] : [];
  } catch {
    return [];
  }
};

const mapTranscript = (row: Record<string, unknown> | undefined, meetingId: number): TranscriptRecord => ({
  id: row ? Number(row.id) : null,
  meetingId,
  content: row ? String(row.content) : '',
  segments: row ? parseSegments(row.segments_json) : [],
  sourceStartSeconds: row?.source_start_seconds === null || row?.source_start_seconds === undefined ? null : Number(row.source_start_seconds),
  sourceEndSeconds: row?.source_end_seconds === null || row?.source_end_seconds === undefined ? null : Number(row.source_end_seconds),
  updatedAt: row ? String(row.updated_at) : null,
});

export const getTranscript = (meetingId: number): TranscriptRecord => {
  const row = db.prepare('SELECT * FROM transcripts WHERE meeting_id = ?').get(meetingId) as Record<string, unknown> | undefined;
  return mapTranscript(row, meetingId);
};

export const upsertTranscript = (meetingId: number, content: string, segments: TranscriptSegment[], sourceStartSeconds: number | null = null, sourceEndSeconds: number | null = null): TranscriptRecord => {
  db.prepare(`
    INSERT INTO transcripts (meeting_id, content, segments_json, source_start_seconds, source_end_seconds, updated_at)
    VALUES (@meetingId, @content, @segmentsJson, @sourceStartSeconds, @sourceEndSeconds, CURRENT_TIMESTAMP)
    ON CONFLICT(meeting_id) DO UPDATE SET
      content = excluded.content,
      segments_json = excluded.segments_json,
      source_start_seconds = excluded.source_start_seconds,
      source_end_seconds = excluded.source_end_seconds,
      updated_at = CURRENT_TIMESTAMP
  `).run({ meetingId, content, segmentsJson: JSON.stringify(segments), sourceStartSeconds, sourceEndSeconds });
  return getTranscript(meetingId);
};

export const setMeetingStatus = (meetingId: number, status: MeetingStatus): void => {
  db.prepare('UPDATE meetings SET status = ? WHERE id = ?').run(status, meetingId);
};

export const getAnalysis = (meetingId: number): AnalysisRecord | null => {
  const row = db.prepare('SELECT * FROM analyses WHERE meeting_id = ?').get(meetingId) as Record<string, unknown> | undefined;
  if (!row) return null;
  let result: unknown = {};
  try { result = JSON.parse(String(row.result_json)); } catch { result = {}; }
  return { id: Number(row.id), meetingId, score: row.score === null ? null : Number(row.score), coverage: row.coverage === null ? null : Number(row.coverage), result, sourceStartSeconds: row.source_start === null ? null : Number(row.source_start), sourceEndSeconds: row.source_end === null ? null : Number(row.source_end), createdAt: String(row.created_at) };
};

export const saveAnalysis = (meetingId: number, score: number | null, coverage: number, result: unknown, sourceStartSeconds: number | null = null, sourceEndSeconds: number | null = null): AnalysisRecord => {
  db.prepare(`
    INSERT INTO analyses (meeting_id, score, coverage, result_json, source_start, source_end, created_at)
    VALUES (@meetingId, @score, @coverage, @resultJson, @sourceStartSeconds, @sourceEndSeconds, CURRENT_TIMESTAMP)
    ON CONFLICT(meeting_id) DO UPDATE SET
      score = excluded.score,
      coverage = excluded.coverage,
      result_json = excluded.result_json,
      source_start = excluded.source_start,
      source_end = excluded.source_end,
      created_at = CURRENT_TIMESTAMP
  `).run({ meetingId, score, coverage, resultJson: JSON.stringify(result), sourceStartSeconds, sourceEndSeconds });
  return getAnalysis(meetingId) as AnalysisRecord;
};

export const clearAnalysis = (meetingId: number): void => {
  db.prepare('DELETE FROM analyses WHERE meeting_id = ?').run(meetingId);
};

export const getDashboardStats = (): DashboardStats => {
  const row = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM meetings) AS total_meetings,
      (SELECT COUNT(*) FROM analyses WHERE score IS NOT NULL) AS analyzed_meetings,
      (SELECT AVG(score) FROM analyses WHERE score IS NOT NULL) AS average_score
  `).get() as Record<string, unknown>;

  return {
    totalMeetings: Number(row.total_meetings),
    analyzedMeetings: Number(row.analyzed_meetings),
    averageScore: row.average_score === null ? null : Number(row.average_score),
  };
};
