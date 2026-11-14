// Game 1 (Wave Rider) through the API, against the Firestore emulator.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, SignJWT } from 'jose';
import type { RsMe, RsRoomDoc, WrModel, WrReport, WrView } from '@arena/engine';
import { buildApp } from '../src/app.js';
import { openFirestore } from '../src/firestore.js';

const HUB = 'https://hub.test';
const SECRET = 'test-secret-wr-0123456789';
const db = openFirestore('demo-arena', '(default)');
let app: FastifyInstance;
let privateKey: CryptoKey;
const sent: Array<Record<string, unknown>> = [];
let clock = 1_801_900_000_000;

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
    ugh: { tenantId: 'aiedu2026', platform: { issuer: 'https://aiedu2026.com', deploymentId: '9' }, ltiSub: 'u-w', name: 'Le Tu', role: 'learner', context: { id: '33', title: 'ECOM-OCT' }, resourceLink: { id: 'rl-w' }, activity: 'wave-rider', gradeTarget: 'gt-wr', launchId: 'l' },
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'unigamehub-launch+jwt', kid: 'k1' })
    .setIssuer(HUB)
    .setAudience('ecomoctgames')
    .setSubject('hub-user-wr')
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(privateKey);
}

const zero = (): Record<WrModel, number> => ({ web: 0, seller: 0, social: 0, live: 0, app: 0, agent: 0 });
/** Ride the model each wave's infrastructure carries. */
const RIDE: WrModel[] = ['web', 'seller', 'social', 'live', 'agent'];
const plan = (round: number, chips: number) => ({ chips: { ...zero(), [RIDE[round - 1]!]: chips }, answer: 0 });

describe('Game 1 via API', () => {
  it('plays a solo Wave Rider game from Moodle; the grade reaches the Hub', async () => {
    const launch = (await post('/api/lti/launch', { ticket: await ticket() })).body;
    expect(launch.activity).toBe('wave-rider');
    const created = await post('/api/rooms', { game: 'wave-rider', hostPlays: true, ltiSession: launch.session, settings: { decideSec: 0 } });
    expect(created.status).toBe(200);
    const { code, hostToken, playerId, playerToken } = created.body as Record<string, string>;
    expect((await post(`/api/rooms/${code}/start`, { hostToken })).status).toBe(200);
    for (let r = 1; r <= 5; r++) {
      const room = await roomOf(code!);
      expect(room.status).toBe('decide');
      const me = (await post(`/api/rooms/${code}/rs-me`, { playerId, playerToken })).body as unknown as RsMe<WrReport, WrView>;
      const chips = me.view.chips;
      expect(chips).toBeGreaterThan(0);
      expect(me.view.question!.options).toHaveLength(4);
      // More chips than you hold is refused.
      const bad = await post(`/api/rooms/${code}/rs-decide`, { playerId, playerToken, round: r, decision: plan(r, chips + 1) });
      expect(bad.status).toBe(400);
      const ok = await post(`/api/rooms/${code}/rs-decide`, { playerId, playerToken, round: r, decision: plan(r, chips) });
      expect(ok.body).toMatchObject({ ok: true, closed: true });
      const after = (await post(`/api/rooms/${code}/rs-me`, { playerId, playerToken })).body as unknown as RsMe<WrReport, WrView>;
      expect(after.reports).toHaveLength(r);
      expect(after.reports[r - 1]!.round).toBe(r);
      expect(after.reports[r - 1]!.chipsBefore).toBe(chips);
      clock += 1000;
      if (r < 5) expect((await post(`/api/rooms/${code}/advance`, { hostToken, expectStatus: 'results', expectRound: r })).body.changed).toBe(true);
    }
    const room = await roomOf(code!);
    expect(room.status).toBe('finished');
    expect(room.lmsStatus?.[playerId!]).toBe('sent');
    const mine = sent.find((x) => x.attempt_id === `${code}:${playerId}`)!;
    expect(mine.grade_target).toBe('gt-wr');
    expect(String(mine.comment)).toContain('Wave Rider');
    // The hidden fit matrix and the right answers never reach the room document.
    expect(JSON.stringify(room)).not.toContain('correct');
    expect(JSON.stringify(room)).not.toContain('"fit"');
  });

  it('facilitator room: AI founders fill the seats and a missing plan keeps the chips in cash', async () => {
    const host = (await post('/api/rooms', { game: 'wave-rider', hostPlays: false, settings: { decideSec: 180, fillBots: true } })).body as Record<string, string>;
    const a = (await post(`/api/rooms/${host.code}/join`, { name: 'An' })).body as Record<string, string>;
    await post(`/api/rooms/${host.code}/start`, { hostToken: host.hostToken });
    let room = await roomOf(host.code!);
    expect(room.order).toHaveLength(6);
    const deadline = room.deadline!;
    clock = deadline + 1;
    expect((await post(`/api/rooms/${host.code}/advance`, { expectStatus: 'decide', expectRound: 1 })).body.changed).toBe(true);
    room = await roomOf(host.code!);
    expect(room.standings[a.playerId!]!.defaulted).toBe(true);
    // Chips left in cash: the capital is untouched, not lost.
    expect(room.standings[a.playerId!]!.cols.capital).toBe(10);
    expect((await post(`/api/rooms/${host.code}/end`, { hostToken: host.hostToken })).status).toBe(200);
    expect((await roomOf(host.code!)).status).toBe('finished');
  });
});
