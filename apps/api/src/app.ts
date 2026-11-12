import { randomBytes, timingSafeEqual } from 'node:crypto';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  CATEGORIES,
  GameError,
  UNIT_ECONOMICS_TEMPLATES,
  advance,
  createRoom,
  finishGame,
  joinRoom,
  lmsResults,
  randomRoomCode,
  removePlayer,
  startGame,
  submitAnswer,
  useHint,
  type LmsBinding,
  type LmsResult,
  type QuestionTemplate,
  type Rng,
  type RoomDoc,
  type RoomPrivate,
} from '@arena/engine';
import { displayName, submitResult, verifyTicket, type LtiConfig } from './lti.js';

export interface AppDeps {
  db: Firestore;
  now?: () => number;
  /** Game 9 question templates (tests may pass a smaller set). */
  templates?: readonly QuestionTemplate[];
  logger?: boolean;
  /** Moodle via UniGame Hub; null/undefined = off. */
  lti?: LtiConfig | null;
}

interface LtiSession {
  hubUserId: string;
  name: string;
  role: 'instructor' | 'learner';
  gradeTarget?: string;
  contextTitle?: string;
  tenantId: string;
  expireAt: Date;
}
const LTI_SESSION_MS = 12 * 3600 * 1000;
const ROOM_TTL_MS = 3 * 24 * 3600 * 1000;
const cryptoRng: Rng = () => randomBytes(4).readUInt32LE() / 4294967296;

const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,8}$/);
const token = z.string().min(10).max(80);
const quizSettings = z
  .object({
    questionCount: z.number().int().min(5).max(30).optional(),
    botLevel: z.enum(['easy', 'medium', 'hard']).optional(),
    fillBots: z.boolean().optional(),
    categories: z.array(z.enum(CATEGORIES as [string, ...string[]])).max(6).optional(),
    autoNextSec: z.number().int().min(0).max(60).optional(),
  })
  .optional();
const answerInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('choice'), option: z.number().int().min(0).max(10) }),
  z.object({ kind: z.literal('spot'), seg: z.number().int().min(0).max(20) }),
  z.object({ kind: z.literal('order'), order: z.array(z.number().int().min(0).max(10)).min(1).max(10) }),
]);

const schemas = {
  create: z.object({
    title: z.string().max(40).optional(),
    hostPlays: z.boolean(),
    hostName: z.string().max(40).optional(),
    game: z.enum(['unit-economics']).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    ltiSession: z.string().min(10).max(80).optional(),
  }),
  join: z.object({ name: z.string().max(40).optional(), ltiSession: z.string().min(10).max(80).optional() }),
  launch: z.object({ ticket: z.string().min(20).max(8000) }),
  host: z.object({ hostToken: token }),
  kick: z.object({ hostToken: token, playerId: z.string().max(40) }),
  answer: z.object({ playerId: z.string().max(40), playerToken: token, qIndex: z.number().int().min(0), input: answerInput }),
  hint: z.object({ playerId: z.string().max(40), playerToken: token, qIndex: z.number().int().min(0) }),
  advance: z.object({
    hostToken: token.optional(),
    expectStatus: z.enum(['lobby', 'question', 'reveal', 'finished', 'decide', 'results']).optional(),
    expectQIndex: z.number().int().min(-1).optional(),
    expectRound: z.number().int().min(0).optional(),
  }),
};

type AnyRoom = RoomDoc;
type AnyPriv = RoomPrivate;
const E = (en: string, vi: string) => ({ en, vi });

