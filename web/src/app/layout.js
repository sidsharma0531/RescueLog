import './globals.css';

export const metadata = {
  title: 'RescueLog',
  description: 'AI-powered food rescue tracking',
  // Google Search Console site verification. Keep this even after
  // verification succeeds, or the site becomes unverified again.
  verification: {
    google: 'n_9oZYst5to9re6y95NAuK_NO4ZyYOazWBqCy0P-C_g',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
