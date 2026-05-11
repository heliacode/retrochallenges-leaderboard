// Top-of-leaderboards "Champions" podium. One card per time window
// (Daily / Weekly / All-Time) showing the user with the highest sum
// of grade points in that window. Cards collapse to "no champion yet"
// when no graded runs exist in the window.

import Image from 'next/image';
import Link from 'next/link';
import { userProfileHref } from '@/lib/leaderboard';
import type { PodiumEntry, PodiumWindow } from '@/lib/podium';

interface CardSpec {
  window: PodiumWindow;
  label: string;
  entry: PodiumEntry | null;
}

export function Podium({
  daily,
  weekly,
  allTime,
}: {
  daily: PodiumEntry | null;
  weekly: PodiumEntry | null;
  allTime: PodiumEntry | null;
}) {
  const cards: CardSpec[] = [
    { window: 'daily',  label: 'Daily Champion',    entry: daily },
    { window: 'weekly', label: 'Weekly Champion',   entry: weekly },
    { window: 'all',    label: 'All-Time Champion', entry: allTime },
  ];

  return (
    <section className="mb-8" aria-label="Top players">
      <h2 className="font-display text-lg font-semibold text-white mb-3">Champions</h2>
      <ul className="grid gap-3 sm:grid-cols-3 list-none">
        {cards.map((c) => (
          <li key={c.window}>
            <PodiumCard label={c.label} entry={c.entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PodiumCard({ label, entry }: { label: string; entry: PodiumEntry | null }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 p-4 h-full">
      <p className="text-xs uppercase tracking-wider text-amber-300 mb-3 flex items-center gap-1.5">
        <span aria-hidden="true">🏆</span>
        {label}
      </p>
      {entry ? (
        <Link
          href={userProfileHref(entry.userId)}
          className="flex items-center gap-3 group"
        >
          {entry.userPictureUrl ? (
            <Image
              src={entry.userPictureUrl}
              alt=""
              width={40}
              height={40}
              className="rounded-full shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-700 shrink-0" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-slate-100 font-semibold truncate group-hover:text-amber-200">
                {entry.userName}
              </span>
              <span className="text-amber-300 shrink-0" aria-label="champion">🏆</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {entry.totalPoints.toLocaleString()} pts &middot;{' '}
              {entry.challengesGraded} graded run{entry.challengesGraded === 1 ? '' : 's'}
            </div>
          </div>
        </Link>
      ) : (
        <p className="text-sm text-slate-500 italic">No champion yet — be the first.</p>
      )}
    </div>
  );
}
