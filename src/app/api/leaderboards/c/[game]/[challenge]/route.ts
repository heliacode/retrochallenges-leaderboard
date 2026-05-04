import { NextRequest, NextResponse } from 'next/server';
import { getChallengeLeaderboard, parseLeaderboardWindow } from '@/lib/leaderboard';

export const runtime = 'nodejs';

// Public read-only endpoint that returns the top N entries for a
// (game, challengeName) tuple. Powers the desktop app's "Today's
// Pick" hero which surfaces the current #1 player + their avatar
// alongside the featured challenge.
//
// Query params:
//   limit  — int, default 1, capped at 50
//   window — daily | weekly | all (default all)
//
// Path params (URL-encoded):
//   game        — e.g. "Castlevania"
//   challenge   — e.g. "Phantom Bat — No Subweapon!"
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ game: string; challenge: string }> },
) {
  const { game: gameParam, challenge: challengeParam } = await ctx.params;
  const game          = decodeURIComponent(gameParam);
  const challengeName = decodeURIComponent(challengeParam);

  const url       = new URL(req.url);
  const limitRaw  = parseInt(url.searchParams.get('limit') ?? '1', 10);
  const limit     = Math.min(Math.max(isNaN(limitRaw) ? 1 : limitRaw, 1), 50);
  const window    = parseLeaderboardWindow(url.searchParams.get('window'));

  try {
    const entries = await getChallengeLeaderboard(game, challengeName, limit, window, 'best');
    // Strip Date instances → ISO strings for JSON; pass-through everything else.
    const json = entries.map((e) => ({
      ...e,
      serverReceivedAt: e.serverReceivedAt.toISOString(),
    }));
    return NextResponse.json({ ok: true, game, challengeName, window, entries: json });
  } catch (err) {
    console.error('[api/leaderboards] failed:', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
