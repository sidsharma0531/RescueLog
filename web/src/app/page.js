import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

// Send visitors straight to the dashboard if signed in, otherwise to login.
export default function Home() {
  const session = getSession(cookies());
  redirect(session ? '/dashboard' : '/login');
}
