import './globals.css';

export const metadata = {
  metadataBase: new URL('https://rescuelog-mu.vercel.app'),
  title: 'RescueLog',
  description: 'AI-powered food rescue tracking',
  // Google Search Console site verification. Keep this even after
  // verification succeeds, or the site becomes unverified again.
  verification: {
    google: 'n_9oZYst5to9re6y95NAuK_NO4ZyYOazWBqCy0P-C_g',
  },
  // Link-preview cards (iMessage, Slack, email clients, social) show the real
  // RescueLog mark — the same asset as the iOS/Android app icon
  // (web/public/rescuelog-icon.png, copied from mobile/assets/icon.png).
  openGraph: {
    title: 'RescueLog',
    description:
      'Free AI-powered logging for food rescue nonprofits. One photo in, grant-ready data out.',
    images: [{ url: '/rescuelog-icon.png', width: 1024, height: 1024 }],
  },
  twitter: {
    card: 'summary',
    images: ['/rescuelog-icon.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
