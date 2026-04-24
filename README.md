# RetroChallenges Leaderboard

Public, read-only leaderboard site for the [RetroChallenges](https://github.com/heliacode/RetroChallenges) desktop app. Every row is a completion that the desktop app's Lua runtime detected in-emulator and POSTed from the user's signed-in Google identity.

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS — server-rendered leaderboard tables, zero client JS.
- **Prisma** + **PostgreSQL** — schema + migrations.
- **Railway** — single Railway project provisions the Postgres addon and runs the Node service.

## Routes

| Path | Purpose |
|---|---|
| `GET /` | Homepage: list of games → challenges with visible runs. |
| `GET /c/[game]/[challenge]` | Top 50 runs for a single challenge. |
| `POST /api/runs` | Submissions from the desktop app. Requires `X-RC-Submission-Secret` header. |
| `DELETE /api/admin/runs/:id?reason=...` | Moderator soft-delete. Requires `X-Admin-Token` header. |

## Data model

- `User` — keyed on Google `sub` (the stable user ID the app already has from OAuth). `bannedAt` soft-bans a whole account.
- `Run` — one row per completion. Optional `score` and `completionTimeFrames` so the same table serves score-target and speedrun challenges. `hiddenAt` soft-hides a single run. `rawPayload` retains the full original submission for audit.

Leaderboard ordering: `score DESC nulls last → completionTimeFrames ASC nulls last → serverReceivedAt ASC`.

## Trust model

v1 is trust + moderation:

- The desktop app holds a shared `SUBMISSION_SECRET` and signs every POST with it. This stops casual curl abuse; it does not stop a determined reverse-engineer.
- Disputed scores are removed by an operator hitting `DELETE /api/admin/runs/:id` with the admin token.

Server-side replay verification (upload the savestate, re-run the emulator, diff the final state) is the eventual goal but not a v1 requirement.

## Local development

```bash
cp .env.example .env              # then fill in DATABASE_URL, SUBMISSION_SECRET, ADMIN_TOKEN
npm install
npx prisma migrate dev             # creates the schema on your local Postgres
npm run dev                        # → http://localhost:3000
```

Generate the two secrets with `openssl rand -hex 32`.

## Railway deploy

1. Create a new Railway project, attach a **PostgreSQL** plugin — Railway auto-injects `DATABASE_URL`.
2. Link this repo; Railway detects Nixpacks + `package.json`.
3. Set `SUBMISSION_SECRET` and `ADMIN_TOKEN` as service variables.
4. Deploy. `npm run start` runs `prisma migrate deploy` before `next start`, so every deploy applies pending migrations.

## Submission shape

The desktop app's Electron main process listens for challenge completions via `fs.watchFile(challenge_data.json)`, then POSTs:

```json
{
  "user": {
    "googleSub": "1234567890",
    "email": "player@example.com",
    "name": "Player Name",
    "pictureUrl": "https://lh3.googleusercontent.com/..."
  },
  "game": "Castlevania",
  "challengeName": "Get 5000 points!",
  "score": 5000,
  "completionTimeFrames": 7234,
  "clientReportedAt": "2026-04-24T12:34:56Z"
}
```

At least one of `score` and `completionTimeFrames` must be present.

## Testing

```bash
npm run typecheck
npm test
```

The test suite focuses on pure helpers (`formatFrames`, `challengeHref`) for now. Route tests against a real Postgres instance are a follow-up.
