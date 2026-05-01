'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Mirror of the desktop app's edit-profile contract — same constraints
// the server-side Sharp validator enforces, so the user gets immediate
// feedback before paying for an upload round-trip.
const PROFILE_AVATAR_MAX_BYTES = 1024 * 1024;
const PROFILE_AVATAR_MAX_DIM = 1024;
const PROFILE_AVATAR_OK_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
const NAME_MAX_LEN = 120;

interface Props {
  currentName: string;
  currentAvatarUrl: string | null;
}

export function EditProfilePanel({ currentName, currentAvatarUrl }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openPanel() {
    setOpen(true);
    setName(currentName);
    setPreviewUrl(currentAvatarUrl);
    setPendingFile(null);
    setError(null);
    setStatus(null);
  }

  function closePanel() {
    setOpen(false);
    setPendingFile(null);
    setError(null);
    setStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function validateAvatarClientSide(file: File): Promise<{ ok: true } | { ok: false; error: string }> {
    if (file.size > PROFILE_AVATAR_MAX_BYTES) {
      return { ok: false, error: `Image is ${Math.round(file.size / 1024)} KB; max is 1024 KB.` };
    }
    if (!PROFILE_AVATAR_OK_MIMES.includes(file.type)) {
      return { ok: false, error: 'Use a PNG, JPEG, or WebP image.' };
    }
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        if (img.width > PROFILE_AVATAR_MAX_DIM || img.height > PROFILE_AVATAR_MAX_DIM) {
          resolve({ ok: false, error: `Image is ${img.width}×${img.height}; max is 1024×1024.` });
        } else if (img.width !== img.height) {
          resolve({ ok: false, error: `Image must be square (got ${img.width}×${img.height}).` });
        } else {
          resolve({ ok: true });
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ ok: false, error: 'Could not read the image.' });
      };
      img.src = url;
    });
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setStatus(null);
    const v = await validateAvatarClientSide(file);
    if (!v.ok) {
      setError(v.error);
      e.target.value = '';
      setPendingFile(null);
      return;
    }
    // Local preview without uploading.
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setPendingFile(file);
  }

  async function save() {
    const trimmed = name.trim();
    const renaming = trimmed && trimmed !== currentName;
    if (!renaming && !pendingFile) {
      setError('Nothing to save — change a name or pick an image.');
      return;
    }
    setSaving(true);
    setError(null);
    setStatus('Saving…');

    try {
      // Sequential: name first, then avatar. Either can fail independently;
      // we surface the first error and stop.
      if (renaming) {
        const res = await fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) {
          const body = await safeJson(res);
          setError(`Could not update name: ${body?.error || res.statusText}`);
          setStatus(null);
          setSaving(false);
          return;
        }
      }
      if (pendingFile) {
        const form = new FormData();
        form.append('avatar', pendingFile);
        const res = await fetch('/api/users/me/avatar', { method: 'POST', body: form });
        if (!res.ok) {
          const body = await safeJson(res);
          setError(`Could not upload avatar: ${body?.detail || body?.error || res.statusText}`);
          setStatus(null);
          setSaving(false);
          return;
        }
      }
      setStatus('Saved.');
      setSaving(false);
      // Re-render the server component tree so the hero card + header
      // avatar pick up the new values without a full page reload.
      router.refresh();
      // Auto-close after a beat so the user sees the success message.
      setTimeout(() => closePanel(), 600);
    } catch (err) {
      setError(`Network error: ${(err as Error).message}`);
      setStatus(null);
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPanel}
        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 hover:border-indigo-500 hover:bg-slate-800"
      >
        Edit profile
      </button>
    );
  }

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-800 p-6 space-y-4">
      <h2 className="font-display text-lg font-semibold text-white">Edit profile</h2>

      <div>
        <label htmlFor="profile-edit-name" className="block text-sm text-slate-400 mb-1">
          Display name
        </label>
        <input
          id="profile-edit-name"
          type="text"
          maxLength={NAME_MAX_LEN}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-2">Avatar</label>
        <div className="flex items-center gap-4">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt=""
              width={80}
              height={80}
              className="h-20 w-20 rounded-full bg-slate-700 object-cover"
              unoptimized={previewUrl.startsWith('blob:')}
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-slate-700" aria-hidden="true" />
          )}
          <div className="text-xs text-slate-500 space-y-1">
            <input
              ref={fileInputRef}
              type="file"
              accept={PROFILE_AVATAR_OK_MIMES.join(',')}
              onChange={onFilePicked}
              className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-100 hover:file:bg-slate-600"
            />
            <p>PNG, JPEG, or WebP. Max 1024 KB, max 1024×1024, must be square.</p>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      {status && !error && (
        <p className="text-sm text-emerald-300" role="status">
          {status}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={closePanel}
          disabled={saving}
          className="rounded-md px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-progress"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </section>
  );
}

async function safeJson(res: Response): Promise<{ error?: string; detail?: string } | null> {
  try {
    return (await res.json()) as { error?: string; detail?: string };
  } catch {
    return null;
  }
}
