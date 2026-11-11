import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Database from 'better-sqlite3';

const allowedExtensions = new Set(['.mp3', '.wav', '.webm', '.m4a']);
const mimeByExtension = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webm': 'audio/webm', '.m4a': 'audio/mp4' };
const args = process.argv.slice(2);
const valueFor = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const inputPath = valueFor('--file');
const managerName = valueFor('--manager');
const title = valueFor('--title');
const meetingDate = valueFor('--date');
const consentVersion = valueFor('--consent-version');

if (!inputPath || !managerName || !title || !meetingDate) {
  console.error('Использование: node server/scripts/import-audio.mjs --file server/import/meeting.mp3 --manager "Имя" --title "Название" --date 2026-11-12T10:00:00+07:00 [--consent-version 1.0]');
  process.exit(1);
}

const sourcePath = path.resolve(inputPath);
const extension = path.extname(sourcePath).toLowerCase();
if (!allowedExtensions.has(extension)) throw new Error('Поддерживаются только MP3, WAV, WebM и M4A.');
if (!fs.existsSync(sourcePath)) throw new Error(`Файл не найден: ${sourcePath}`);
if (Number.isNaN(Date.parse(meetingDate))) throw new Error('Дата должна быть в ISO-формате, например 2026-11-12T10:00:00+07:00');

const storageDirectory = path.resolve(process.env.STORAGE_DIR ?? 'server/storage');
const dataDirectory = path.resolve(process.env.DATA_DIR ?? 'server/data');
const audioDirectory = path.join(storageDirectory, 'audio');
fs.mkdirSync(dataDirectory, { recursive: true });
fs.mkdirSync(audioDirectory, { recursive: true });

const db = new Database(path.join(dataDirectory, 'royal-brick.db'));
db.pragma('foreign_keys = ON');
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
  CREATE TABLE IF NOT EXISTS consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    consent_type TEXT NOT NULL,
    consent_version TEXT NOT NULL,
    confirmed_at TEXT NOT NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
  );
`);
for (const [column, type] of [['audio_mime_type', 'TEXT'], ['original_filename', 'TEXT'], ['audio_hash', 'TEXT']]) {
  const exists = db.prepare('SELECT 1 FROM pragma_table_info(\'meetings\') WHERE name = ?').get(column);
  if (!exists) db.exec(`ALTER TABLE meetings ADD COLUMN ${column} ${type}`);
}

const bytes = fs.readFileSync(sourcePath);
const audioHash = crypto.createHash('sha256').update(bytes).digest('hex');
const duplicate = db.prepare('SELECT id, title FROM meetings WHERE audio_hash = ?').get(audioHash);
if (duplicate) {
  console.log(`Дубликат: файл уже импортирован во встречу №${duplicate.id} (${duplicate.title}).`);
  process.exit(0);
}

const storedFilename = `${crypto.randomUUID()}${extension}`;
const relativeAudioPath = path.join('audio', storedFilename);
const destinationPath = path.join(storageDirectory, relativeAudioPath);
fs.copyFileSync(sourcePath, destinationPath);
try {
  const insertMeeting = db.prepare(`INSERT INTO meetings (title, manager_name, meeting_date, audio_path, audio_mime_type, original_filename, audio_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'recorded')`);
  const result = insertMeeting.run(title.trim(), managerName.trim(), new Date(meetingDate).toISOString(), relativeAudioPath, mimeByExtension[extension], path.basename(sourcePath), audioHash);
  if (consentVersion) db.prepare(`INSERT INTO consents (meeting_id, consent_type, consent_version, confirmed_at) VALUES (?, 'audio_import', ?, ?)` ).run(result.lastInsertRowid, consentVersion, new Date().toISOString());
  console.log(`Импортировано: встреча №${result.lastInsertRowid}, файл ${path.basename(sourcePath)}.`);
} catch (error) {
  fs.rmSync(destinationPath, { force: true });
  throw error;
} finally {
  db.close();
}
