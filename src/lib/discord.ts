import { formatFrames } from './leaderboard';

// Discord webhook for celebrating top-3 placements. Configured per-deploy
// via the DISCORD_LEADERBOARD_WEBHOOK env var on Railway. When unset the
// fire-and-forget helper is a no-op — no error, no log noise — so local
// dev and ungated deploys stay quiet.

export interface DiscordTopPlacementPayload {
  rank: number;        // 1, 2, or 3
  playerName: string;
  playerAvatarUrl: string | null;
  game: string;
  challengeName: string;
  score: number | null;
  completionTimeFrames: number | null;
  publicHref: string;  // absolute URL to the per-challenge leaderboard
}

const RANK_COLORS = {
  1: 0xfbbf24,   // amber-400 — gold
  2: 0xcbd5e1,   // slate-300 — silver
  3: 0xfb923c,   // orange-400 — bronze
} as const;

const RANK_TITLES = {
  1: '#1 — new top score!',
  2: '#2 placement',
  3: '#3 placement',
} as const;

function describeMetric(score: number | null, frames: number | null): string {
  if (score != null && frames != null) return `**${score.toLocaleString()}** in ${formatFrames(frames)}`;
  if (score != null)                   return `**${score.toLocaleString()}**`;
  if (frames != null)                  return formatFrames(frames);
  return '—';
}

// Returns the request promise so callers can .catch — but never reject if
// the webhook URL isn't configured.
export async function notifyDiscordTopPlacement(p: DiscordTopPlacementPayload): Promise<void> {
  const url = process.env.DISCORD_LEADERBOARD_WEBHOOK;
  if (!url) return;
  if (p.rank < 1 || p.rank > 3) return;  // we only celebrate top 3

  const title = RANK_TITLES[p.rank as 1 | 2 | 3];
  const color = RANK_COLORS[p.rank as 1 | 2 | 3];

  const embed: Record<string, unknown> = {
    title,
    description: `${p.playerName} just placed on **${p.challengeName}** (${p.game}) with ${describeMetric(p.score, p.completionTimeFrames)}.`,
    color,
    url: p.publicHref,
    timestamp: new Date().toISOString(),
    footer: { text: 'RetroChallenges leaderboard' },
  };
  if (p.playerAvatarUrl) {
    embed.thumbnail = { url: p.playerAvatarUrl };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'RetroChallenges Bot',
        embeds: [embed],
      }),
    });
    if (!res.ok) {
      console.error(`Discord webhook responded ${res.status}: ${await res.text().catch(() => '')}`);
    }
  } catch (err) {
    console.error('Discord webhook fetch failed:', err);
  }
}
