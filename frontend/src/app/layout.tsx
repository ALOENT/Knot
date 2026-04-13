import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import CursorGlow from '@/components/CursorGlow';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Knot — Secure Messaging',
  description:
    'Premium secure direct messaging platform with real-time communication.',
  keywords: ['messaging', 'chat', 'secure', 'real-time'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body
        className="antialiased min-h-screen overflow-x-hidden"
        style={{
          fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif',
          backgroundColor: '#0a0a0a',
          color: '#e5e5e5',
          letterSpacing: '-0.01em',
        }}
      >
        {/* Star-grid background pattern — always present */}
        <div className="star-grid" />

        {/* Cursor glow — self-disables on non-auth pages */}
        <CursorGlow />

        {/* Page content */}
        <div className="relative z-1">
          {children}
        </div>
      </body>
    </html>
  );
}
