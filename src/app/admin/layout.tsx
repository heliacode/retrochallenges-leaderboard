import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';

// Wraps every /admin route. requireAdmin() throws via notFound() if the
// signed-in user isn't on the allowlist — anyone fishing for /admin sees
// a 404 rather than a permission-denied page.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px,1fr] gap-6">
      <aside>
        <h2 className="font-display text-sm uppercase tracking-wider text-slate-500 mb-3">
          Admin
        </h2>
        <nav className="space-y-1 text-sm">
          <AdminNavLink href="/admin">           Dashboard   </AdminNavLink>
          <AdminNavLink href="/admin/pending">   Pending     </AdminNavLink>
          <AdminNavLink href="/admin/runs">      Runs        </AdminNavLink>
          <AdminNavLink href="/admin/users">     Users       </AdminNavLink>
          <AdminNavLink href="/admin/challenges">Challenges  </AdminNavLink>
          <AdminNavLink href="/admin/audit">     Audit log   </AdminNavLink>
          <AdminNavLink href="/admin/settings">  Settings    </AdminNavLink>
        </nav>
        <div className="mt-6 text-xs text-slate-600">
          Signed in as admin. Public links above the page header still
          work normally for you.
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}

function AdminNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
    >
      {children}
    </Link>
  );
}
