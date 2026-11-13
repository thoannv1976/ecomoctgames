// Game 4 (Market Detective) through the API, against the Firestore emulator.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, SignJWT } from 'jose';
import type { MdMe, MdRoomDoc } from '@arena/engine';
import { buildApp } from '../src/app.js';
import { openFirestore } from '../src/firestore.js';

const HUB = 'https://hub.test';
const SECRET = 'test-secret-md0-0123456789';
const db = openFirestore('demo-arena', '(default)');
let app: FastifyInstance;
let privateKey: CryptoKey;
const sent: Array<Record<string, unknown>> = [];
let clock = 1_800_900_000_000;

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
const roomOf = async (code: string) => (await db.doc(`rooms/${code}`).get()).data() as MdRoomDoc;

async function ticket() {
  return new SignJWT({
    ugh: { tenantId: 'aiedu2026', platform: { issuer: 'https://aiedu2026.com', deploymentId: '9' }, ltiSub: 'u-m', name: 'Tran Mai', role: 'learner', context: { id: '33', title: 'ECOM-OCT' }, resourceLink: { id: 'rl-m' }, activity: 'market-detective', gradeTarget: 'gt-md', launchId: 'l' },
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'unigamehub-launch+jwt', kid: 'k1' })
    .setIssuer(HUB).setAudience('ecomoctgames').setSubject('hub-user-md').setJti(crypto.randomUUID()).setIssuedAt().setExpirationTime('2m')
    .sign(privateKey);
}


describe('Game 4 via API', () => {
  it('plays a 1 vs 5 AI game from Moodle; the grade reaches the Hub', async () => {
    const launch = (await post('/api/lti/launch', { ticket: await ticket() })).body;
    expect(launch.activity).toBe('market-detective');
    const created = await post('/api/rooms', { game: 'market-detective', hostPlays: true, ltiSession: launch.session, settings: { caseSec: 0, botLevel: 'hard' } });
    expect(created.status).toBe(200);
    const { code, hostToken, playerId, playerToken } = created.body as Record<string, string>;
    expect((await post(`/api/rooms/${code}/ceo-me`, { playerId, playerToken })).status).toBe(409);
    expect((await post(`/api/rooms/${code}/start`, { hostToken })).status).toBe(200);
    for (let r = 1; r <= 3; r++) {
      const room = await roomOf(code!);
      expect(room.status).toBe('decide');
      expect(room.order).toHaveLength(6);
      expect(JSON.stringify(room)).not.toContain('implied');
      expect((await post(`/api/rooms/${code}/md-buy`, { playerId, playerToken, round: r, source: 'gossip' })).status).toBe(400);
      let me = (await post(`/api/rooms/${code}/md-buy`, { playerId, playerToken, round: r, source: 'interview' })).body as unknown as MdMe;
      me = (await post(`/api/rooms/${code}/md-buy`, { playerId, playerToken, round: r, source: 'ai' })).body as unknown as MdMe;
      expect(me.credits).toBe(65);
      expect(me.aiClaims).toHaveLength(4);
      const est = me.findings.find((f) => f.source === 'interview')!.implied!;
      const decision = est >= room.case!.launchAt ? 'launch' : est >= room.case!.pilotAt ? 'pilot' : 'no';
      const ok = await post(`/api/rooms/${code}/md-submit`, { playerId, playerToken, round: r, submission: { estimate: est, decision, flags: [0] } });
      expect(ok.body).toMatchObject({ ok: true, closed: true });
      const after = await roomOf(code!);
      expect(after.reveal?.truth).toBeGreaterThan(0);
      expect(Object.keys(after.reveal!.scores)).toHaveLength(6);
      clock += 1000;
      if (r < 3) expect((await post(`/api/rooms/${code}/advance`, { hostToken, expectStatus: 'results', expectRound: r })).body.changed).toBe(true);
    }
    const room = await roomOf(code!);
    expect(room.status).toBe('finished');
    expect(room.lmsStatus?.[playerId!]).toBe('sent');
    const mine = sent.find((x) => x.attempt_id === `${code}:${playerId}`)!;
    expect(mine.grade_target).toBe('gt-md');
    expect(String(mine.comment)).toContain('Market Detective');
    const me = (await post(`/api/rooms/${code}/md-me`, { playerId, playerToken })).body as unknown as MdMe;
    expect(me.grade).toBe(mine.score);
  });

  it('facilitator room: timer, extend, scarce interviews, end early', async () => {
    const host = (await post('/api/rooms', { game: 'market-detective', hostPlays: false, settings: { caseSec: 300, fillBots: false } })).body as Record<string, string>;
    const seats = [];
    for (const name of ['An', 'Binh', 'Chi']) seats.push((await post(`/api/rooms/${host.code}/join`, { name })).body as Record<string, string>);
    await post(`/api/rooms/${host.code}/start`, { hostToken: host.hostToken });
    let room = await roomOf(host.code!);
    expect(room.order).toHaveLength(3);
    const deadline = room.deadline!;
    expect((await post(`/api/rooms/${host.code}/extend`, { hostToken: host.hostToken })).status).toBe(200);
    for (const [i, s] of seats.entries()) {
      const res = await post(`/api/rooms/${host.code}/md-buy`, { playerId: s.playerId, playerToken: s.playerToken, round: 1, source: 'interview' });
      expect(res.status).toBe(i < 2 ? 200 : 409);
    }
    expect((await roomOf(host.code!)).interviews).toHaveLength(2);
    clock = deadline + 60_001;
    expect((await post(`/api/rooms/${host.code}/advance`, { expectStatus: 'decide', expectRound: 1 })).body.changed).toBe(true);
    room = await roomOf(host.code!);
    expect(room.standings[seats[0]!.playerId!]!.defaulted).toBe(true);
    expect((await post(`/api/rooms/${host.code}/end`, { hostToken: host.hostToken })).status).toBe(200);
    expect((await roomOf(host.code!)).status).toBe('finished');
  });
});
