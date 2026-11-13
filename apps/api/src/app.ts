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
  AGENT_INVESTS,
  AI_CHOICES,
  CHANNELS,
  KPIS,
  PRICE_POS,
  SEGMENTS,
  SERVICES,
  SKU_RANGES,
  advanceCeo,
  ceoLmsResults,
  ceoMe,
  createCeoRoom,
  extendCeo,
  finishCeo,
  joinCeo,
  removeCeoPlayer,
  startCeo,
  submitCeo,
  type CeoPrivate,
  type CeoRoomDoc,
  SOURCES,
  DECISIONS,
  advanceMd,
  buyMd,
  createMdRoom,
  extendMd,
  finishMd,
  joinMd,
  mdLmsResults,
  mdMe,
  removeMdPlayer,
  startMd,
  submitMd,
  type MdPrivate,
  type MdRoomDoc,
  RS_GAME_IDS,
  advanceRs,
  createRsRoom,
  extendRs,
  finishRs,
  isRsGameId,
  joinRs,
  removeRsPlayer,
  rsGame,
  rsLmsResults,
  rsMe,
  startRs,
  submitRs,
  type RsPrivate,
  type RsRoomDoc,
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
const ceoSettings = z
  .object({
    decideSec: z.number().int().min(0).max(900).optional(),
    resultsSec: z.number().int().min(0).max(300).optional(),
    botLevel: z.enum(['easy', 'medium', 'hard']).optional(),
    fillBots: z.boolean().optional(),
  })
  .optional();
const mdSettings = z
  .object({
    caseSec: z.number().int().min(0).max(1200).optional(),
    resultsSec: z.number().int().min(0).max(300).optional(),
    botLevel: z.enum(['easy', 'medium', 'hard']).optional(),
    fillBots: z.boolean().optional(),
  })
  .optional();
const en = <T extends string>(list: readonly T[]) => z.enum(list as unknown as [T, ...T[]]);
const ceoDecision = z.object({
  price: en(PRICE_POS),
  skus: en(SKU_RANGES),
  segment: en(SEGMENTS),
  service: en(SERVICES),
  ads: z.number().min(0).max(600),
  creators: z.number().min(0).max(600),
  crm: z.number().min(0).max(600),
  mix: z.object(Object.fromEntries(CHANNELS.map((c) => [c, z.number().min(0).max(100)])) as Record<string, z.ZodNumber>),
  stock: z.number().int().min(0).max(20000),
  shopeePromo: z.boolean().optional(),
  ai: en(AI_CHOICES).optional(),
  agent: z.array(en(AGENT_INVESTS)).max(4).optional(),
  crisis: z.string().max(20).optional(),
  predict: z.record(en(KPIS), z.enum(['up', 'down'])).optional(),
});
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
    game: z.enum(['unit-economics', 'ceo-sim', 'market-detective', ...RS_GAME_IDS] as [string, ...string[]]).optional(),
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
  me: z.object({ playerId: z.string().max(40), playerToken: token }),
  ceoDecide: z.object({ playerId: z.string().max(40), playerToken: token, round: z.number().int().min(1), decision: ceoDecision }),
  rsDecide: z.object({ playerId: z.string().max(40), playerToken: token, round: z.number().int().min(1), decision: z.record(z.string(), z.unknown()) }),
  mdBuy: z.object({ playerId: z.string().max(40), playerToken: token, round: z.number().int().min(1), source: en(SOURCES) }),
  mdSubmit: z.object({
    playerId: z.string().max(40),
    playerToken: token,
    round: z.number().int().min(1),
    submission: z.object({ estimate: z.number().positive().max(10000), decision: en(DECISIONS), flags: z.array(z.number().int().min(0).max(10)).max(10) }),
  }),
};

