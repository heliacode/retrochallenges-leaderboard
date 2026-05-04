import { gradeChipClass, type Grade } from '@/lib/grading';

// Compact grade pill. Used inline next to a completion time on
// leaderboard rows, profile tables, activity feed, etc. Pure
// presentational — caller computes the grade from a (thresholds,
// frames) pair via gradeForRun() and passes it in.
//
// `grade=null` renders a muted "—" so unattempted / un-gradable
// rows don't shift the layout.
export function GradeChip({
  grade,
  size = 'sm',
}: {
  grade: Grade | null;
  size?: 'sm' | 'md';
}) {
  const sizeCls = size === 'md'
    ? 'px-2.5 py-1 text-xs'
    : 'px-1.5 py-0.5 text-[10px]';
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-bold tabular-nums tracking-wider ${sizeCls} ${gradeChipClass(grade)}`}
      title={grade ? `Grade ${grade}` : 'No grade'}
    >
      {grade ?? '—'}
    </span>
  );
}
