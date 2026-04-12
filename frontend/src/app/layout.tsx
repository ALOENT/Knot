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
  title: 'Knot — Next-Gen Messaging',
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
        className="bg-[#0F0F12] text-[#E8E8ED] antialiased min-h-screen overflow-x-hidden"
        style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}
      >
        <CursorGlow />
        {children}
      </body>
    </html>
  );
}
