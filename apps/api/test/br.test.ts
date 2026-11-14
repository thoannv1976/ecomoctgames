// Game 11 (Border Run) through the API, against the Firestore emulator.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, SignJWT } from 'jose';
import type { BrDecision, BrLayer, BrMarket, BrMode, BrReport, BrView, RsMe, RsRoomDoc } from '@arena/engine';
import { buildApp } from '../src/app.js';
import { openFirestore } from '../src/firestore.js';

const HUB = 'https://hub.test';
const SECRET = 'test-secret-br-0123456789';
const db = openFirestore('demo-arena', '(default)');
let app: FastifyInstance;
let privateKey: CryptoKey;
const sent: Array<Record<string, unknown>> = [];
let clock = 1_806_500_000_000;

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set');
  const kp = await generateKeyPair('RS256');
  privateKey = kp.privateKey as CryptoKey;
  const jwk = { ...(await exportJWK(kp.publicKey)), kid: 'k1', alg: 'RS256' };
  const fakeFetch = (async (_u: string, init: RequestInit) => {
    const { result_token } = JSON.parse(String(init.body)) as { result_token: string };
    const { payload } = await jwtVerify(result_token, new TextEncoder().encode(SECRET), { issuer: 'ecomoctgames', audience: HUB });
    sent.push(payload.result as Record<string, unknown>);
    return new Response(JSON.stringify({ status: 'queued' }), { status: 200 });
  }) as unknown as typeof fetch;
  app = await buildApp({ db, now: () => clock, lti: { hubUrl: HUB, gameId: 'ecomoctgames', secret: SECRET, jwks: createLocalJWKSet({ keys: [jwk] }), fetch: fakeFetch } });
});
afterAll(async () => app?.close());

async function post(url: string, payload: object) {
  const res = await app.inject({ method: 'POST', url, payload });
  return { status: res.statusCode, body: res.json() as Record<string, unknown> };
}
const roomOf = async (code: string) => (await db.doc(`rooms/${code}`).get()).data() as RsRoomDoc;

async function ticket() {
  return new SignJWT({
    ugh: {
      tenantId: 'aiedu2026',
      platform: { issuer: 'https://aiedu2026.com', deploymentId: '9' },
      ltiSub: 'u-b',
      name: 'Le Thu',
      role: 'learner',
      context: { id: '33', title: 'ECOM-OCT' },
      resourceLink: { id: 'rl-b' },
      activity: 'border-run',
      gradeTarget: 'gt-br',
      launchId: 'l',
    },
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'unigamehub-launch+jwt', kid: 'k1' })
    .setIssuer(HUB)
    .setAudience('ecomoctgames')
    .setSubject('hub-user-br')
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(privateKey);
}

const LAYERS: BrLayer[] = ['identity', 'product', 'content', 'delivery', 'remedy', 'data'];
const MARKETS: BrMarket[] = ['us', 'eu', 'jp', 'sg'];
const none = () => Object.fromEntries(MARKETS.map((m) => [m, 'none'])) as Record<BrMarket, BrMode>;
const zero = () => Object.fromEntries(LAYERS.map((l) => [l, 0])) as Record<BrLayer, number>;
const plan = (o: Partial<BrDecision> = {}): BrDecision => ({
  mode: none(),
  build: zero(),
  incoterm: 'ddp',
  localise: 'ai',
  file: [],
  returns: 'refund',
  shortcuts: [],
  ...o,
});
const all1 = { identity: 1, product: 1, content: 1, delivery: 1, remedy: 1, data: 1 };