function sameToken(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { db } = deps;
  const now = deps.now ?? Date.now;
  const templates = deps.templates ?? UNIT_ECONOMICS_TEMPLATES;
  const rooms = db.collection('rooms');
  const app = Fastify({ logger: deps.logger ?? false, trustProxy: true, bodyLimit: 32 * 1024 });

  await app.register(helmet, { contentSecurityPolicy: false });
  // A whole class often shares one public IP, so the global limit is generous.
  await app.register(rateLimit, { max: 1200, timeWindow: '1 minute' });

  const fail = (code: string, en: string, vi: string) => ({ error: code, message: en, messageVi: vi, serverNow: now() });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof GameError) return reply.status(err.status).send({ error: err.code, message: err.message, messageVi: err.messageVi, serverNow: now() });
    if (err instanceof z.ZodError) return reply.status(400).send(fail('bad_request', 'Invalid request data.', 'Dữ liệu gửi lên không hợp lệ.'));
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    return reply
      .status(status)
      .send(status === 429 ? fail('rate_limited', 'Too fast – try again in a moment.', 'Thao tác quá nhanh, thử lại sau giây lát.') : fail('error', 'Server error.', 'Lỗi máy chủ.'));
  });

  /** Load room + private state in a transaction, run `fn`, write back only if the room changed. */
  async function mutateAny<T>(roomCode: string, fn: (room: AnyRoom, priv: AnyPriv, t: number) => T): Promise<T> {
    const roomRef = rooms.doc(roomCode);
    const privRef = roomRef.collection('private').doc('state');
    let toSend: LmsResult[] = [];
    const result = await db.runTransaction(async (tx) => {
      toSend = [];
      const [rs, ps] = await tx.getAll(roomRef, privRef);
      if (!rs?.exists || !ps?.exists) throw new GameError('no_room', E('Room not found. Check the room code.', 'Không tìm thấy phòng. Kiểm tra lại mã phòng.'), 404);
      const room = rs.data() as AnyRoom;
      const priv = ps.data() as AnyPriv;
      const before = room.version;
      const wasFinished = room.status === 'finished';
      const out = fn(room, priv, now());
      if (room.version !== before) {
        tx.set(roomRef, room);
        tx.set(privRef, priv);
      }
      if (!wasFinished && room.status === 'finished') toSend = lmsResults(room, priv);
      return out;
    });
    if (toSend.length) await sendGrades(roomCode, toSend);
    return result;
  }

  /** Sends each Moodle player's result to the Hub (which queues and retries delivery to Moodle). */
  async function sendGrades(roomCode: string, list: LmsResult[]) {
    const lti = deps.lti;
    if (!lti) return;
    const status: Record<string, 'sent' | 'error'> = {};
    await Promise.all(
      list.map(async (r) => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await submitResult(lti, { gradeTarget: r.binding.gradeTarget, attemptId: r.attemptId, score: r.score, maxScore: 100, occurredAt: r.occurredAt, comment: r.comment });
            status[r.playerId] = 'sent';
            return;
          } catch (err) {
            app.log.warn({ err, room: roomCode, player: r.playerId }, 'grade submit failed');
            await new Promise((ok) => setTimeout(ok, 400 * (attempt + 1)));
          }
        }
        status[r.playerId] = 'error';
      }),
    );
    await rooms.doc(roomCode).set({ lmsStatus: status }, { merge: true });
    await db
      .collection('ltiResults')
      .doc(roomCode)
      .set({ results: list.map((r) => ({ ...r, status: status[r.playerId] })), expireAt: new Date(now() + 90 * 24 * 3600 * 1000) });
  }

  async function loadLtiSession(id: string | undefined): Promise<LtiSession | null> {
    if (!id) return null;
    if (!deps.lti) throw new GameError('lti_off', E('The Moodle connection is off.', 'Chưa bật kết nối Moodle.'), 404);
    const snap = await db.collection('ltiSessions').doc(id).get();
    const s = snap.data() as (Omit<LtiSession, 'expireAt'> & { expireAt: { toMillis(): number } }) | undefined;
    if (!s || s.expireAt.toMillis() < now()) throw new GameError('lti_expired', E('Your Moodle session has expired. Open the activity in Moodle again.', 'Phiên mở từ Moodle đã hết hạn. Mở lại hoạt động trong Moodle.'), 401);
    return { ...s, expireAt: new Date(s.expireAt.toMillis()) };
  }
  const bindingOf = (s: LtiSession): LmsBinding => ({ hubUserId: s.hubUserId, ...(s.gradeTarget ? { gradeTarget: s.gradeTarget } : {}) });
  const parseCode = (params: unknown) => code.parse((params as { code: string }).code);

  function requirePlayer(priv: { tokens: Record<string, string> }, playerId: string, playerToken: string) {
    if (!sameToken(priv.tokens[playerId], playerToken)) throw new GameError('forbidden', E('Your seat is not valid. Join the room again.', 'Phiên chơi không hợp lệ. Vào lại phòng.'), 403);
  }
  function requireHost(priv: { hostToken: string }, hostToken: string | undefined) {
    if (!sameToken(priv.hostToken, hostToken)) throw new GameError('forbidden', E('Only the host can do this.', 'Chỉ chủ phòng làm được việc này.'), 403);
  }

  app.get('/api/health', async () => ({ ok: true, templates: templates.length }));
  app.get('/api/time', async () => ({ serverNow: now() }));

  // Moodle -> Hub -> /lti-launch#ticket=... -> here. Off (404) unless LTI is configured; a bad ticket -> 401.
  app.post('/api/lti/launch', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    const lti = deps.lti;
    if (!lti) return reply.status(404).send(fail('lti_off', 'The Moodle connection is off.', 'Chưa bật kết nối Moodle.'));
    const { ticket } = schemas.launch.parse(req.body);
    let ctx;
    try {
      ctx = await verifyTicket(lti, ticket);
    } catch {
      return reply.status(401).send(fail('LTI_TICKET_INVALID', 'The Moodle sign-in ticket is invalid or expired. Open the activity in Moodle again.', 'Vé đăng nhập từ Moodle không hợp lệ hoặc đã hết hạn. Mở lại hoạt động trong Moodle.'));
    }
    try {
      await db.collection('ltiTickets').doc(ctx.ticketId).create({ expireAt: ctx.expiresAt });
    } catch {
      return reply.status(401).send(fail('LTI_TICKET_USED', 'This sign-in ticket was already used. Open the activity in Moodle again.', 'Vé đăng nhập đã được dùng. Mở lại hoạt động trong Moodle.'));
    }
    const id = randomBytes(24).toString('base64url');
    const session: LtiSession = {
      hubUserId: ctx.hubUserId,
      name: displayName(ctx),
      role: ctx.role,
      tenantId: ctx.tenantId,
      ...(ctx.gradeTarget ? { gradeTarget: ctx.gradeTarget } : {}),
      ...(ctx.context?.title ? { contextTitle: ctx.context.title } : {}),
      expireAt: new Date(now() + LTI_SESSION_MS),
    };
    await db.collection('ltiSessions').doc(id).set(session);
    return { session: id, role: session.role, name: session.name, contextTitle: session.contextTitle ?? null, graded: Boolean(session.gradeTarget), activity: ctx.activity ?? null, serverNow: now() };
  });

  app.post('/api/rooms', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const body = schemas.create.parse(req.body);
    const gameSettings = quizSettings.parse(body.settings);
    const lms = await loadLtiSession(body.ltiSession);
    if (lms && body.hostPlays && !body.hostName?.trim()) body.hostName = lms.name;
    if (body.hostPlays && !body.hostName?.trim()) throw new GameError('bad_name', E('Please enter your name.', 'Vui lòng nhập tên.'));
    for (let attempt = 0; attempt < 6; attempt++) {
      const roomCode = randomRoomCode(cryptoRng);
      const t = now();
      const created = createRoom(
        {
          code: roomCode,
          hostPlays: body.hostPlays,
          ...(body.title ? { title: body.title } : {}),
          ...(body.hostName ? { hostName: body.hostName } : {}),
          ...(gameSettings ? { settings: gameSettings as never } : {}),
          ...(lms && body.hostPlays ? { hostLms: bindingOf(lms) } : {}),
        },
        t,
        cryptoRng,
      );
      const expireAt = new Date(t + ROOM_TTL_MS);
      const roomRef = rooms.doc(roomCode);
      const ok = await db.runTransaction(async (tx) => {
        const existing = await tx.get(roomRef);
        if (existing.exists) return false;
        tx.set(roomRef, { ...created.room, expireAt });
        tx.set(roomRef.collection('private').doc('state'), { ...created.priv, expireAt });
        return true;
      });
      if (ok) {
        return {
          code: roomCode,
          hostToken: created.hostToken,
          ...(created.player ? { playerId: created.player.playerId, playerToken: created.player.playerToken } : {}),
          serverNow: now(),
        };
      }
    }
    throw new GameError('busy', E('Could not create a room code, try again.', 'Không tạo được mã phòng, thử lại.'), 503);
  });

  app.post('/api/rooms/:code/join', async (req) => {
    const roomCode = parseCode(req.params);
    const body = schemas.join.parse(req.body);
    const lms = await loadLtiSession(body.ltiSession);
    const name = body.name?.trim() || lms?.name || '';
    const player = await mutateAny(roomCode, (room, priv, t) => joinRoom(room, priv, name, t, cryptoRng, lms ? bindingOf(lms) : undefined));
    return { ...player, serverNow: now() };
  });

  app.post('/api/rooms/:code/start', async (req) => {
    const roomCode = parseCode(req.params);
    const { hostToken } = schemas.host.parse(req.body);
    await mutateAny(roomCode, (room, priv, t) => {
      requireHost(priv, hostToken);
      startGame(room, priv, templates, t, cryptoRng);
    });
    return { ok: true, serverNow: now() };
  });

  app.post('/api/rooms/:code/kick', async (req) => {
    const roomCode = parseCode(req.params);
    const { hostToken, playerId } = schemas.kick.parse(req.body);
    await mutateAny(roomCode, (room, priv) => {
      requireHost(priv, hostToken);
      removePlayer(room, priv, playerId);
    });
    return { ok: true, serverNow: now() };
  });

  app.post('/api/rooms/:code/answer', async (req) => {
    const roomCode = parseCode(req.params);
    const body = schemas.answer.parse(req.body);
    const closed = await mutateAny(roomCode, (room, priv, t) => {
      requirePlayer(priv, body.playerId, body.playerToken);
      return submitAnswer(room, priv, body.playerId, body.qIndex, body.input as never, t);
    });
    return { ok: true, closed, serverNow: now() };
  });

  app.post('/api/rooms/:code/hint', async (req) => {
    const roomCode = parseCode(req.params);
    const body = schemas.hint.parse(req.body);
    const hint = await mutateAny(roomCode, (room, priv, t) => {
      requirePlayer(priv, body.playerId, body.playerToken);
      return useHint(room, priv, body.playerId, body.qIndex, t);
    });
    return { hint, serverNow: now() };
  });

  // Anyone in the room may ask to close a question whose time is up; moving on needs the host (or auto-next).
  app.post('/api/rooms/:code/advance', async (req) => {
    const roomCode = parseCode(req.params);
    const body = schemas.advance.parse(req.body);
    const changed = await mutateAny(roomCode, (room, priv, t) =>
      advance(room, priv, t, {
        isHost: sameToken(priv.hostToken, body.hostToken),
        ...(body.expectStatus ? { expectStatus: body.expectStatus as RoomDoc['status'] } : {}),
        ...(body.expectQIndex !== undefined ? { expectQIndex: body.expectQIndex } : {}),
      }),
    );
    return { changed, serverNow: now() };
  });

  app.post('/api/rooms/:code/end', async (req) => {
    const roomCode = parseCode(req.params);
    const { hostToken } = schemas.host.parse(req.body);
    await mutateAny(roomCode, (room, priv, t) => {
      requireHost(priv, hostToken);
      if (room.status === 'lobby') throw new GameError('not_started', E('The game has not started.', 'Trò chơi chưa bắt đầu.'), 409);
      finishGame(room, priv, t);
    });
    return { ok: true, serverNow: now() };
  });

  return app;
}
