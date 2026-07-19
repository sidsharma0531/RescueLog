import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession, getScope } from '@/lib/auth';
import { captureModeForScope } from '@/lib/orgmode';
import Sidebar from '@/components/Sidebar';
import { OrgModeProvider } from '@/components/OrgMode';

// Server component — gates the whole dashboard on a valid admin session.
// The capture mode driving terminology + category profile follows the request
// scope: a regular admin's own org, or whatever the super admin has picked
// ('all' for the aggregate view).
export default async function DashboardLayout({ children }) {
  const session = getSession(cookies());
  if (!session) redirect('/login');

  const scope = getScope(cookies());
  if (!scope) redirect('/login');
  const captureMode = await captureModeForScope(scope);

  return (
    <OrgModeProvider captureMode={captureMode}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar
          adminName={session.name}
          superAdmin={scope.superAdmin}
          currentOrgId={scope.superAdmin ? scope.orgId || '' : null}
        />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </OrgModeProvider>
  );
}