describe('Game 11 via API', () => {
  it('plays a solo Border Run game from Moodle; the grade reaches the Hub', async () => {
    const launch = (await post('/api/lti/launch', { ticket: await ticket() })).body;
    expect(launch.activity).toBe('border-run');
    const created = await post('/api/rooms', { game: 'border-run', hostPlays: true, ltiSession: launch.session, settings: { decideSec: 0 } });
    expect(created.status).toBe(200);
    const { code, hostToken, playerId, playerToken } = created.body as Record<string, string>;
    expect((await post(`/api/rooms/${code}/start`, { hostToken })).status).toBe(200);
    const steps: Array<Partial<BrDecision>> = [
      { mode: { ...none(), sg: 'market' }, build: { ...all1, data: 0 } },
      { mode: { ...none(), sg: 'market', us: 'market' }, build: all1, file: ['sg'], localise: 'review' },
      { mode: { ...none(), sg: 'market', us: 'market' }, build: { ...all1, product: 2, content: 2 }, file: ['us'], localise: 'review' },
      { mode: { ...none(), sg: 'market', us: 'local' }, build: { ...all1, product: 2, content: 2 }, localise: 'review', returns: 'reduce' },
      { mode: { ...none(), sg: 'market', us: 'local' }, build: { ...all1, product: 2, content: 2, identity: 2, delivery: 2 }, localise: 'approve', returns: 'reduce' },
    ];
    for (let r = 1; r <= 5; r++) {
      const room = await roomOf(code!);
      expect(room.status).toBe('decide');
      const me = (await post(`/api/rooms/${code}/rs-me`, { playerId, playerToken })).body as unknown as RsMe<BrReport, BrView>;
      expect(me.view.points).toBe(9);
      // Spending more team-quarters than you have is refused, and so is retreating down the ladder.
      const over = await post(`/api/rooms/${code}/rs-decide`, { playerId, playerToken, round: r, decision: plan({ mode: { us: 'local', eu: 'own', jp: 'own', sg: 'own' }, build: { identity: 3, product: 3, content: 3, delivery: 3, remedy: 3, data: 3 } }) });
      expect(over.status).toBe(400);
      const ok = await post(`/api/rooms/${code}/rs-decide`, { playerId, playerToken, round: r, decision: plan(steps[r - 1]!) });
      expect(ok.body).toMatchObject({ ok: true, closed: true });
      const after = (await post(`/api/rooms/${code}/rs-me`, { playerId, playerToken })).body as unknown as RsMe<BrReport, BrView>;
      expect(after.reports).toHaveLength(r);
      expect(after.view.mode.sg).toBe('market');
      clock += 1000;
      if (r < 5) expect((await post(`/api/rooms/${code}/advance`, { hostToken, expectStatus: 'results', expectRound: r })).body.changed).toBe(true);
    }
    const room = await roomOf(code!);
    expect(room.status).toBe('finished');
    expect(room.lmsStatus?.[playerId!]).toBe('sent');
    const mine = sent.find((x) => x.attempt_id === `${code}:${playerId}`)!;
    expect(mine.grade_target).toBe('gt-br');
    expect(String(mine.comment)).toContain('Border Run');
    // The shortcut probabilities are only revealed once the game is over.
    const end = (await post(`/api/rooms/${code}/rs-me`, { playerId, playerToken })).body as unknown as RsMe<BrReport, BrView>;
    expect(Array.isArray(end.view.cards)).toBe(true);
  });

  it('facilitator room: AI brands fill the seats and a missing plan enters no market', async () => {
    const host = (await post('/api/rooms', { game: 'border-run', hostPlays: false, settings: { decideSec: 300, fillBots: true } })).body as Record<string, string>;
    const a = (await post(`/api/rooms/${host.code}/join`, { name: 'Binh' })).body as Record<string, string>;
    await post(`/api/rooms/${host.code}/start`, { hostToken: host.hostToken });
    let room = await roomOf(host.code!);
    expect(room.order).toHaveLength(6);
    clock = room.deadline! + 1;
    expect((await post(`/api/rooms/${host.code}/advance`, { expectStatus: 'decide', expectRound: 1 })).body.changed).toBe(true);
    room = await roomOf(host.code!);
    expect(room.standings[a.playerId!]!.defaulted).toBe(true);
    expect(room.standings[a.playerId!]!.cols.markets).toBe(0);
    // The AI brands did go abroad, and the public board says how crowded each destination is.
    expect(Object.values(room.standings).some((s) => (s.cols.markets ?? 0) > 0)).toBe(true);
    const pub = room.pub as { crowd?: Record<string, number>; dutiable?: Record<string, boolean> };
    expect(Object.values(pub.crowd ?? {}).reduce((x, y) => x + y, 0)).toBeGreaterThan(0);
    // Japan still lets small parcels in duty-free in quarter 1; the United States does not.
    expect(pub.dutiable?.jp).toBe(false);
    expect(pub.dutiable?.us).toBe(true);
    expect((await post(`/api/rooms/${host.code}/end`, { hostToken: host.hostToken })).status).toBe(200);
    expect((await roomOf(host.code!)).status).toBe('finished');
  });
});
