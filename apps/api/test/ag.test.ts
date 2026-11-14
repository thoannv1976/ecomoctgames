// Game 10 (Agent Arena) through the API, against the Firestore emulator.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, SignJWT } from 'jose';
import type { AgCap, AgDecision, AgReport, AgView, RsMe, RsRoomDoc } from '@arena/engine';
import { buildApp } from '../src/app.js';
import { openFirestore } from '../src/firestore.js';

const HUB = 'https://hub.test';
const SECRET = 'test-secret-ag-0123456789';
const db = openFirestore('demo-arena', '(default)');
let app: FastifyInstance;
let privateKey: CryptoKey;
const sent: Array<Record<string, unknown>> = [];
let clock = 1_803_900_000_000;

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
      ltiSub: 'u-a',
      name: 'Do Minh',
      role: 'learner',
      context: { id: '33', title: 'ECOM-OCT' },
      resourceLink: { id: 'rl-a' },
      activity: 'agent-arena',
      gradeTarget: 'gt-ag',
      launchId: 'l',
    },
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'unigamehub-launch+jwt', kid: 'k1' })
    .setIssuer(HUB)
    .setAudience('ecomoctgames')
    .setSubject('hub-user-ag')
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(privateKey);
}

const zero = (): Record<AgCap, number> => ({ catalog: 0, stock: 0, price: 0, policy: 0, api: 0, reco: 0, bot: 0, trust: 0 });
const plan = (invest: Partial<Record<AgCap, number>>, extra: Partial<AgDecision> = {}): AgDecision => ({
  invest: { ...zero(), ...invest },
  guard: 'none',
  handover: 'never',
  diversity: false,
  holdout: true,
  ...extra,
});

describe('Game 10 via API', () => {
  it('plays a solo Agent Arena game from Moodle; the grade reaches the Hub', async () => {
    const launch = (await post('/api/lti/launch', { ticket: await ticket() })).body;
    expect(launch.activity).toBe('agent-arena');
    const created = await post('/api/rooms', { game: 'agent-arena', hostPlays: true, ltiSession: launch.session, settings: { decideSec: 0 } });
    expect(created.status).toBe(200);
    const { code, hostToken, playerId, playerToken } = created.body as Record<string, string>;
    expect((await post(`/api/rooms/${code}/start`, { hostToken })).status).toBe(200);
    const steps: Array<Partial<Record<AgCap, number>>> = [
      { trust: 1, catalog: 1, reco: 1 },
      { trust: 1, catalog: 2, reco: 1, api: 1 },
      { trust: 1, catalog: 2, reco: 1, api: 2, stock: 2 },
      { trust: 2, catalog: 3, reco: 1, api: 2, stock: 2 },
      { trust: 2, catalog: 3, reco: 1, api: 2, stock: 2, policy: 2 },
    ];
    for (let r = 1; r <= 5; r++) {
      const room = await roomOf(code!);
      expect(room.status).toBe('decide');
      const me = (await post(`/api/rooms/${code}/rs-me`, { playerId, playerToken })).body as unknown as RsMe<AgReport, AgView>;
      expect(me.view.points).toBe(8);
      // Spending more engineer-quarters than you have is refused, and so is pulling a level back down.
      const over = await post(`/api/rooms/${code}/rs-decide`, { playerId, playerToken, round: r, decision: plan({ catalog: 3, trust: 3 }) });
      expect(over.status).toBe(400);
      const ok = await post(`/api/rooms/${code}/rs-decide`, {
        playerId,
        playerToken,
        round: r,
        decision: plan(steps[r - 1]!, { guard: 'caps_log', handover: 'risk_ask', diversity: true }),
      });
      expect(ok.body).toMatchObject({ ok: true, closed: true });
      const after = (await post(`/api/rooms/${code}/rs-me`, { playerId, playerToken })).body as unknown as RsMe<AgReport, AgView>;
      expect(after.reports).toHaveLength(r);
      expect(after.view.levels.catalog).toBeGreaterThanOrEqual(1);
      clock += 1000;
      if (r < 5) expect((await post(`/api/rooms/${code}/advance`, { hostToken, expectStatus: 'results', expectRound: r })).body.changed).toBe(true);
    }
    const room = await roomOf(code!);
    expect(room.status).toBe('finished');
    expect(room.lmsStatus?.[playerId!]).toBe('sent');
    const mine = sent.find((x) => x.attempt_id === `${code}:${playerId}`)!;
    expect(mine.grade_target).toBe('gt-ag');
    expect(String(mine.comment)).toContain('Agent Arena');
  });

  it('facilitator room: AI sellers fill the seats and a missing plan builds nothing', async () => {
    const host = (await post('/api/rooms', { game: 'agent-arena', hostPlays: false, settings: { decideSec: 240, fillBots: true } })).body as Record<string, string>;
    const a = (await post(`/api/rooms/${host.code}/join`, { name: 'An' })).body as Record<string, string>;
    await post(`/api/rooms/${host.code}/start`, { hostToken: host.hostToken });
    let room = await roomOf(host.code!);
    expect(room.order).toHaveLength(6);
    clock = room.deadline! + 1;
    expect((await post(`/api/rooms/${host.code}/advance`, { expectStatus: 'decide', expectRound: 1 })).body.changed).toBe(true);
    room = await roomOf(host.code!);
    expect(room.standings[a.playerId!]!.defaulted).toBe(true);
    expect(room.standings[a.playerId!]!.cols.built).toBe(0);
    // The AI sellers did build, and the market averages are public.
    expect(Object.values(room.standings).some((s) => (s.cols.built ?? 0) > 0)).toBe(true);
    const pub = room.pub as { market?: Record<string, number>; agentShareNow?: number };
    expect(pub.agentShareNow).toBeGreaterThan(0);
    expect(pub.market?.catalog).toBeGreaterThanOrEqual(0);
    expect((await post(`/api/rooms/${host.code}/end`, { hostToken: host.hostToken })).status).toBe(200);
    expect((await roomOf(host.code!)).status).toBe('finished');
  });
});
