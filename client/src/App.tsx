import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BarChart3, CalendarDays, Check, ChevronRight, ClipboardList, FileAudio, Home, LogOut, Mic, Pause, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { api, type AICapacity, type AnalysisRecord, type DashboardStats, type Meeting } from './api';
import type { EvidenceItem, RoyalBrickReport } from './report';

const MAX_AUDIO_SIZE_MB = 250;
const allowedExtensions = ['.mp3', '.wav', '.webm', '.m4a'];

const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const formatDuration = (seconds: number | null) => {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds} сек`;
  return `${Math.floor(seconds / 60)} мин ${seconds % 60} сек`;
};
const formatTimecode = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`;

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

function ReportSection({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return <section className="report-section"><div className="report-section-heading"><span>{String(number).padStart(2, '0')}</span><h2>{title}</h2></div><div className="report-section-body">{children}</div></section>;
}

function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0) return <p className="report-muted">Подтверждённых фрагментов нет.</p>;
  return <div className="evidence-list">{items.map((item, index) => <div className="evidence-item" key={`${item.text}-${index}`}><span className={`evidence-kind ${item.kind}`}>{item.kind === 'fact' ? 'Факт' : item.kind === 'hypothesis' ? 'Гипотеза' : 'Ограничение'}</span><p>{item.text}</p>{item.quote && <blockquote>«{item.quote}»{item.timestamp && <small>{item.timestamp}</small>}</blockquote>}</div>)}</div>;
}

function statusLabel(value: string): string {
  return ({ done: 'Выполнено', not_done: 'Не выполнено', not_applicable: 'Неприменимо', no_data: 'Нет данных', followed: 'Соблюдена', partially_followed: 'Частично соблюдена', broken: 'Нарушена' } as Record<string, string>)[value] ?? value;
}

const levelLabel = (value: string) => ({ excellent: 'Отличный уровень', good: 'Хороший уровень', satisfactory: 'Удовлетворительный уровень', weak: 'Слабый уровень', unsatisfactory: 'Неудовлетворительный уровень', not_available: 'Оценка недоступна' } as Record<string, string>)[value] ?? value;
const priorityLabel = (value: string) => ({ high: 'Высокий', medium: 'Средний', low: 'Низкий' } as Record<string, string>)[value] ?? value;
const typeLabel = (value: string) => ({ rational: 'Рациональный', emotional: 'Эмоциональный', mixed: 'Смешанный', undetermined: 'Не определён' } as Record<string, string>)[value] ?? value;
const decisionLabel = (value: string) => ({ research: 'Исследование', comparison: 'Сравнение', selection: 'Выбор', near_purchase: 'Близок к покупке', ready_to_order: 'Готов к оформлению', undetermined: 'Не определена' } as Record<string, string>)[value] ?? value;
const likelihoodLabel = (value: string) => ({ high: 'Высокая', medium: 'Средняя', low: 'Низкая', insufficient_data: 'Недостаточно данных' } as Record<string, string>)[value] ?? value;
const confidenceLabel = (value: string) => ({ high: 'Высокая', medium: 'Средняя', low: 'Низкая' } as Record<string, string>)[value] ?? value;
const formatLabel = (value: string) => ({ initial: 'Первичная', repeat: 'Повторная', undetermined: 'Не определён' } as Record<string, string>)[value] ?? value;

