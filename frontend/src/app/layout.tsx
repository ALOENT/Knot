import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SocketProvider } from '@/providers/SocketProvider';
import CursorGlow from '@/components/CursorGlow';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Knot - Next-Gen Messaging',
  description: 'Premium secure direct messaging platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-white antialiased min-h-screen selection:bg-indigo-500/30 overflow-x-hidden`}>
        <SocketProvider>
          <CursorGlow />
          {children}
        </SocketProvider>
      </body>
    </html>
  );
}
