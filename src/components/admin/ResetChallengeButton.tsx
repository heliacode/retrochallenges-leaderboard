'use client';

// "Reset all times" admin control for a single challenge.
//
// Hard-deleting every run on a challenge is permanent and high-blast-
// radius, so the UX gates the action behind a type-the-challenge-name
// confirmation. The submit button stays disabled until the input
// matches verbatim — same idiom GitHub uses for repo deletion. Audit
// log still records who pulled the trigger.

import { useState, useTransition } from 'react';
import { resetChallengeRunsAction } from '@/app/admin/actions';

interface Props {
  game: string;
  challengeName: string;
  runCount: number;
}

export function ResetChallengeButton({ game, challengeName, runCount }: Props) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirmed = typed === challengeName;

  function close() {
    if (pending) return;          // don't yank the modal mid-action
    setOpen(false);
    setTyped('');
    setError(null);
  }

  function submit() {
    if (!confirmed || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        await resetChallengeRunsAction(game, challengeName);
        close();
      } catch (err) {
        setError((err as Error).message || 'Reset failed.');
      }
    });
  }

  if (runCount === 0) {
    return (
      <button
        disabled
        className="px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-slate-600 cursor-not-allowed"
        title="No runs to reset"
      >
        Reset
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-2 py-1 text-xs rounded border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/60 transition-colors"
      >
        Reset
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-w-md w-full rounded-lg border border-red-500/40 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-bold text-red-300">
              Reset all runs for this challenge?
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              This will permanently delete{' '}
              <strong className="text-white">{runCount}</strong> run
              {runCount === 1 ? '' : 's'} for{' '}
              <strong className="text-white">{game}</strong> /{' '}
              <strong className="text-white">{challengeName}</strong>.{' '}
              The leaderboard for this challenge will be empty after the action.
              Player records on /me and profile pages will recompute on next page load.
              This cannot be undone.
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Type the challenge name to confirm:
            </p>
            <p className="mt-1 font-mono text-xs text-amber-200 break-all">
              {challengeName}
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={challengeName}
              autoFocus
              disabled={pending}
              className="mt-2 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100 placeholder-slate-600 focus:border-red-500 focus:outline-none"
            />
            {error && (
              <p className="mt-2 text-xs text-red-300">{error}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="px-3 py-1.5 text-sm rounded border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!confirmed || pending}
                className="px-3 py-1.5 text-sm rounded border border-red-500/60 bg-red-500/20 text-red-200 font-semibold hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pending ? 'Resetting…' : `Reset ${runCount} run${runCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
