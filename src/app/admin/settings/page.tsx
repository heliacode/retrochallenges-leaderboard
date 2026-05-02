import { getSiteBanner } from '@/lib/admin';
import { setBannerAction, clearBannerAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const banner = await getSiteBanner();

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <h1 className="font-display text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Site-wide config that takes effect for every visitor as soon as you save.
        </p>
      </header>

      <section className="rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">Site banner</h2>
          <p className="text-xs text-slate-500 mt-1">
            Renders at the top of every page. Pick a level to color it (info / warn / success).
            Leave blank and Clear to remove. Updates propagate immediately.
          </p>
        </div>

        {banner.text && (
          <div className="rounded-md border border-slate-700 bg-slate-925 p-3 text-xs text-slate-400">
            <div className="text-slate-500 uppercase tracking-wider mb-1">currently showing</div>
            <div className="text-slate-200 mb-1">{banner.text}</div>
            <div>
              level: <span className="text-slate-300">{banner.level}</span>
              {banner.updatedAt && (
                <> · set {new Date(banner.updatedAt).toLocaleString()}</>
              )}
            </div>
          </div>
        )}

        <form
          action={async (data) => {
            'use server';
            const text  = (data.get('text')  as string) || '';
            const level = (data.get('level') as string) || 'info';
            await setBannerAction(text, level);
          }}
          className="space-y-3"
        >
          <div>
            <label htmlFor="banner-text" className="block text-xs uppercase text-slate-500 mb-1">
              Banner text
            </label>
            <textarea
              id="banner-text"
              name="text"
              rows={2}
              defaultValue={banner.text ?? ''}
              maxLength={300}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              placeholder="e.g. Servers down for maintenance Friday 8pm UTC"
            />
          </div>
          <div>
            <label htmlFor="banner-level" className="block text-xs uppercase text-slate-500 mb-1">
              Level
            </label>
            <select
              id="banner-level"
              name="level"
              defaultValue={banner.level ?? 'info'}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            >
              <option value="info">info (indigo)</option>
              <option value="warn">warn (amber)</option>
              <option value="success">success (emerald)</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600"
            >
              Save banner
            </button>
          </div>
        </form>

        {banner.text && (
          <form
            action={async () => { 'use server'; await clearBannerAction(); }}
          >
            <button
              type="submit"
              className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/30"
            >
              Clear banner
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