function ReportView({ analysis }: { analysis: AnalysisRecord }) {
  const report: RoyalBrickReport = analysis.result;
  const [copied, setCopied] = useState(false);
  const copySummary = async () => { await navigator.clipboard.writeText(report.crmSummary); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  const card = report.meetingCard;
  const overall = report.overallAssessment;
  return <div className="report-view"><ReportSection number={1} title="Карточка встречи"><div className="report-facts-grid">{[['Дата встречи', card.meetingDate], ['Менеджер', card.manager], ['Идентификатор', card.meetingId], ['Формат', formatLabel(card.format)], ['Клиент', card.client], ['Объект', card.objectDescription], ['Продукция', card.selectedProduct], ['Количество панелей', card.panelCount], ['Полная стоимость', card.listPrice], ['Рассрочка', card.installment], ['Ежемесячный платёж', card.monthlyPayment], ['Скидка', card.saleDiscount], ['Цена со скидкой', card.salePrice], ['Предоплата', card.prepayment], ['Результат', card.meetingResult], ['Следующий контакт', card.nextContact]].map(([label, value]) => <div className="report-fact" key={label}><span>{label}</span><strong>{value === null || value === undefined || value === '' ? 'Не выяснено' : String(value)}</strong></div>)}</div></ReportSection><ReportSection number={2} title="Общая оценка менеджера"><div className="score-overview"><div className="score-number">{overall.score === null ? '—' : Math.round(overall.score)}<small>/100</small></div><div><span className="score-level">{levelLabel(overall.level)}</span><p>{overall.summary}</p></div><div className="coverage-box"><span>Охват оценки</span><strong>{Math.round(overall.coverage)}%</strong><small>{overall.evaluatedMaxScore}/100 баллов доступны для оценки</small></div></div><div className="criteria-table"><div className="criteria-row criteria-head"><span>Критерий</span><span>Баллы</span><span>Комментарий</span></div>{overall.criteria.map((criterion) => <div className="criteria-row" key={criterion.id}><div><strong>{criterion.title}</strong>{criterion.mainGap && <small>{criterion.mainGap}</small>}</div><span className="criterion-score">{criterion.state === 'scored' ? `${criterion.score}/${criterion.maxScore}` : criterion.state === 'no_data' ? 'Нет данных' : 'Н/П'}</span><p>{criterion.comment}</p></div>)}</div><div className="price-sequence"><div className="subsection-title">Проверка последовательности презентации цены</div><div className="check-grid">{[['Количество панелей', overall.priceSequence.panelCount], ['Полная цена', overall.priceSequence.listPrice], ['Рассрочка и платёж', overall.priceSequence.installment], ['Распродажа и скидка', overall.priceSequence.salePrice], ['Предложение оформления', overall.priceSequence.immediateClosing]].map(([label, value]) => <div className="check-item" key={label}><span>{label}</span><strong>{statusLabel(String(value))}</strong></div>)}</div><p className="sequence-result">Последовательность: <b>{statusLabel(overall.priceSequence.sequence)}</b>{overall.priceSequence.mainIssue && ` — ${overall.priceSequence.mainIssue}`}</p></div></ReportSection><ReportSection number={3} title="Что менеджер сделал хорошо"><EvidenceList items={report.managerStrengths} /></ReportSection><ReportSection number={4} title="Главные ошибки менеджера">{report.managerErrors.length === 0 ? <p className="report-muted">Подтверждённых существенных ошибок не выявлено.</p> : <div className="error-list">{report.managerErrors.map((item, index) => <article className="error-card" key={`${item.error}-${index}`}><div className="error-card-top"><h3>{item.error}</h3><span className={`priority ${item.priority}`}>{priorityLabel(item.priority)}</span></div><p><b>Почему важно:</b> {item.whyItMatters}</p><p><b>Как исправить:</b> {item.correction}</p><blockquote>«{item.examplePhrase}»</blockquote><EvidenceList items={item.evidence} /></article>)}</div>}</ReportSection><ReportSection number={5} title="Анализ клиента"><div className="client-profile"><div className="profile-highlight"><span>Основной тип</span><strong>{typeLabel(report.clientAnalysis.primaryType)}</strong><span>Стадия решения: {decisionLabel(report.clientAnalysis.decisionStage)}</span><span>Вероятность покупки: {likelihoodLabel(report.clientAnalysis.purchaseLikelihood)}</span></div><div className="profile-copy"><p><b>Что хочет получить:</b> {report.clientAnalysis.desiredOutcome}</p><p><b>Обоснование:</b> {report.clientAnalysis.rationale}</p><p><b>Явные опасения:</b> {report.clientAnalysis.explicitConcerns.join('; ') || 'Не выявлены'}</p><p><b>Вероятные опасения:</b> {report.clientAnalysis.probableConcerns.join('; ') || 'Не выявлены'}</p></div></div><div className="report-columns"><div><h3>Критерии выбора</h3>{report.clientAnalysis.keyCriteria.map((item, index) => <div className="mini-card" key={`${item.criterion}-${index}`}><b>{item.criterion}</b><span>Приоритет: {priorityLabel(item.priority)}</span><p>{item.salesUse}</p><EvidenceList items={item.evidence} /></div>)}</div><div><h3>Поведенческие особенности</h3>{report.clientAnalysis.additionalFeatures.map((item, index) => <div className="mini-card" key={`${item.feature}-${index}`}><b>{item.feature}</b><span>Уверенность: {confidenceLabel(item.confidence)}</span><p>{item.basis}</p><small>{item.guidance}</small></div>)}</div></div></ReportSection><ReportSection number={6} title="Разбор возражений">{report.objections.length === 0 ? <p className="report-muted">Возражения в доступной записи не выявлены.</p> : <div className="objection-list">{report.objections.map((item, index) => <article className="objection-card" key={`${item.clientQuote}-${index}`}><blockquote>«{item.clientQuote}»</blockquote><p><b>Возможная причина:</b> {item.probableReason}</p><p><b>Ответ менеджера:</b> {item.managerResponse}</p><p><b>Оценка:</b> {item.responseAssessment}</p><p><b>Более эффективная формулировка:</b> {item.betterFormulation}</p><span className="status-badge neutral">{item.remainsOpen === null ? 'Не удалось установить' : item.remainsOpen ? 'Осталось открытым' : 'Закрыто'}</span></article>)}</div>}</ReportSection><ReportSection number={7} title="Упущенная возможность продажи"><div className="opportunity-card"><p><b>Реплика клиента:</b> {report.missedSalesOpportunity.clientQuote ? `«${report.missedSalesOpportunity.clientQuote}»` : 'Не установлена'}</p><p><b>Реакция менеджера:</b> {report.missedSalesOpportunity.managerReaction ?? 'Не установлена'}</p><p><b>Почему момент важен:</b> {report.missedSalesOpportunity.whyImportant}</p><p><b>Более эффективный ответ:</b> {report.missedSalesOpportunity.betterResponse}</p><p><b>Возможное влияние:</b> {report.missedSalesOpportunity.expectedInfluence}</p></div></ReportSection><ReportSection number={8} title="Рекомендации по данному клиенту"><div className="recommendation-grid"><div><span>Следующее действие</span><strong>{report.clientRecommendations.nextAction}</strong></div><div><span>Когда связаться</span><strong>{report.clientRecommendations.timing}</strong></div><div><span>С какого вопроса начать</span><strong>{report.clientRecommendations.openingQuestion}</strong></div><div><span>Следующий шаг</span><strong>{report.clientRecommendations.proposedStep}</strong></div></div><div className="report-columns"><div><h3>Аргументы</h3><ul>{report.clientRecommendations.arguments.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>Материалы</h3><ul>{report.clientRecommendations.materials.map((item) => <li key={item}>{item}</li>)}</ul></div></div><p><b>Почему:</b> {report.clientRecommendations.rationale}</p></ReportSection><ReportSection number={9} title="Готовый скрипт следующего звонка"><div className="script-box">{report.nextCallScript}</div></ReportSection><ReportSection number={10} title="Готовое сообщение клиенту"><div className="script-box">{report.clientMessage}</div></ReportSection><ReportSection number={11} title="Три рекомендации менеджеру"><div className="manager-recommendations">{report.managerRecommendations.map((item, index) => <article className="recommendation-card" key={`${item.skill}-${index}`}><span className="recommendation-number">{index + 1}</span><h3>{item.skill}</h3><p><b>Ошибка:</b> {item.observedError}</p><p><b>Правильное действие:</b> {item.correctAction}</p><blockquote>«{item.examplePhrase}»</blockquote><p><b>Упражнение:</b> {item.practiceExercise}</p></article>)}</div></ReportSection><ReportSection number={12} title="Краткое резюме для CRM"><div className="crm-box"><div>{report.crmSummary}</div><button className="button button-secondary" onClick={() => void copySummary()}>{copied ? 'Скопировано' : 'Копировать CRM-резюме'}</button></div></ReportSection><ReportSection number={13} title="Заключение руководителю отдела продаж"><div className="conclusion-box"><p>{report.managerConclusion}</p>{report.criticalViolations.length > 0 && <><h3>Критические нарушения</h3><ul>{report.criticalViolations.map((item) => <li key={item}>{item}</li>)}</ul></>}</div></ReportSection></div>;
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
  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioOutputConnectedRef = useRef(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [fragmentStart, setFragmentStart] = useState(0);
  const [fragmentEnd, setFragmentEnd] = useState(0);
  const [fragmentTranscribing, setFragmentTranscribing] = useState(false);
  const [transcriptSource, setTranscriptSource] = useState<{ start: number; end: number } | null>(null);
  const [transcriptSelection, setTranscriptSelection] = useState({ start: 0, end: 0 });
  const [aiCapacity, setAICapacity] = useState<AICapacity | null>(null);

  useEffect(() => {
    if (!id) return;
    const existingAnalysis = api.analysis(meetingId).catch((cause) => {
      if (cause instanceof Error && cause.message === 'Анализ ещё не выполнен') return null;
      throw cause;
    });
    const capacity = api.aiCapacity().catch(() => null);
    Promise.all([api.meeting(meetingId), api.transcript(meetingId), existingAnalysis, capacity]).then(([nextMeeting, nextTranscript, nextAnalysis, nextCapacity]) => {
      setMeeting(nextMeeting);
      setTranscript(nextTranscript.content);
      setAICapacity(nextCapacity);
      setTranscriptSource(nextTranscript.sourceStartSeconds !== null && nextTranscript.sourceEndSeconds !== null ? { start: nextTranscript.sourceStartSeconds, end: nextTranscript.sourceEndSeconds } : null);
      setFragmentStart(0);
      setFragmentEnd(nextMeeting.duration ?? 0);
      setTranscriptSelection({ start: 0, end: 0 });
      setAnalysis(nextAnalysis);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Не удалось загрузить встречу'));
  }, [id, meetingId]);

  const saveTranscript = async () => {
    setSavingTranscript(true); setTranscriptError(''); setTranscriptSaved(false);
    try { const result = await api.saveTranscript(meetingId, transcript); setTranscript(result.content); setTranscriptSource(null); setTranscriptSelection({ start: 0, end: 0 }); setTranscriptSaved(true); } catch (cause) { setTranscriptError(cause instanceof Error ? cause.message : 'Не удалось сохранить расшифровку'); } finally { setSavingTranscript(false); }
  };
  const requestTranscription = async () => {
    setTranscribing(true); setTranscriptError('');
    try { const result = await api.transcribe(meetingId); setTranscript(result.transcript.content); setTranscriptSource(null); setTranscriptSelection({ start: 0, end: 0 }); setAnalysis(null); } catch (cause) { setTranscriptError(cause instanceof Error ? cause.message : 'ИИ-провайдер пока не подключён'); } finally { setTranscribing(false); }
  };
  const runAnalysis = async () => {
    setAnalyzing(true); setAnalysisError('');
    try { setAnalysis(await api.analyze(meetingId)); } catch (cause) { setAnalysisError(cause instanceof Error ? cause.message : 'ИИ-провайдер пока не подключён'); } finally { setAnalyzing(false); }
  };
  const onAudioMetadata = () => {
    const duration = audioRef.current?.duration ?? 0;
    if (!Number.isFinite(duration) || duration <= 0) return;
    setAudioDuration(duration);
    setFragmentEnd((current) => current > 0 && current <= duration ? current : duration);
  };
  const captureAudioFragment = async (): Promise<{ blob: Blob; mimeType: string }> => {
    const audio = audioRef.current;
    if (!audio || !audioDuration || fragmentEnd <= fragmentStart) throw new Error('Выберите корректный фрагмент аудиозаписи');
    const AudioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor || !window.MediaRecorder) throw new Error('Этот браузер не поддерживает запись выбранного фрагмента');
    const context = audioContextRef.current ?? new AudioContextConstructor();
    audioContextRef.current = context;
    const source = audioSourceRef.current ?? context.createMediaElementSource(audio);
    audioSourceRef.current = source;
    const destination = context.createMediaStreamDestination();
    source.connect(destination);
    if (!audioOutputConnectedRef.current) {
      source.connect(context.destination);
      audioOutputConnectedRef.current = true;
    }
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
    if (!mimeType) throw new Error('В браузере нет поддерживаемого формата записи фрагмента');
    const recorder = new MediaRecorder(destination.stream, { mimeType });
    const chunks: BlobPart[] = [];
    const blobPromise = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error('Не удалось подготовить аудиофрагмент'));
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });
    const previousTime = audio.currentTime;
    const stopAtEnd = () => {
      if (audio.currentTime >= fragmentEnd && recorder.state !== 'inactive') {
        audio.pause();
        recorder.stop();
      }
    };
    audio.addEventListener('timeupdate', stopAtEnd);
    audio.currentTime = fragmentStart;
    await context.resume();
    recorder.start(250);
    try {
      await audio.play();
      await new Promise<void>((resolve) => window.setTimeout(resolve, Math.ceil((fragmentEnd - fragmentStart + 2) * 1000)));
      if (recorder.state !== 'inactive') { audio.pause(); recorder.stop(); }
      const blob = await blobPromise;
      return { blob, mimeType };
    } finally {
      audio.removeEventListener('timeupdate', stopAtEnd);
      audio.pause();
      if (recorder.state !== 'inactive') recorder.stop();
      audio.currentTime = previousTime;
      source.disconnect(destination);
    }
  };
  const requestFragmentTranscription = async () => {
    if (fragmentEnd <= fragmentStart || !audioDuration) {
      setTranscriptError('Укажите корректный фрагмент аудиозаписи');
      return;
    }
    setFragmentTranscribing(true); setTranscriptError(''); setAnalysisError('');
    try {
      const captured = await captureAudioFragment();
      const extension = captured.mimeType.includes('mp4') ? 'm4a' : 'webm';
      const result = await api.transcribeFragment(meetingId, captured.blob, `fragment-${Math.round(fragmentStart)}-${Math.round(fragmentEnd)}.${extension}`, fragmentStart, fragmentEnd);
      setTranscript(result.transcript.content);
      setTranscriptSource({ start: fragmentStart, end: fragmentEnd });
      setAnalysis(null);
    } catch (cause) {
      setTranscriptError(cause instanceof Error ? cause.message : 'Не удалось расшифровать выбранный фрагмент');
    } finally {
      setFragmentTranscribing(false);
    }
  };
  const selectionStart = Math.max(0, Math.min(transcriptSelection.start, transcript.length));
  const selectionEnd = Math.max(selectionStart, Math.min(transcriptSelection.end, transcript.length));
  const selectedTranscriptText = transcript.slice(selectionStart, selectionEnd).trim();
  const analyzeSelectedText = () => {
    if (!selectedTranscriptText) {
      setAnalysisError('Сначала выделите нужный текст мышью');
      return;
    }
    setAnalyzing(true); setAnalysisError('');
    void api.analyze(meetingId, { startChar: selectionStart, endChar: selectionEnd }).then(setAnalysis).catch((cause) => setAnalysisError(cause instanceof Error ? cause.message : 'ИИ-провайдер пока не подключён')).finally(() => setAnalyzing(false));
  };

  if (error) return <div className="empty-page"><div className="empty-icon"><BarChart3 size={24} /></div><h1>Не удалось открыть встречу</h1><p>{error}</p><Link className="button button-secondary" to="/meetings">Вернуться к истории</Link></div>;
  if (!meeting) return <div className="loading-screen">Загрузка встречи…</div>;
  const capacityText = aiCapacity === null ? 'Проверяем лимит Groq…' : aiCapacity.provider !== 'groq' ? 'Groq не подключён.' : aiCapacity.estimatedFragmentSecondsAvailable === null ? 'Не удалось определить лимит Groq.' : aiCapacity.estimatedFragmentSecondsAvailable <= 0 ? `При текущем лимите ${aiCapacity.tpmLimit?.toLocaleString('ru-RU')} TPM подходящего фрагмента нет: один системный промпт занимает примерно ${aiCapacity.estimatedSystemTokens?.toLocaleString('ru-RU')} токенов.` : `Ориентировочно доступно до ${formatTimecode(aiCapacity.estimatedFragmentSecondsAvailable)} аудио при лимите ${aiCapacity.tpmLimit?.toLocaleString('ru-RU')} TPM.`;
  const analysisBlocked = aiCapacity?.provider === 'groq' && aiCapacity.estimatedFragmentSecondsAvailable === 0;
  const analysisHasScore = analysis?.score !== null && analysis?.score !== undefined;
  return <><div className="page-heading"><div><p className="eyebrow">Карточка встречи</p><h1>{meeting.title}</h1><p className="muted">{meeting.managerName} · {formatDate(meeting.meetingDate)}</p></div><Link className="button button-secondary" to="/meetings">К истории</Link></div><section className="details-grid"><div className="form-card detail-card"><div className="section-header"><div><p className="eyebrow">Аудиозапись</p><h2>{meeting.originalFilename ?? 'Файл не добавлен'}</h2></div><span className="status-badge neutral">{meeting.status === 'analyzed' ? 'Проанализирована' : 'Ожидает анализа'}</span></div>{meeting.audioPath ? <audio ref={audioRef} className="saved-audio" controls preload="metadata" src={api.audioUrl(meeting.id)} onLoadedMetadata={onAudioMetadata} /> : <div className="notice"><FileAudio size={18} /><span>Аудиозапись ещё не добавлена.</span></div>}<div className="audio-fragment-selector"><p className="eyebrow">Фрагмент аудио</p><h3>1. Выберите время</h3><p className="muted">Будут расшифрованы только указанные секунды. После этого текст можно проанализировать.</p><div className="fragment-range-grid"><label>Начало<input type="number" min="0" max={audioDuration} step="1" value={fragmentStart} onChange={(event) => setFragmentStart(Math.max(0, Math.min(Number(event.target.value), fragmentEnd)))} /> <small>{formatTimecode(fragmentStart)}</small></label><label>Конец<input type="number" min="0" max={audioDuration} step="1" value={fragmentEnd} onChange={(event) => setFragmentEnd(Math.max(fragmentStart, Math.min(Number(event.target.value), audioDuration)))} /> <small>{formatTimecode(fragmentEnd)}</small></label><span className="fragment-length">Длина: {formatTimecode(Math.max(0, fragmentEnd - fragmentStart))}</span></div><div className={aiCapacity?.estimatedFragmentSecondsAvailable === 0 ? 'fragment-capacity blocked' : 'fragment-capacity'}><strong>Ограничение анализа</strong><span>{capacityText}</span></div><button className="button button-primary" onClick={() => void requestFragmentTranscription()} disabled={fragmentTranscribing || transcribing || !audioDuration || fragmentEnd <= fragmentStart}>{fragmentTranscribing ? 'Расшифровываем…' : '2. Расшифровать этот фрагмент'}</button></div><div className="detail-meta"><div><span>Менеджер</span><strong>{meeting.managerName}</strong></div><div><span>Дата</span><strong>{formatDate(meeting.meetingDate)}</strong></div><div><span>Длительность</span><strong>{formatDuration(meeting.duration)}</strong></div></div></div><div className="form-card detail-card muted-report"><div className="empty-icon light"><BarChart3 size={22} /></div><p className="eyebrow">Анализ встречи</p>{analysis ? <><h2>{analysisHasScore ? 'Отчёт сформирован' : 'Фрагмент слишком короткий для оценки'}</h2><p>{analysisHasScore ? `Итоговая оценка: ${Math.round(analysis.score ?? 0)}/100. Охват: ${Math.round(analysis.coverage ?? 0)}%.` : 'Отчёт сохранён, но в выбранном фрагменте недостаточно подтверждённых данных для расчёта балла.'}</p><p className="analysis-scope">{analysis.sourceStartSeconds === null ? 'Обработана текущая расшифровка.' : `Обработан аудиофрагмент: ${formatTimecode(analysis.sourceStartSeconds)}–${formatTimecode(analysis.sourceEndSeconds ?? analysis.sourceStartSeconds)}.`}</p></> : <><h2>Анализ ещё не выполнен</h2><p>Сначала расшифруйте выбранный фрагмент. Оценки не выдумываются.</p><button className="button button-primary" onClick={() => void runAnalysis()} disabled={analyzing || !transcript.trim() || analysisBlocked}>{analyzing ? 'Анализируем…' : analysisBlocked ? 'Нужен больший лимит Groq' : '3. Запустить анализ текста'}</button></>}{analysisError && <p className="form-error">{analysisError}</p>}</div></section><section className="form-card transcript-card"><div className="section-header"><div><p className="eyebrow">Расшифровка выбранного фрагмента</p><h2>Текст встречи</h2><p className="muted">Здесь появится текст выбранного аудиоинтервала.</p></div></div>{transcriptSource && <div className="notice"><FileAudio size={18} /><span>Текст получен из аудио: {formatTimecode(transcriptSource.start)}–${formatTimecode(transcriptSource.end)}.</span></div>}<textarea className="transcript-editor" value={transcript} onChange={(event) => { setTranscript(event.target.value); setTranscriptSaved(false); }} onSelect={(event) => setTranscriptSelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })} placeholder="Сначала выберите время сверху и расшифруйте фрагмент." />{transcriptError && <p className="form-error">{transcriptError}</p>}<div className="transcript-actions"><button className="button button-primary" onClick={() => void saveTranscript()} disabled={savingTranscript}>{savingTranscript ? 'Сохраняем…' : 'Сохранить расшифровку'}</button>{transcriptSaved && <span className="success-text"><Check size={15} />Сохранено</span>}</div><div className="text-selection-panel"><p className="eyebrow">Точный выбор текста</p><h3>Выделите фразу для анализа</h3><p className="muted">Выделите мышью нужную часть текста прямо в поле выше. В анализ уйдёт только выделение.</p><div className="text-selection-summary">Выделено символов: <strong>{selectedTranscriptText.length.toLocaleString('ru-RU')}</strong>{selectedTranscriptText && <span> · «{selectedTranscriptText.slice(0, 140)}{selectedTranscriptText.length > 140 ? '…' : ''}»</span>}</div><button className="button button-secondary" onClick={analyzeSelectedText} disabled={analyzing || !selectedTranscriptText}>{analyzing ? 'Анализируем…' : 'Анализировать выделенный текст'}</button></div></section>{analysis && <ReportView analysis={analysis} />}</>;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null); const [stats, setStats] = useState<DashboardStats>({ totalMeetings: 0, analyzedMeetings: 0, averageScore: null }); const [meetings, setMeetings] = useState<Meeting[]>([]); const navigate = useNavigate();
  const refresh = async () => { const [nextStats, nextMeetings] = await Promise.all([api.stats(), api.meetings()]); setStats(nextStats); setMeetings(nextMeetings); };
  useEffect(() => { api.session().then((result) => { setAuthenticated(result.authenticated); if (result.authenticated) refresh().catch(() => undefined); }).catch(() => setAuthenticated(false)); }, []);
  if (authenticated === null) return <div className="loading-screen">Загрузка…</div>; if (!authenticated) return <LoginPage onLogin={() => { setAuthenticated(true); navigate('/'); refresh().catch(() => undefined); }} />;
  return <Layout onLogout={async () => { await api.logout(); setAuthenticated(false); navigate('/'); }}><Routes><Route path="/" element={<Dashboard stats={stats} meetings={meetings} />} /><Route path="/meetings" element={<MeetingsPage meetings={meetings} refresh={refresh} />} /><Route path="/meetings/new" element={<NewMeetingPage onCreated={refresh} />} /><Route path="/meetings/:id" element={<MeetingDetailsPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></Layout>;
}