type AnyRoom = RoomDoc | CeoRoomDoc | MdRoomDoc | RsRoomDoc;
type AnyPriv = RoomPrivate | CeoPrivate | MdPrivate | RsPrivate;
const isCeo = (r: AnyRoom): r is CeoRoomDoc => r.game === 'ceo-sim';
const isMd = (r: AnyRoom): r is MdRoomDoc => r.game === 'market-detective';
const isRs = (r: AnyRoom): r is RsRoomDoc => isRsGameId(r.game);
const NAMES: Record<string, { en: string; vi: string }> = {
  'unit-economics': { en: 'Unit Economics Showdown', vi: 'Thám tử lợi nhuận' },
  'ceo-sim': { en: 'CEO Simulator', vi: 'Mô phỏng CEO' },
  'market-detective': { en: 'Market Detective', vi: 'Thám tử thị trường' },
  'platform-wars': { en: 'Platform Wars', vi: 'Chiến tranh nền tảng' },
  'cro-battle': { en: 'CRO Battle', vi: 'Đấu trường A/B' },
};
const wrongGame = (r: AnyRoom) =>
  new GameError('wrong_game', { en: `This room plays ${NAMES[r.game]?.en ?? r.game}.`, vi: `Phòng này là game ${NAMES[r.game]?.vi ?? r.game}.` }, 409);
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
      if (!wasFinished && room.status === 'finished') toSend = isRs(room) ? rsLmsResults(rsGame(room.game), room, priv as RsPrivate) : isCeo(room) ? ceoLmsResults(room, priv as CeoPrivate) : isMd(room) ? mdLmsResults(room, priv as MdPrivate) : lmsResults(room as RoomDoc, priv as RoomPrivate);
      return out;
    });
    if (toSend.length) await sendGrades(roomCode, toSend);
    return result;
  }

  /** Quiz-only and CEO-only routes. */
  const mutateQuiz = <T>(roomCode: string, fn: (room: RoomDoc, priv: RoomPrivate, t: number) => T) =>
    mutateAny(roomCode, (room, priv, t) => {
      if (isCeo(room) || isMd(room) || isRs(room)) throw wrongGame(room);
      return fn(room, priv as RoomPrivate, t);
    });
  const mutateCeo = <T>(roomCode: string, fn: (room: CeoRoomDoc, priv: CeoPrivate, t: number) => T) =>
    mutateAny(roomCode, (room, priv, t) => {
      if (!isCeo(room)) throw wrongGame(room);
      return fn(room, priv as CeoPrivate, t);
    });
  const mutateMd = <T>(roomCode: string, fn: (room: MdRoomDoc, priv: MdPrivate, t: number) => T) =>
    mutateAny(roomCode, (room, priv, t) => {
      if (!isMd(room)) throw wrongGame(room);
      return fn(room, priv as MdPrivate, t);
    });

  const mutateRs = <T>(roomCode: string, fn: (room: RsRoomDoc, priv: RsPrivate, t: number) => T) =>
    mutateAny(roomCode, (room, priv, t) => {
      if (!isRs(room)) throw wrongGame(room);
      return fn(room, priv as RsPrivate, t);
    });

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
    const gameSettings = body.game === 'ceo-sim' || isRsGameId(body.game) ? ceoSettings.parse(body.settings) : body.game === 'market-detective' ? mdSettings.parse(body.settings) : quizSettings.parse(body.settings);
    const lms = await loadLtiSession(body.ltiSession);
    if (lms && body.hostPlays && !body.hostName?.trim()) body.hostName = lms.name;
    if (body.hostPlays && !body.hostName?.trim()) throw new GameError('bad_name', E('Please enter your name.', 'Vui lòng nhập tên.'));
    for (let attempt = 0; attempt < 6; attempt++) {
      const roomCode = randomRoomCode(cryptoRng);
      const t = now();
      const common = {
        code: roomCode,
        hostPlays: body.hostPlays,
        ...(body.title ? { title: body.title } : {}),
        ...(body.hostName ? { hostName: body.hostName } : {}),
        ...(gameSettings ? { settings: gameSettings as never } : {}),
        ...(lms && body.hostPlays ? { hostLms: bindingOf(lms) } : {}),
      };
      const created = isRsGameId(body.game) ? createRsRoom(rsGame(body.game), common, t, cryptoRng) : body.game === 'ceo-sim' ? createCeoRoom(common, t, cryptoRng) : body.game === 'market-detective' ? createMdRoom(common, t, cryptoRng) : createRoom(common, t, cryptoRng);
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
    const binding = lms ? bindingOf(lms) : undefined;
    const player = await mutateAny(roomCode, (room, priv, t) =>
      isRs(room)
        ? joinRs(room, priv as RsPrivate, name, t, cryptoRng, binding)
        : isCeo(room)
        ? joinCeo(room, priv as CeoPrivate, name, t, cryptoRng, binding)
        : isMd(room)
          ? joinMd(room, priv as MdPrivate, name, t, cryptoRng, binding)
          : joinRoom(room, priv as RoomPrivate, name, t, cryptoRng, binding),
    );
    return { ...player, serverNow: now() };
  });

  app.post('/api/rooms/:code/start', async (req) => {
    const roomCode = parseCode(req.params);
    const { hostToken } = schemas.host.parse(req.body);
    await mutateAny(roomCode, (room, priv, t) => {
      requireHost(priv, hostToken);
      if (isRs(room)) startRs(rsGame(room.game), room, priv as RsPrivate, t, cryptoRng);
      else if (isCeo(room)) startCeo(room, priv as CeoPrivate, t, cryptoRng);
      else if (isMd(room)) startMd(room, priv as MdPrivate, t, cryptoRng);
      else startGame(room, priv as RoomPrivate, templates, t, cryptoRng);
    });
    return { ok: true, serverNow: now() };
  });

  app.post('/api/rooms/:code/kick', async (req) => {
    const roomCode = parseCode(req.params);
    const { hostToken, playerId } = schemas.kick.parse(req.body);
    await mutateAny(roomCode, (room, priv) => {
      requireHost(priv, hostToken);
      if (isRs(room)) removeRsPlayer(room, priv as RsPrivate, playerId);
      else if (isCeo(room)) removeCeoPlayer(room, priv as CeoPrivate, playerId);
      else if (isMd(room)) removeMdPlayer(room, priv as MdPrivate, playerId);
      else removePlayer(room as RoomDoc, priv as RoomPrivate, playerId);
    });
    return { ok: true, serverNow: now() };
  });

  app.post('/api/rooms/:code/answer', async (req) => {
    const roomCode = parseCode(req.params);
    const body = schemas.answer.parse(req.body);
    const closed = await mutateQuiz(roomCode, (room, priv, t) => {
      requirePlayer(priv, body.playerId, body.playerToken);
      return submitAnswer(room, priv, body.playerId, body.qIndex, body.input as never, t);
    });
    return { ok: true, closed, serverNow: now() };
  });

  app.post('/api/rooms/:code/hint', async (req) => {
    const roomCode = parseCode(req.params);
    const body = schemas.hint.parse(req.body);
    const hint = await mutateQuiz(roomCode, (room, priv, t) => {
      requirePlayer(priv, body.playerId, body.playerToken);
      return useHint(room, priv, body.playerId, body.qIndex, t);
    });
    return { hint, serverNow: now() };
  });

  // Anyone in the room may ask to close a question whose time is up; moving on needs the host (or auto-next).
  app.post('/api/rooms/:code/advance', async (req) => {
    const roomCode = parseCode(req.params);
    const body = schemas.advance.parse(req.body);
    const changed = await mutateAny(roomCode, (room, priv, t) => {
      const isHost = sameToken(priv.hostToken, body.hostToken);
      if (isRs(room))
        return advanceRs(rsGame(room.game), room, priv as RsPrivate, t, {
          isHost,
          ...(body.expectStatus ? { expectStatus: body.expectStatus as RsRoomDoc['status'] } : {}),
          ...(body.expectRound !== undefined ? { expectRound: body.expectRound } : {}),
        });
      if (isCeo(room))
        return advanceCeo(room, priv as CeoPrivate, t, {
          isHost,
          ...(body.expectStatus ? { expectStatus: body.expectStatus as CeoRoomDoc['status'] } : {}),
          ...(body.expectRound !== undefined ? { expectRound: body.expectRound } : {}),
        });
      if (isMd(room))
        return advanceMd(room, priv as MdPrivate, t, {
          isHost,
          ...(body.expectStatus ? { expectStatus: body.expectStatus as MdRoomDoc['status'] } : {}),
          ...(body.expectRound !== undefined ? { expectRound: body.expectRound } : {}),
        });
      return advance(room as RoomDoc, priv as RoomPrivate, t, {
        isHost,
        ...(body.expectStatus ? { expectStatus: body.expectStatus as RoomDoc['status'] } : {}),
        ...(body.expectQIndex !== undefined ? { expectQIndex: body.expectQIndex } : {}),
      });
    });
    return { changed, serverNow: now() };
  });

  app.post('/api/rooms/:code/end', async (req) => {
    const roomCode = parseCode(req.params);
    const { hostToken } = schemas.host.parse(req.body);
    await mutateAny(roomCode, (room, priv, t) => {
      requireHost(priv, hostToken);
      if (room.status === 'lobby') throw new GameError('not_started', E('The game has not started.', 'Trò chơi chưa bắt đầu.'), 409);
      if (isRs(room)) finishRs(rsGame(room.game), room, priv as RsPrivate, t);
      else if (isCeo(room)) finishCeo(room, priv as CeoPrivate, t);
      else if (isMd(room)) finishMd(room, priv as MdPrivate, t);
      else finishGame(room as RoomDoc, priv as RoomPrivate, t);
    });
    return { ok: true, serverNow: now() };
  });

  // ───────── Game 12 – CEO Simulator ─────────
  app.post('/api/rooms/:code/ceo-decide', async (req) => {
    const roomCode = parseCode(req.params);
    const body = schemas.ceoDecide.parse(req.body);
    const closed = await mutateCeo(roomCode, (room, priv, t) => {
      requirePlayer(priv, body.playerId, body.playerToken);
      return submitCeo(room, priv, body.playerId, body.round, body.decision as never, t);
    });
    return { ok: true, closed, serverNow: now() };
  });

  app.post('/api/rooms/:code/extend', async (req) => {
    const roomCode = parseCode(req.params);
    const { hostToken } = schemas.host.parse(req.body);
    await mutateAny(roomCode, (room, priv) => {
      requireHost(priv, hostToken);
      if (isRs(room)) extendRs(room, 60);
      else if (isCeo(room)) extendCeo(room, 60);
      else if (isMd(room)) extendMd(room, 60);
      else throw wrongGame(room);
    });
    return { ok: true, serverNow: now() };
  });

  app.post('/api/rooms/:code/ceo-me', async (req) => {
    const roomCode = parseCode(req.params);
    const body = schemas.me.parse(req.body);
    const roomRef = rooms.doc(roomCode);
    const [rs, ps] = await db.getAll(roomRef, roomRef.collection('private').doc('state'));
    if (!rs?.exists || !ps?.exists) throw new GameError('no_room', E('Room not found.', 'Không tìm thấy phòng.'), 404);
    const room = rs.data() as AnyRoom;
    const priv = ps.data() as AnyPriv;
    if (!isCeo(room)) throw wrongGame(room);
    requirePlayer(priv, body.playerId, body.playerToken);
    return { ...ceoMe(room, priv as CeoPrivate, body.playerId), serverNow: now() };
  });

  // ───────── Game 4 – Market Detective ─────────
  app.post('/api/rooms/:code/md-buy', async (req) => {
    const roomCode = parseCode(req.params);
    const body = schemas.mdBuy.parse(req.body);
    const me = await mutateMd(roomCode, (room, priv, t) => {
      requirePlayer(priv, body.playerId, body.playerToken);
      buyMd(room, priv, body.playerId, body.round, body.source, t);
      return mdMe(room, priv, body.playerId);
    });
    return { ...me, serverNow: now() };
  });

  app.post('/api/rooms/:code/md-submit', async (req) => {
    const roomCode = parseCode(req.params);
    const body = schemas.mdSubmit.parse(req.body);
    const closed = await mutateMd(roomCode, (room, priv, t) => {
      requirePlayer(priv, body.playerId, body.playerToken);
      return submitMd(room, priv, body.playerId, body.round, body.submission, t);
    });
    return { ok: true, closed, serverNow: now() };
  });

  app.post('/api/rooms/:code/md-me', async (req) => {
    const roomCode = parseCode(req.params);
    const body = schemas.me.parse(req.body);
    const roomRef = rooms.doc(roomCode);
    const [rs, ps] = await db.getAll(roomRef, roomRef.collection('private').doc('state'));
    if (!rs?.exists || !ps?.exists) throw new GameError('no_room', E('Room not found.', 'Không tìm thấy phòng.'), 404);
    const room = rs.data() as AnyRoom;
    const priv = ps.data() as AnyPriv;
    if (!isMd(room)) throw wrongGame(room);
    requirePlayer(priv, body.playerId, body.playerToken);
    return { ...mdMe(room, priv as MdPrivate, body.playerId), serverNow: now() };
  });

  // ───────── Round-sim games (Game 2 …) ─────────
  app.post('/api/rooms/:code/rs-decide', async (req) => {
    const roomCode = parseCode(req.params);
    const body = schemas.rsDecide.parse(req.body);
    const closed = await mutateRs(roomCode, (room, priv, t) => {
      requirePlayer(priv, body.playerId, body.playerToken);
      return submitRs(rsGame(room.game), room, priv, body.playerId, body.round, body.decision, t);
    });
    return { ok: true, closed, serverNow: now() };
  });

  app.post('/api/rooms/:code/rs-me', async (req) => {
    const roomCode = parseCode(req.params);
    const body = schemas.me.parse(req.body);
    const roomRef = rooms.doc(roomCode);
    const [rs, ps] = await db.getAll(roomRef, roomRef.collection('private').doc('state'));
    if (!rs?.exists || !ps?.exists) throw new GameError('no_room', E('Room not found.', 'Không tìm thấy phòng.'), 404);
    const room = rs.data() as AnyRoom;
    const priv = ps.data() as AnyPriv;
    if (!isRs(room)) throw wrongGame(room);
    requirePlayer(priv, body.playerId, body.playerToken);
    return { ...rsMe(rsGame(room.game), room, priv as RsPrivate, body.playerId), serverNow: now() };
  });

  return app;
}
