import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { DashboardStats, Meeting, MeetingStatus } from './types.js';

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
    status TEXT NOT NULL DEFAULT 'recorded',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL UNIQUE,
    content TEXT NOT NULL DEFAULT '',
    segments_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL UNIQUE,
    score REAL,
    coverage REAL,
    result_json TEXT NOT NULL,
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

const mapMeeting = (row: Record<string, unknown>): Meeting => ({
  id: Number(row.id),
  title: String(row.title),
  managerName: String(row.manager_name),
  meetingDate: String(row.meeting_date),
  duration: row.duration_seconds === null ? null : Number(row.duration_seconds),
  audioPath: row.audio_path === null ? null : String(row.audio_path),
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

export const deleteMeeting = (id: number): boolean => db.prepare('DELETE FROM meetings WHERE id = ?').run(id).changes > 0;

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
