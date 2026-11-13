# ECOM Arena

Competitive games for the **E-commerce 2026** course (SBI programme, textbook *E-COMMERCE 2026 – Complete Edition*).
Every text exists in **English and Vietnamese**; each player switches with the EN/VI button.

| Game | Chapter | Status |
|---|---|---|
| 🧮 Unit Economics Showdown – *Thám tử lợi nhuận* | 9 | live |
| 🏢 CEO Simulator – *Mô phỏng CEO* | 12 | live |
| 🔎 Market Detective – *Thám tử thị trường* | 4 | live |
| 🌐 Platform Wars – *Chiến tranh nền tảng* | 2 | live |
| 🧪 CRO Battle – *Đấu trường A/B* | 6 | live |

Plan: [docs/ke-hoach-dot-1.md](docs/ke-hoach-dot-1.md).

## Modes
Practise alone · 1 vs 5 AI (Easy/Medium/Hard) · class battle: 6 students per room, many rooms at once, class-wide leaderboard and a Final room on the lecturer dashboard (`/gv`).

## Structure
- `packages/engine` – pure TypeScript game logic. Game 9 questions are **templates** (`src/unit/templates.ts`): every game draws fresh numbers, so answers cannot be copied between rooms. `npm run test:unit`; preview questions with `npx tsx packages/engine/scripts/peek-unit.ts [template-id]`. Game 12 lives in `src/ceo/` (balance: `scripts/balance-ceo.ts`); Game 4 in `src/md/` – 6 cases, each game draws 3 with a fresh true market size and biased sources (balance: `scripts/balance-md.ts`). Multi-round market games share the round-sim framework in `src/rs/` (one room state machine; each game plugs in a hidden model as an `RsGame`, registered in `src/rs/registry.ts`; web side `apps/web/src/rs/` + one `RsWeb` module per game). Game 2 lives in `src/pw/` (balance: `scripts/balance-pw.ts`, student strategies: `scripts/human-pw.ts`); Game 6 in `src/cro/` – 13 ideas with hidden true effects and novelty, tests simulated day by day so peeking really inflates false winners (balance: `scripts/balance-cro.ts`).
- `apps/api` – Fastify on Cloud Run (`arena-api`). All writes go through the API in Firestore transactions; answers and tokens live in `rooms/{code}/private/state`.
- `apps/web` – React + Vite + Tailwind on Firebase Hosting; the browser reads only `rooms/{code}` and imports only `packages/engine/src/types.ts`.

Pages: `/` students · `/p/:code` player · `/gv` lecturer dashboard · `/gv/:code` projector · `/lti-launch` Moodle (UniGame Hub, LTI 1.3).

## Run locally (Windows)
```bash
cd /c/gh/repos/ecomoctgames && firebase emulators:start --only firestore --project demo-arena
PORT=8090 FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 npx tsx apps/api/src/server.ts
npm run dev --workspace @arena/web   # http://localhost:5174
```

## Deploy
`FIREBASE_ACCOUNT=<owner> bash scripts/deploy.sh` (project `ecomoctgames`, region asia-southeast1).
One-time setup: `setup-ecomoctgames.sh` in the workspace root (Firebase, Firestore, Artifact Registry, service account, TTL).
