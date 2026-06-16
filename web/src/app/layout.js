import './globals.css';

export const metadata = {
  title: 'RescueLog',
  description: 'AI-powered food rescue tracking',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
