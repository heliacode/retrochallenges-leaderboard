# Anti-cheat — design notes (deferred)

Captured for later. Not currently implemented; the leaderboard is on a
trust + moderation model.

## The problem

A runner can load extra Lua scripts in BizHawk's Lua Console alongside
the challenge script. Some of those scripts give unfair advantages:

- **God-mode** (peg HP / lives / weapon ammo to max each frame). The
  `_tools/megaman2/godmode.lua` and `_tools/dragonwarrior/maxstats.lua`
  in the assets repo demonstrate the pattern — these are intentionally
  public for challenge authoring, but anyone could fork them or write
  equivalents.
- **Auto-fire / TAS-style input macros** via `joypad.set`.
- **Direct RAM writes** to set quest flags / boss HP to 0 / etc., which
  flip our win predicates without playing the game.
- **Savestate manipulation** outside the framework.

## Threat model

What we **are** trying to deter:

- Casual runners pasting in a god-mode tool to grab top-1.
- Accidental cheats (someone forgets they had a HUD-augmenting script
  loaded from a previous session).

What we **are not** going to defeat:

- A determined attacker who modifies BizHawk itself or runs the desktop
  app under a debugger. The leaderboard is a hobbyist project, not a
  cash competition. The cost of perfect prevention is way out of scale.

## Why client-side enforcement is limited

- **BizHawk's Lua API doesn't expose other registered scripts.** No
  `client.getluascripts()` or equivalent. The Lua Console's GUI knows;
  the API doesn't.
- **Even if it did**, a cheater can patch their local BizHawk. We can't
  verify what code is actually executing on someone else's machine.
- **Side-effect detection is heuristic.** We can sometimes notice that
  HP isn't dropping during damage frames, but legitimate I-frames look
  the same to us.

## Strategy (when we get back to it)

Three layers, deploy in priority order:

### 1. Server-side per-challenge minimums

The biggest single win for the smallest amount of code.

Add a `minPlausibleFrames` and `flagBelowFrames` per challenge in
`challenges.json` (assets repo):

```json
{
  "name": "Phantom Bat — No Subweapon!",
  "minPlausibleFrames":  600,
  "flagBelowFrames":    1200,
  ...
}
```

In `/api/runs` (leaderboard server):

| Submitted `completionTimeFrames` | Action |
|---|---|
| `< minPlausibleFrames` | Reject with `400 implausible_time` — never lands in the DB. |
| `< flagBelowFrames` | Insert with new `pendingReview` flag set true. Run does NOT appear on public leaderboards until a moderator clears it. |
| `>= flagBelowFrames` | Standard publish. |

Schema additions:

```prisma
model Run {
  ...
  pendingReview Boolean   @default(false)
  reviewedAt    DateTime?
  reviewedBy    String?
}
```

Existing leaderboard queries already filter `hiddenAt: null`; add
`pendingReview: false` to that same `where` clause.

User-facing: signed-in runner sees their own pending runs on `/me` with
a "(pending review)" badge so they know it landed. Public profiles
hide the badge.

Moderator-facing: extend the existing `/api/admin/runs/[id]` endpoint
with `approve` / `reject` actions. Or add `/admin/pending` page.

**Cost:** ~half-day. Low blast-radius. Catches the obvious cases
(someone submits a 0.5-second time on a 30-second challenge).

### 2. Lua tripwire (defense in depth, optional)

At the start of `play_attempt`, write a sentinel to a normally-unused
WRAM byte (e.g., `$07F0`). One frame later, read it back. If anything
overwrote it, suspect a meddling script and either:

- Fail the attempt with a "scripted-write detected" banner, or
- Set a `suspectedRamMeddling` flag on the eventual submission.

**Limits:** only catches scripts that touch our exact sentinel address.
A god-mode script that only writes to game-relevant RAM (HP, lives) and
ignores `$07F0` slips through. Slight ROM-side risk that the engine
itself touches the chosen byte.

**Cost:** ~1-2 hours framework change + per-game sentinel address
choice. Real value is moderate — better as a complement to #1 than a
standalone.

### 3. Trust + community moderation

Already in place via `hiddenAt` / `hiddenReason`. The model that
speedrun.com uses works fine at our scale (3-4 active players).

- Recent-activity feed makes anomalies visible — a sudden "0:00.5 on
  Mummy Boss" is loud, even before we add tripwires.
- Combined with #1, suspicious runs are quarantined automatically and
  a moderator clears them.

## Phased rollout (when we revisit)

1. **Phase 1** — Schema migration: add `Run.pendingReview` /
   `reviewedAt` / `reviewedBy`. Ship without enforcement; runs are all
   `pendingReview = false` by default.
2. **Phase 2** — Add `minPlausibleFrames` + `flagBelowFrames` to one or
   two challenges as a pilot. Wire `/api/runs` to honour them. Add the
   admin pending-runs page.
3. **Phase 3** — Backfill thresholds to all challenges. Surface the
   "(pending review)" badge on `/me`.
4. **Phase 4 (optional)** — Lua tripwire in the framework, gated behind
   a per-challenge `tripwire: true` flag so trusted authors can opt in
   without forcing it everywhere.

## Open questions for later

- **Threshold authoring.** Per-challenge minimums need careful tuning —
  too tight and you reject legitimate near-TAS runs, too loose and the
  tripwire is useless. Probably bake them in at challenge-design time
  by running the challenge a few times yourself first.
- **Post-PB resubmissions.** If a run gets `pendingReview` flagged, the
  player might resubmit a slower (clearly legit) run before the
  pending one is reviewed. Does the slower run replace it on the
  leaderboard? Probably yes — show the best APPROVED run.
- **Re-grading after schema change.** When we change a threshold, do
  existing borderline runs get re-flagged? Probably no — old runs
  stand unless explicitly hidden.
- **Soft notification vs hard rejection.** Maybe the "implausible"
  bucket should also be `pendingReview` rather than reject — easier
  to recover from a wrongly-tuned threshold.

## Why we're not implementing this now

- Catalog is small, community is small, no detected cheating to date.
- Building moderation tooling for a problem we don't have yet is
  premature.
- The infrastructure (recent-activity feed + admin endpoint + hiddenAt
  flag) is already in place if we need to manually intervene.

Revisit when we hit ~50+ active players or a real incident.
