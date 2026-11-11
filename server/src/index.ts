import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { z } from 'zod';
import { createMeeting, deleteMeeting, findMeeting, getDashboardStats, listMeetings } from './db.js';
import { isAuthenticated, login, logout, requireAuth } from './auth.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const demoPassword = process.env.DEMO_PASSWORD ?? 'royal-brick-demo';
process.env.DEMO_PASSWORD = demoPassword;

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
app.delete('/api/meetings/:id', (request, response) => {
  if (!deleteMeeting(Number(request.params.id))) {
    response.status(404).json({ error: 'Встреча не найдена' });
    return;
  }
  response.status(204).send();
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
  response.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(port, () => console.log(`Royal Brick AI Auditor server listening on http://localhost:${port}`));
