import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import { OrgModeProvider } from '@/components/OrgMode';

// Server component — gates the whole dashboard on a valid admin session.
export default function DashboardLayout({ children }) {
  const session = getSession(cookies());
  if (!session) redirect('/login');

  return (
    <OrgModeProvider captureMode={session.capture_mode}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar adminName={session.name} />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </OrgModeProvider>
  );
}
