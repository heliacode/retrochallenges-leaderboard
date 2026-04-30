'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { filterSearchItems, type SearchItem } from '@/lib/challenges-manifest';

// Lightweight global jump for the catalog: type a few letters to reach a
// game or challenge directly without browsing the tile/category hierarchy.
//
// Index is fetched lazily on first focus so most page views never pay for
// it. Filtering is pure substring (case-insensitive) — the index is small
// (~20 entries today, expected to stay under low triple-digit) so we don't
// need a fuzzy-match dependency.
export function HeaderSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const results = items ? filterSearchItems(items, query) : [];

  // Reset highlight whenever the result set changes (typing, focus, etc.).
  useEffect(() => {
    setActiveIdx(0);
  }, [query, items]);

  // Click outside the search box closes the dropdown. Listening on
  // mousedown rather than click so a click on a result still fires its
  // own onClick before we tear down.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  async function ensureIndex() {
    if (items || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/search-index');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as SearchItem[];
      setItems(data);
    } catch (err) {
      console.warn('[search] index fetch failed:', (err as Error).message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function navigate(item: SearchItem) {
    router.push(item.href);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigate(results[activeIdx]);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full sm:w-72">
      <input
        ref={inputRef}
        type="search"
        placeholder="Search games and challenges…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          ensureIndex();
        }}
        onKeyDown={onKeyDown}
        aria-label="Search games and challenges"
        aria-autocomplete="list"
        aria-expanded={open && results.length > 0}
        className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
      />
      {open && query.trim() !== '' && (
        <div className="absolute right-0 left-0 mt-1 z-20 overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">
              {items === null ? 'Loading…' : `No matches for “${query.trim()}”`}
            </div>
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto">
              {results.map((r, idx) => (
                <li
                  key={`${r.type}:${r.href}`}
                  role="option"
                  aria-selected={idx === activeIdx}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseDown={(e) => {
                    // mousedown so we beat the document mousedown that
                    // would otherwise close the dropdown before click.
                    e.preventDefault();
                    navigate(r);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${
                    idx === activeIdx
                      ? 'bg-indigo-500/20 text-white'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                      r.type === 'game'
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {r.type}
                  </span>
                  <span className="truncate flex-1">{r.label}</span>
                  {r.context && (
                    <span className="text-xs text-slate-500 truncate shrink-0">{r.context}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
