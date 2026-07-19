'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api-client';
import Logo from './Logo';
import { useTerms } from './OrgMode';

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/popups', label: 'Pop-Up Logs' },
  { href: '/dashboard/sites', label: 'Sites' },
  { href: '/dashboard/pricing', label: 'Pricing' },
  { href: '/dashboard/export', label: 'Export' },
];

// Org switcher shown only to super admins: "All Orgs" or drill into one org.
// Switching sets an httpOnly cookie server-side, then fully reloads so every
// server component and client fetch re-runs under the new scope.
function OrgSwitcher({ currentOrgId }) {
  const [orgs, setOrgs] = useState([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    apiGet('/api/super/orgs')
      .then((d) => setOrgs(d.organizations || []))
      .catch(() => {});
  }, []);

  async function switchOrg(orgId) {
    setSwitching(true);
    try {
      await apiPost('/api/super/org', { organization_id: orgId });
      window.location.reload();
    } catch {
      setSwitching(false);
    }
  }

  return (
    <div className="px-1 pb-1">
      <label className="block px-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-rescue-orange">
        Master view
      </label>
      <select
        value={currentOrgId || ''}
        onChange={(e) => switchOrg(e.target.value)}
        disabled={switching}
        className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm font-medium text-rescue-ink outline-none focus:border-rescue-green focus:ring-1 focus:ring-rescue-green disabled:opacity-60"
      >
        <option value="">All Orgs</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function Sidebar({ adminName, superAdmin = false, currentOrgId = null }) {
  const pathname = usePathname();
  const router = useRouter();
  const terms = useTerms();

  // Terminology follows the effective capture mode (org's own, or neutral
  // "Logs" in the super admin's all-orgs view).
  const navItems = NAV.map((item) =>
    item.href === '/dashboard/popups'
      ? { ...item, label: terms.navLabel }
      : item,
  );

  const isActive = (href) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  async function logout() {
    try {
      await apiPost('/api/auth/logout');
    } catch {
      /* ignore — clear client state regardless */
    }
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:border-r md:border-gray-200 md:bg-white">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Logo size={36} />
          <span className="text-lg font-bold text-rescue-ink">RescueLog</span>
        </div>
        {superAdmin && (
          <div className="px-3 pb-3">
            <OrgSwitcher currentOrgId={currentOrgId} />
          </div>
        )}
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(item.href)
                  ? 'bg-rescue-green-light text-rescue-green-dark'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-100 p-3">
          {adminName && (
            <p className="px-2 pb-1.5 text-xs text-gray-400">
              Signed in as {adminName}
            </p>
          )}
          <button
            onClick={logout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="border-b border-gray-200 bg-white md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Logo size={30} />
            <span className="font-bold text-rescue-ink">RescueLog</span>
          </div>
          <button
            onClick={logout}
            className="text-sm font-medium text-gray-500"
          >
            Sign out
          </button>
        </div>
        {superAdmin && (
          <div className="px-3 pb-2">
            <OrgSwitcher currentOrgId={currentOrgId} />
          </div>
        )}
        <nav className="thin-scroll flex gap-1 overflow-x-auto px-3 pb-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                isActive(item.href)
                  ? 'bg-rescue-green-light text-rescue-green-dark'
                  : 'text-gray-600'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
