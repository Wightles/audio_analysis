import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BarChart3, CalendarDays, Check, ChevronRight, ClipboardList, FileAudio, Home, LogOut, Mic, Pause, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { api, type DashboardStats, type Meeting } from './api';

const MAX_AUDIO_SIZE_MB = 250;
const allowedExtensions = ['.mp3', '.wav', '.webm', '.m4a'];

const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const formatDuration = (seconds: number | null) => {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds} сек`;
  return `${Math.floor(seconds / 60)} мин ${seconds % 60} сек`;
};

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try { await api.login(password); onLogin(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось войти'); } finally { setLoading(false); }
  };
  return <main className="login-shell"><section className="login-card"><div className="brand-mark">RB</div><p className="eyebrow">Royal Brick</p><h1>AI Auditor</h1><p className="login-copy">Контроль качества переговоров менеджеров на основе фактов и расшифровок встреч.</p><form onSubmit={submit}><label htmlFor="password">Демонстрационный пароль</label><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Введите пароль" autoFocus /><button className="button button-primary button-wide" disabled={loading}>{loading ? 'Проверяем…' : 'Войти в систему'}</button>{error && <p className="form-error">{error}</p>}</form><p className="login-note"><ShieldCheck size={16} /> Доступ защищён серверной сессией</p></section></main>;
}

function Layout({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const location = useLocation();
  const pageName = location.pathname === '/meetings' ? 'История встреч' : location.pathname === '/meetings/new' ? 'Новая запись' : location.pathname.startsWith('/meetings/') ? 'Встреча' : 'Главная';
  return <div className="app-shell"><aside className="sidebar"><Link className="brand" to="/"><span className="brand-mark small">RB</span><span><strong>Royal Brick</strong><small>AI Auditor</small></span></Link><nav><NavLink className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} to="/"><Home size={18} />Главная</NavLink><NavLink className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} to="/meetings"><CalendarDays size={18} />История встреч</NavLink><NavLink className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} to="/meetings/new"><Plus size={18} />Новая запись</NavLink></nav><div className="sidebar-footer"><div className="user-chip"><span className="avatar">ДМ</span><span><b>Демонстрационный</b><small>Аудитор</small></span></div><button className="logout-button" onClick={onLogout}><LogOut size={16} />Выйти</button></div></aside><div className="main-column"><header className="topbar"><div><span className="breadcrumb">Royal Brick / </span><span>{pageName}</span></div><div className="status-dot"><span />Система готова к работе</div></header><main className="content">{children}</main></div></div>;
}

function EmptyMeetings({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? 'empty-state compact' : 'empty-state'}><div className="empty-icon"><FileAudio size={24} /></div><h3>{compact ? 'Встреч пока нет' : 'История встреч пока пуста'}</h3><p>{compact ? 'Сохранённые записи появятся здесь.' : 'Создайте первую запись — она появится здесь после сохранения.'}</p>{!compact && <Link className="button button-primary" to="/meetings/new"><Plus size={17} />Создать запись</Link>}</div>;
}

function MeetingRow({ meeting, onDelete }: { meeting: Meeting; onDelete?: (id: number) => void }) {
  return <div className="meeting-row"><div className="meeting-title-cell"><div className="file-icon"><FileAudio size={18} /></div><div><Link to={`/meetings/${meeting.id}`} className="meeting-link">{meeting.title}</Link><span>{meeting.audioPath ? 'Аудиозапись сохранена' : 'Аудио ещё не добавлено'}</span></div></div><div>{meeting.managerName}</div><div>{formatDate(meeting.meetingDate)}</div><div>{formatDuration(meeting.duration)}</div><div><span className="status-badge neutral">{meeting.status === 'analyzed' ? 'Проанализирована' : 'Ожидает анализа'}</span></div><div className="row-actions"><Link to={`/meetings/${meeting.id}`} className="icon-button" title="Открыть"><ChevronRight size={18} /></Link>{onDelete && <button className="icon-button danger" title="Удалить" onClick={() => onDelete(meeting.id)}><Trash2 size={17} /></button>}</div></div>;
}

function Dashboard({ stats, meetings }: { stats: DashboardStats; meetings: Meeting[] }) {
  return <><div className="page-heading"><div><p className="eyebrow">Рабочий стол</p><h1>Главная</h1><p className="muted">Краткий обзор записей и качества переговоров.</p></div><Link className="button button-primary" to="/meetings/new"><Plus size={18} />Новая запись</Link></div><section className="stats-grid"><div className="stat-card"><span className="stat-label">Всего встреч</span><strong>{stats.totalMeetings}</strong><span className="stat-hint">Сохранённые записи</span></div><div className="stat-card"><span className="stat-label">Проанализировано</span><strong>{stats.analyzedMeetings}</strong><span className="stat-hint">Только реальные отчёты</span></div><div className="stat-card"><span className="stat-label">Средняя оценка</span><strong>{stats.averageScore === null ? '—' : `${Math.round(stats.averageScore)}/100`}</strong><span className="stat-hint">При наличии сопоставимых оценок</span></div></section><section className="section-block"><div className="section-header"><div><p className="eyebrow">Последние записи</p><h2>Последние встречи</h2></div>{meetings.length > 0 && <Link className="text-link" to="/meetings">Вся история <ChevronRight size={16} /></Link>}</div>{meetings.length === 0 ? <EmptyMeetings compact /> : <div className="meeting-list">{meetings.slice(0, 5).map((meeting) => <MeetingRow meeting={meeting} key={meeting.id} />)}</div>}</section></>;
}

function MeetingsPage({ meetings, refresh }: { meetings: Meeting[]; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const remove = async (id: number) => {
    if (!window.confirm('Удалить эту встречу и связанную аудиозапись?')) return;
    setBusy(true); try { await api.deleteMeeting(id); await refresh(); } finally { setBusy(false); }
  };
  return <><div className="page-heading"><div><p className="eyebrow">Контроль переговоров</p><h1>История встреч</h1><p className="muted">Все сохранённые записи и доступные результаты анализа.</p></div><Link className="button button-primary" to="/meetings/new"><Plus size={18} />Новая запись</Link></div><section className="table-card">{meetings.length === 0 ? <EmptyMeetings /> : <><div className="table-head"><span>Встреча</span><span>Менеджер</span><span>Дата</span><span>Длительность</span><span>Статус</span><span></span></div><div className={busy ? 'meeting-list is-busy' : 'meeting-list'}>{meetings.map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} onDelete={remove} />)}</div></>}</section></>;
}

function ConsentModal({ open, purpose, onCancel, onConfirm }: { open: boolean; purpose: 'recording' | 'audio_upload'; onCancel: () => void; onConfirm: () => void }) {
  const [checked, setChecked] = useState(false);
  useEffect(() => { if (open) setChecked(false); }, [open]);
  if (!open) return null;
  return <div className="modal-backdrop"><section className="consent-modal" role="dialog" aria-modal="true" aria-labelledby="consent-title"><div className="modal-icon"><ShieldCheck size={22} /></div><p className="eyebrow">{purpose === 'recording' ? 'Перед началом записи' : 'Перед сохранением аудио'}</p><h2 id="consent-title">Согласие участников</h2><p>Для записи и анализа разговора приложение использует микрофон устройства. Аудиозапись и расшифровка сохраняются на сервере. После подключения ИИ-сервиса они могут передаваться внешнему провайдеру для автоматизированной обработки.</p><p>Подтвердите, что все участники разговора проинформированы об этом и дали необходимое согласие.</p><label className="checkbox-row"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} /><span>Я подтверждаю информирование участников и наличие необходимого согласия.</span></label><p className="legal-note">Наличие чекбокса само по себе не гарантирует соблюдение законодательства о персональных данных.</p><div className="modal-actions"><button className="button button-secondary" onClick={onCancel}>Отмена</button><button className="button button-primary" disabled={!checked} onClick={onConfirm}><Check size={16} />Подтвердить</button></div></section></div>;
}

function NewMeetingPage({ onCreated }: { onCreated: () => Promise<void> }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'record' | 'upload'>('record');
  const [title, setTitle] = useState(''); const [managerName, setManagerName] = useState(''); const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null); const [audioFilename, setAudioFilename] = useState('recording.webm'); const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false); const [elapsed, setElapsed] = useState(0); const [consentOpen, setConsentOpen] = useState(false); const [consentPurpose, setConsentPurpose] = useState<'recording' | 'audio_upload'>('recording'); const [consentAcceptedAt, setConsentAcceptedAt] = useState<string | null>(null); const [pendingConsentAction, setPendingConsentAction] = useState<'start' | 'save' | null>(null); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null); const streamRef = useRef<MediaStream | null>(null); const chunksRef = useRef<Blob[]>([]); const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); streamRef.current?.getTracks().forEach((track) => track.stop()); if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const resetAudio = () => { if (isRecording) recorderRef.current?.stop(); streamRef.current?.getTracks().forEach((track) => track.stop()); if (previewUrl) URL.revokeObjectURL(previewUrl); setAudioBlob(null); setPreviewUrl(null); setElapsed(0); setConsentAcceptedAt(null); setError(''); };
  const switchMode = (nextMode: 'record' | 'upload') => { if (!isRecording) { resetAudio(); setMode(nextMode); } };
  const getSupportedMimeType = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
  const startRecording = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Этот браузер не поддерживает запись с микрофона. Используйте актуальную версию Chrome, Edge или Safari.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream; chunksRef.current = []; const mimeType = getSupportedMimeType(); const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream); recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); }; recorder.onerror = () => setError('Во время записи произошла ошибка. Попробуйте ещё раз.');
      recorder.onstop = () => { const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' }); const extension = blob.type.includes('mp4') ? 'm4a' : 'webm'; setAudioBlob(blob); setAudioFilename(`recording.${extension}`); setPreviewUrl(URL.createObjectURL(blob)); setIsRecording(false); stream.getTracks().forEach((track) => track.stop()); streamRef.current = null; recorderRef.current = null; };
      recorder.start(1000); setElapsed(0); setIsRecording(true); timerRef.current = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    } catch (cause) { const message = cause instanceof DOMException && cause.name === 'NotAllowedError' ? 'Доступ к микрофону отклонён. Разрешите его в настройках браузера и попробуйте ещё раз.' : cause instanceof DOMException && cause.name === 'NotFoundError' ? 'Микрофон не найден. Подключите устройство и попробуйте ещё раз.' : 'Не удалось начать запись с микрофона.'; setError(message); }
  };
  const stopRecording = () => { if (timerRef.current) window.clearInterval(timerRef.current); timerRef.current = null; if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); };
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`; if (!allowedExtensions.includes(extension)) { setError('Поддерживаются только MP3, WAV, WebM и M4A.'); return; } if (file.size > MAX_AUDIO_SIZE_MB * 1024 * 1024) { setError(`Размер файла не должен превышать ${MAX_AUDIO_SIZE_MB} МБ.`); return; } if (previewUrl) URL.revokeObjectURL(previewUrl); setAudioBlob(file); setAudioFilename(file.name); setPreviewUrl(URL.createObjectURL(file)); setError(''); setConsentAcceptedAt(null); };
  const saveMeeting = async (confirmedAtOverride?: string) => {
    setError(''); if (!title.trim() || !managerName.trim() || !meetingDate || !audioBlob) { setError('Заполните данные встречи и добавьте аудиозапись.'); return; } const confirmedAt = confirmedAtOverride ?? consentAcceptedAt; if (!confirmedAt) { setConsentPurpose('audio_upload'); setPendingConsentAction('save'); setConsentOpen(true); return; }
    setSaving(true); let meeting: Meeting | null = null;
    try { meeting = await api.createMeeting({ title: title.trim(), managerName: managerName.trim(), meetingDate: new Date(meetingDate).toISOString() }); await api.uploadAudio(meeting.id, audioBlob, audioFilename, mode === 'record' ? elapsed : null, mode === 'record' ? 'recording' : 'audio_upload', confirmedAt); await onCreated(); navigate(`/meetings/${meeting.id}`); } catch (cause) { if (meeting) await api.deleteMeeting(meeting.id).catch(() => undefined); setError(cause instanceof Error ? cause.message : 'Не удалось сохранить встречу.'); } finally { setSaving(false); }
  };
  const confirmConsent = () => { const confirmedAt = new Date().toISOString(); setConsentAcceptedAt(confirmedAt); setConsentOpen(false); if (pendingConsentAction === 'start') void startRecording(); if (pendingConsentAction === 'save') void saveMeeting(confirmedAt); setPendingConsentAction(null); };
  const requestRecording = () => { setConsentPurpose('recording'); setPendingConsentAction('start'); setConsentOpen(true); };
  const hasAudio = Boolean(audioBlob && previewUrl);

  return <><div className="page-heading"><div><p className="eyebrow">Новая запись</p><h1>Создать встречу</h1><p className="muted">Запишите разговор через микрофон или загрузите готовый аудиофайл.</p></div></div><section className="form-card recording-card"><div className="form-card-header"><div className="empty-icon light"><FileAudio size={22} /></div><div><h2>Данные встречи</h2><p>Аудиофайлы хранятся на сервере вне публичной папки сайта.</p></div></div><div className="form-grid"><label>Название встречи<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, Консультация по фасаду" /></label><label>Менеджер<input value={managerName} onChange={(event) => setManagerName(event.target.value)} placeholder="Имя менеджера" /></label><label>Дата и время встречи<input type="datetime-local" value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} /></label></div><div className="mode-tabs"><button className={mode === 'record' ? 'mode-tab active' : 'mode-tab'} onClick={() => switchMode('record')}><Mic size={16} />Записать с микрофона</button><button className={mode === 'upload' ? 'mode-tab active' : 'mode-tab'} onClick={() => switchMode('upload')}><Upload size={16} />Загрузить файл</button></div>{mode === 'record' ? <div className="recorder-panel"><div className={isRecording ? 'recording-indicator live' : 'recording-indicator'}><span />{isRecording ? 'Идёт запись' : hasAudio ? 'Запись готова к сохранению' : 'Микрофон не используется'}</div><div className="timer">{formatDuration(elapsed)}</div><p className="recorder-help">Запись не ограничена искусственным таймером. Перед началом потребуется подтверждение информирования участников.</p><div className="recorder-actions">{!isRecording ? <button className="button button-primary" onClick={hasAudio ? resetAudio : requestRecording}>{hasAudio ? 'Записать заново' : 'Начать запись'}</button> : <button className="button button-danger" onClick={stopRecording}><Pause size={16} />Остановить</button>}</div></div> : <label className="upload-zone"><Upload size={25} /><strong>{audioBlob ? audioFilename : 'Выберите аудиофайл'}</strong><span>MP3, WAV, WebM или M4A · до {MAX_AUDIO_SIZE_MB} МБ</span><input type="file" accept=".mp3,.wav,.webm,.m4a,audio/*" onChange={chooseFile} /></label>}{hasAudio && <div className="audio-preview"><div><p className="eyebrow">Предпрослушивание</p><strong>{audioFilename}</strong></div><audio controls src={previewUrl ?? undefined} /></div>}<div className="notice"><ClipboardList size={18} /><span>Факт согласия, версия формы и время подтверждения будут сохранены вместе с записью. Перед отправкой аудио внешнему ИИ-провайдеру потребуется отдельное подтверждение на соответствующем этапе.</span></div>{error && <p className="form-error">{error}</p>}<button className="button button-primary" disabled={!hasAudio || saving || isRecording} onClick={() => void saveMeeting()}>{saving ? 'Сохраняем…' : 'Сохранить встречу'}</button></section><ConsentModal open={consentOpen} purpose={consentPurpose} onCancel={() => { setConsentOpen(false); setPendingConsentAction(null); }} onConfirm={confirmConsent} /></>;
}

function MeetingDetailsPage() {
  const { id } = useParams();
  const meetingId = Number(id);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [transcriptError, setTranscriptError] = useState('');
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [transcriptSaved, setTranscriptSaved] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.meeting(meetingId), api.transcript(meetingId)]).then(([nextMeeting, nextTranscript]) => {
      setMeeting(nextMeeting);
      setTranscript(nextTranscript.content);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Не удалось загрузить встречу'));
  }, [id, meetingId]);

  const saveTranscript = async () => {
    setSavingTranscript(true); setTranscriptError(''); setTranscriptSaved(false);
    try { const result = await api.saveTranscript(meetingId, transcript); setTranscript(result.content); setTranscriptSaved(true); } catch (cause) { setTranscriptError(cause instanceof Error ? cause.message : 'Не удалось сохранить расшифровку'); } finally { setSavingTranscript(false); }
  };
  const requestTranscription = async () => {
    setTranscribing(true); setTranscriptError('');
    try { const result = await api.transcribe(meetingId); setTranscript(result.transcript.content); } catch (cause) { setTranscriptError(cause instanceof Error ? cause.message : 'ИИ-провайдер пока не подключён'); } finally { setTranscribing(false); }
  };

  if (error) return <div className="empty-page"><div className="empty-icon"><BarChart3 size={24} /></div><h1>Не удалось открыть встречу</h1><p>{error}</p><Link className="button button-secondary" to="/meetings">Вернуться к истории</Link></div>;
  if (!meeting) return <div className="loading-screen">Загрузка встречи…</div>;
  return <><div className="page-heading"><div><p className="eyebrow">Карточка встречи</p><h1>{meeting.title}</h1><p className="muted">{meeting.managerName} · {formatDate(meeting.meetingDate)}</p></div><Link className="button button-secondary" to="/meetings">К истории</Link></div><section className="details-grid"><div className="form-card detail-card"><div className="section-header"><div><p className="eyebrow">Аудиозапись</p><h2>{meeting.originalFilename ?? 'Файл не добавлен'}</h2></div><span className="status-badge neutral">{meeting.status === 'analyzed' ? 'Проанализирована' : 'Ожидает анализа'}</span></div>{meeting.audioPath ? <audio className="saved-audio" controls preload="metadata" src={api.audioUrl(meeting.id)} /> : <div className="notice"><FileAudio size={18} /><span>Аудиозапись ещё не добавлена.</span></div>}<div className="detail-meta"><div><span>Менеджер</span><strong>{meeting.managerName}</strong></div><div><span>Дата</span><strong>{formatDate(meeting.meetingDate)}</strong></div><div><span>Длительность</span><strong>{formatDuration(meeting.duration)}</strong></div></div></div><div className="form-card detail-card muted-report"><div className="empty-icon light"><BarChart3 size={22} /></div><p className="eyebrow">Анализ встречи</p><h2>ИИ-провайдер пока не подключён</h2><p>После подключения транскрибации и анализа здесь появятся расшифровка, оценка по девяти этапам и полный отчёт Royal Brick. Случайные оценки не отображаются.</p></div></section><section className="form-card transcript-card"><div className="section-header"><div><p className="eyebrow">Расшифровка</p><h2>Текст встречи</h2><p className="muted">Текст можно исправить вручную. Цитаты для будущего анализа должны оставаться подтверждаемыми по записи.</p></div><button className="button button-secondary" onClick={() => void requestTranscription()} disabled={transcribing || !meeting.audioPath}>{transcribing ? 'Запрашиваем…' : 'Запустить расшифровку'}</button></div><textarea className="transcript-editor" value={transcript} onChange={(event) => { setTranscript(event.target.value); setTranscriptSaved(false); }} placeholder="Расшифровка пока отсутствует. Добавьте текст вручную или подключите ИИ-провайдер." />{transcriptError && <p className="form-error">{transcriptError}</p>}<div className="transcript-actions"><button className="button button-primary" onClick={() => void saveTranscript()} disabled={savingTranscript}>{savingTranscript ? 'Сохраняем…' : 'Сохранить расшифровку'}</button>{transcriptSaved && <span className="success-text"><Check size={15} />Сохранено</span>}</div></section></>;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null); const [stats, setStats] = useState<DashboardStats>({ totalMeetings: 0, analyzedMeetings: 0, averageScore: null }); const [meetings, setMeetings] = useState<Meeting[]>([]); const navigate = useNavigate();
  const refresh = async () => { const [nextStats, nextMeetings] = await Promise.all([api.stats(), api.meetings()]); setStats(nextStats); setMeetings(nextMeetings); };
  useEffect(() => { api.session().then((result) => { setAuthenticated(result.authenticated); if (result.authenticated) refresh().catch(() => undefined); }).catch(() => setAuthenticated(false)); }, []);
  if (authenticated === null) return <div className="loading-screen">Загрузка…</div>; if (!authenticated) return <LoginPage onLogin={() => { setAuthenticated(true); navigate('/'); refresh().catch(() => undefined); }} />;
  return <Layout onLogout={async () => { await api.logout(); setAuthenticated(false); navigate('/'); }}><Routes><Route path="/" element={<Dashboard stats={stats} meetings={meetings} />} /><Route path="/meetings" element={<MeetingsPage meetings={meetings} refresh={refresh} />} /><Route path="/meetings/new" element={<NewMeetingPage onCreated={refresh} />} /><Route path="/meetings/:id" element={<MeetingDetailsPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></Layout>;
}
